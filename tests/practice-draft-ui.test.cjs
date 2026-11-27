const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'), vm=require('node:vm'), path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const fingerboard=fs.readFileSync(path.join(__dirname,'../fingerboard.js'),'utf8');
const storageSource=fingerboard.match(/\/\* START practice history module \*\/([\s\S]*?)\/\* END practice history module \*\//)[1];
const code=name=>html.split('// '+name+'_START')[1].split('// '+name+'_END')[0];
const target=[36,38,40,41,43,41,40,38,36].map(midi=>({midi,name:String(midi),octave:2}));
class Node{
 constructor(){this.children=[];this.dataset={};this.attributes={};this.style={setProperty(){}};this.handlers={};}
 append(...nodes){this.children.push(...nodes);}
 insertBefore(node,other){this.children.splice(this.children.indexOf(other),0,node);}
 addEventListener(name,fn){this.handlers[name]=fn;}
 setAttribute(name,val){this.attributes[name]=val;}
 set textContent(text){this.text=text;this.children=[];}
 get textContent(){return this.text;}
 find(cls){return this.className?.split(' ').includes(cls)?this:this.children.map(child=>child.find(cls)).find(Boolean);}
}
function memory(){
 const data=new Map(); const calls=[];
 return {data,calls,fail:false,getItem:key=>data.get(key)??null,removeItem:key=>data.delete(key),setItem(key,value){
  if(this.fail)throw Error('quota');calls.push(key);data.set(key,value);
 }};
}
function realm(storage,search='',pathname='/daily-key-practice/experimental/'){
 const mounted=[];
 const context=vm.createContext({document:{createElement:()=>new Node(),createElementNS:()=>new Node(),querySelectorAll:()=>mounted},localStorage:storage,URL,URLSearchParams,
  location:{pathname,hostname:'localhost',search,href:'https://example.test'+pathname+search}});
 vm.runInContext(code('PRACTICE_COACH'),context);
 vm.runInContext(storageSource,context);
 context.module={exports:{}};vm.runInContext(code('AUDIO_TOOLS'),context);
 const {pitchReading}=context.module.exports;
 context.module={exports:{}};vm.runInContext(code('SCALE_PRACTICE'),context);
 return {context,mounted,pitchReading};
}
function build(storage, scope='major-C', kind='scale', mode='loop', shared=realm(storage)){
 const {context,mounted,pitchReading}=shared;
 const {manager,card}=context.module.exports;
 const history=context.CelloPracticeHistory, key=history.keyFor(scope,kind,target);
 const nodes=target.map(()=>new Node());
 let now=0, callbacks, prompts=0;
 const capture={subscribe(next){prompts++;callbacks=next;return ()=>{};}};
 const m=manager({performance:{now:()=>now}},{capture,swiftCapture:capture,detector:()=>'swift',
  pitchReading,pitchName:String,reference:()=>442});
 const view=card({querySelectorAll:()=>nodes},target,v=>m.toggle(v),kind,scope);
 Object.defineProperty(view,'mode',{value:mode});
 mounted.push(view.element);
 return {view, key, history, nodes,
  start:async()=>{await m.toggle(view);callbacks.ready();},stop:()=>m.toggle(view),
  play(midi,cents=0,frames=6){for(let i=0;i<frames;i++)callbacks.frame({now:now+=27,frequency:midi?442*2**((midi-69+cents/100)/12):null});},
  get prompts(){return prompts;}, get state(){return view.element.practiceHistory;}};
}
const count=(api,store,key,i=0)=>Array.from(api.load(store,key,target.length).bins[i],x=>Array.from(x));
test('live checkpoint does not count while active; stop automatically accumulates latest keyed result',async()=>{
 const store=memory(), f=build(store,'major-C','scale','single');
 await f.start();f.play(36,7);assert.equal(f.history.load(store,f.key,target.length).exists,false);
 await f.stop();assert.deepEqual(count(f.history,store,f.key),[[7,1]]);
 const after=build(store,'major-C','scale','single');
 assert.equal(after.prompts,0);assert.equal(after.nodes[0].dataset.practice,'matched');
 assert.deepEqual(count(f.history,store,f.key),[[7,1]]);
 await after.start();after.play(36,7);await after.stop();
 assert.deepEqual(count(f.history,store,f.key),[[7,2]]);
});
test('different keys and scale/arpeggio keep independent recent charts and historical counts',async()=>{
 const store=memory(),shared=realm(store),c=build(store,'major-C','scale','single',shared),
  f=build(store,'major-F','scale','single',shared), arp=build(store,'major-C','arpeggio','single',shared);
 for(const [run,cents] of [[c,7],[f,-11],[arp,16]]){await run.start();run.play(36,cents);await run.stop();}
 assert.deepEqual(count(c.history,store,c.key),[[7,1]]);
 assert.deepEqual(count(f.history,store,f.key),[[-11,1]]);
 assert.deepEqual(count(arp.history,store,arp.key),[[16,1]]);
 for(const [key,kind] of [['major-C','scale'],['major-F','scale'],['major-C','arpeggio']])
  assert.equal(build(store,key,kind).nodes[0].dataset.practice,'matched');
 c.view.element.find('scale-practice-clear-history').handlers.click();
 c.view.element.find('scale-practice-cancel-clear').handlers.click();
 assert.deepEqual(count(c.history,store,c.key),[[7,1]]);
 c.view.element.find('scale-practice-clear-history').handlers.click();
 c.view.element.find('scale-practice-confirm-clear').handlers.click();
 assert.equal(c.history.loadKeyDraft(store,c.key,target.length).exists,false);
 assert.equal(c.history.load(store,c.key,target.length).exists,false);
 assert.equal(c.nodes[0].dataset.practice,undefined);
 assert.deepEqual(count(f.history,store,f.key),[[-11,1]]);
 assert.deepEqual(count(arp.history,store,arp.key),[[16,1]]);
 await c.start();c.play(36,26);await c.stop();
 assert.deepEqual(count(c.history,store,c.key),[[26,1]]);
});
test('completed loop counts once at terminal and does not make a phantom carried tonic',async()=>{
 const store=memory(),f=build(store);await f.start();target.forEach(n=>f.play(n.midi,5));await f.stop();
 assert.deepEqual(count(f.history,store,f.key),[[5,1]]);
 assert.deepEqual(count(f.history,store,f.key,target.length-1),[[5,1]]);
});
test('discernible quota failure is inline and does not overwrite the durable last result',async()=>{
 const store=memory(),f=build(store,'major-C','scale','single');await f.start();f.play(36,8);await f.stop();
 const prior=f.history.loadKeyDraft(store,f.key,target.length).draft.id;
 await f.start();store.fail=true;f.play(36,15);await f.stop();store.fail=false;
 assert.match(f.view.element.find('scale-practice-history-actions').children.at(-1).textContent,/無法儲存/);
 assert.equal(f.history.loadKeyDraft(store,f.key,target.length).draft.id,prior);
 assert.deepEqual(count(f.history,store,f.key),[[8,1]]);
});

test('measured chart and coaching restore after reload without changing mic or inventing A4 metadata',async()=>{
 const storage=memory(), initial=build(storage,'major-C','scale','single',realm(storage,''));
 assert.ok(!initial.view.element.find('scale-practice-coach').hidden);
 await initial.start();initial.play(36,8);await initial.stop();
 assert.ok(!initial.view.element.find('scale-practice-coach').hidden);
 const draft=initial.history.loadKeyDraft(storage,initial.key,target.length).draft;
 assert.equal(draft.coach.engine,'SwiftF0');assert.equal(draft.coach.reference,442);
 const restored=build(storage,'major-C','scale','single',realm(storage,''));
 assert.equal(restored.prompts,0);
 assert.ok(!restored.view.element.find('scale-practice-coach').hidden);
 const legacy={...draft};delete legacy.coach;
 assert.equal(initial.history.saveKeyDraft(storage,initial.key,legacy).ok,true);
 assert.equal(restored.history.loadKeyDraft(storage,restored.key,target.length).draft.coach,undefined);
 const old=build(storage,'major-C','scale','single',realm(storage,''));
 assert.equal(old.view.element.find('scale-practice-coach').hidden,false);
 const stable=realm(storage,'?aiCoach=1','/daily-key-practice/');
 const restoredStable=build(storage,'major-C','scale','single',stable);
 assert.ok(restoredStable.view.element.find('scale-practice-local-coach'));
 assert.equal(stable.context.CelloPracticeCoach.enabled(stable.context),false,'production never exposes the Qwen panel, even on localhost with a debug query');
});

test('a finished measured trace restores when expanded and stays paired with its advice after an empty take',async()=>{
 const store=memory(), first=build(store,'major-C','scale','single');
 await first.start();first.play(36,21,32);first.play(null,0,5);first.play(38,-14,32);
 const checkpoint=first.history.loadKeyDraft(store,first.key,target.length).draft;
 assert.equal(checkpoint.trend,undefined,'live draft checkpoints never store frames');
 const writes=store.calls.length;
 await first.stop();assert.equal(store.calls.length,writes+2);
 const finished=first.history.loadKeyDraft(store,first.key,target.length).draft;
 assert.equal(finished.id,checkpoint.id);
 assert.equal(finished.trend.reference,442);
 assert.ok(finished.trend.data.length>=8);
 assert.equal(store.data.size,2,'exactly one aggregate and latest snapshot');
 const fresh=build(store,'major-C','scale','single');
 assert.equal(fresh.view.element.find('scale-pitch-trend'),undefined,'collapsed cards stay lazy');
 fresh.view.element.showPracticeCharts(true);
 const details=fresh.view.element.find('scale-pitch-trend');
 assert.equal(fresh.prompts,0);assert.ok(details);
 assert.equal(details.children[0].textContent,'音準走勢');
 assert.match(details.children[1].textContent,/上次保留.*A4 442 Hz/);
 assert.ok(details.find('scale-pitch-trend-scroll'));
 assert.equal(build(store,'major-C','arpeggio').view.element.find('scale-pitch-trend'),undefined);
 await fresh.start();fresh.play(null,0,10);await fresh.stop();
 assert.equal(fresh.view.element.children.filter(e=>e.className==='scale-pitch-trend'&&!e.hidden).length,2);
 assert.match(details.children[1].textContent,/上次保留/);
 assert.equal(first.history.loadKeyDraft(store,first.key,target.length).draft.id,finished.id);
});

test('corrupt trace provenance is ignored, preserving the dot draft and leaving an honest missing-trace placeholder',async()=>{
 const store=memory(), first=build(store);
 await first.start();first.play(36,21,30);await first.stop();
 const slot=[...store.data.keys()][0], valid=store.data.get(slot);
 for(const corrupt of [raw=>{raw.trend.draftId='different';},raw=>{raw.trend.mode='single';},
  raw=>{raw.trend.reference=440;},raw=>{raw.trend.points[0][2]=999;}]){
  const raw=JSON.parse(valid);assert.ok(raw.trend);corrupt(raw);store.data.set(slot,JSON.stringify(raw));
  const next=build(store);
  const draft=next.history.loadKeyDraft(store,next.key,target.length).draft;
  assert.equal(draft.trend,undefined);assert.equal(next.nodes[0].dataset.practice,'matched');
  next.view.element.showPracticeCharts(true);
  const details=next.view.element.find('scale-pitch-trend');
  assert.match(details.children[1].textContent,/尚無可顯示/);
 }
});

test('a stale tab cannot overwrite the newer draft during subsequent live frames or final trace write',async()=>{
 const store=memory(), a=build(store,'major-C'), b=build(store,'major-C');
 await a.start();a.play(36,12,24);
 await b.start();b.play(36,-16,26);await b.stop();
 const recent=b.history.loadKeyDraft(store,b.key,target.length).draft;
 assert.ok(recent.trend.data.length>0);
 a.play(38,9,20);await a.stop();
 assert.equal(b.history.loadKeyDraft(store,b.key,target.length).draft.id,recent.id);
 assert.deepEqual(b.history.loadKeyDraft(store,b.key,target.length).draft.trend,recent.trend);
});

test('trace quota pressure still updates the currently owned dot draft and never leaves invalid tuples',async()=>{
 const store=memory(), a=build(store,'major-C','scale','single');
 const set=store.setItem;
 store.setItem=function(k,v){if(JSON.parse(v).trend)throw Error('trace quota');return set.call(this,k,v);};
 await a.start();a.play(36,14,30);await a.stop();
 const draft=a.history.loadKeyDraft(store,a.key,target.length).draft;
 assert.equal(draft.trend,undefined);
 assert.ok(Number.isFinite(draft.values[0]));
 assert.equal(store.data.size,2);
});

test('auto accumulation preserves the trace and stale tabs cannot reopen a superseded trace',async()=>{
 const store=memory(), first=build(store,'major-C','scale','single');
 await first.start();first.play(36,18,30);await first.stop();
 const draft=first.history.loadKeyDraft(store,first.key,target.length).draft;
 assert.ok(draft.trend);
 const merged=first.history.loadKeyDraft(store,first.key,target.length).draft;
 assert.equal(merged.id,draft.id);
 assert.equal(merged.pending,false);
 assert.deepEqual(merged.trend,draft.trend);
 const stale=build(store,'major-C','scale','loop');
 const newer=build(store,'major-C','scale','loop');
 await newer.start();newer.play(36,-14,28);await newer.stop();
 stale.view.element.showPracticeCharts(true);
 const detail=stale.view.element.find('scale-pitch-trend');
 assert.match(detail.children[1].textContent,/已被另一筆練習取代/);
 assert.equal(detail.children[2].children[0].children[2].attributes.d,'');
});

test('coach uses qualified temporal facts only while the displayed restored nonce still owns the local draft',async()=>{
 const store=memory(), first=build(store,'major-C','scale','single');
 await first.start();first.play(36,18,32);await first.stop();
 const watched=realm(store,'?aiCoach=1'), calls=[];
 Object.assign(watched.context,{performance,setInterval,clearInterval,navigator:{}});
 watched.context.CelloPracticeCoach.service=()=>({async run(facts){calls.push(facts);return {reason:'unsupported'};}});
 const before=build(store,'major-C','scale','loop',watched);
 const button=before.view.element.find('scale-practice-coach-action');
 await button.handlers.click();
 assert.match(calls[0].coverage,/上次/);
 assert.ok(calls[0].trace.data.length>=8);
 const later=build(store,'major-C','scale','loop');
 await later.start();later.play(36,-17,30);await later.stop();
 await button.handlers.click();
 assert.match(calls[1].coverage,/上次/);
 assert.equal(calls[1].trace,null);
});

test('fresh expanded card mounts all graphs when initial restored payload is explicitly null',()=>{
 const f=build(memory(),'major-C','scale','single');
 f.view.update('idle',null,null,0,442,null);
 assert.doesNotThrow(()=>f.view.element.showPracticeCharts(true));
 assert.ok(f.view.element.children.some(n=>n.dataset.chartTime==='pitch'));
 assert.ok(f.view.element.children.some(n=>n.dataset.chartTime==='volume'));
});
