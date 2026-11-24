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
 return {data,calls,fail:false,getItem:key=>data.get(key)??null,setItem(key,value){
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
 const m=manager({performance:{now:()=>now}},{capture,swiftCapture:capture,
  pitchReading,pitchName:String,reference:()=>442});
 const view=card({querySelectorAll:()=>nodes},target,v=>m.toggle(v),kind,scope);
 Object.defineProperty(view,'mode',{value:mode});
 mounted.push(view.element);
 return {view, key, history, nodes,
  start:async()=>{await m.toggle(view);callbacks.ready();},stop:()=>m.toggle(view),
  play(midi,cents=0,frames=6){for(let i=0;i<frames;i++)callbacks.frame({now:now+=27,frequency:midi?442*2**((midi-69+cents/100)/12):null});},
  get prompts(){return prompts;}, get state(){return view.element.practiceHistory;}};
}
test('measured live draft survives reload, never restarts mic or auto-merges, and deferral preserves its graph',async()=>{
 const storage=memory(),f=build(storage);
 await f.start();
 assert.equal(storage.calls.length,0);
 f.play(36,7);
 const writes=storage.calls.length;
 assert.equal(writes,1);
 f.play(36,7,50);
 assert.equal(storage.calls.length,writes,'held frames do not rewrite same graph');
 assert.equal(f.history.load(storage,f.key,target.length).exists,false);
 const g=build(storage);
 assert.equal(g.prompts,0);
 assert.equal(g.view.element.dataset.phase,'idle');
 assert.equal(g.nodes[0].dataset.practice,'matched');
 assert.equal(g.state.hasUnsaved(),true);
 assert.equal(g.state.needsExitWarning(),false);
 assert.equal(g.state.discard(),true);
 assert.equal(g.state.hasUnsaved(),true);
 assert.equal(build(storage,'major-F').state.hasUnsaved(),false);
 assert.equal(build(storage,'major-C','arpeggio').state.hasUnsaved(),false);
 assert.ok(g.state.save());
 assert.ok(g.state.save(),'retry is harmless');
 const reloaded=build(storage);
 assert.equal(reloaded.state.hasUnsaved(),false);
 assert.equal(reloaded.nodes[0].dataset.practice,'matched');
 assert.deepEqual(Array.from(reloaded.history.load(storage,reloaded.key,target.length).bins[0],x=>Array.from(x)),[[7,1]]);
});
test('no-note trial preserves older draft and a storage failure asks for exit warning',async()=>{
 const storage=memory(),f=build(storage);
 await f.start(); f.play(36,8); await f.stop();
 const first=f.history.loadDraft(storage,f.key,target.length).draft;
 const g=build(storage);
 await g.start(); g.play(24,0); await g.stop();
 const after=g.history.loadDraft(storage,g.key,target.length).draft;
 assert.equal(after.id,first.id);
 assert.equal(g.state.hasUnsaved(),true);
 await g.start();
 storage.fail=true;g.play(36,15);
 assert.equal(g.state.needsExitWarning(),true);
 await g.stop();
 assert.equal(g.state.save(),false);
 assert.equal(g.state.hasUnsaved(),true);
 storage.fail=false;
 assert.equal(g.state.save(),true);
 assert.equal(g.state.needsExitWarning(),false);
});
test('a completed loop draft does not invent a partial from only the carried tonic',async()=>{
 const storage=memory(),f=build(storage);
 await f.start();target.forEach(n=>f.play(n.midi,5));
 const restored=build(storage);
 const {draft}=restored.history.loadDraft(storage,restored.key,target.length);
 assert.equal(draft.laps,1);
 assert.deepEqual(Array.from(draft.attemptHistory[0],x=>Array.from(x)),[[5,1]]);
 assert.deepEqual(Array.from(draft.attemptHistory.at(-1),x=>Array.from(x)),[[5,1]]);
 assert.equal(draft.values.length,target.length);
});
test('new measured scope supersedes singleton and hides stale mounted draft, but an empty scope does not',async()=>{
 const storage=memory(),shared=realm(storage);
 const c=build(storage,'major-C','scale','loop',shared),f=build(storage,'major-F','arpeggio','loop',shared);
 await c.start();c.play(36,8);await c.stop();
 assert.equal(c.state.hasUnsaved(),true);
 assert.equal(c.view.element.find('scale-pitch-chart').hidden,false);
 await f.start();f.play(24);await f.stop();
 assert.equal(c.state.hasUnsaved(),true);
 await f.start();f.play(36,9);await f.stop();
 assert.equal(c.state.hasUnsaved(),false);
 assert.equal(c.view.element.find('scale-pitch-chart').hidden,false);
 assert.equal(c.view.element.find('scale-pitch-cents').textContent,'—');
 assert.equal(f.state.hasUnsaved(),true);
 assert.equal(c.history.loadDraft(storage,c.key,target.length).exists,false);
 assert.equal(f.history.loadDraft(storage,f.key,target.length).exists,true);
});
test('a stale cross-tab merge does not store an aggregate or overwrite the newer singleton',async()=>{
 const storage=memory(),c=build(storage,'major-C'),f=build(storage,'major-F');
 await c.start();c.play(36,8);await c.stop();
 await f.start();f.play(36,9);await f.stop();
 assert.equal(c.state.save(),false,'stale state must not report save success');
 assert.equal(c.state.hasUnsaved(),false,'stale state should not trap navigation');
 assert.match(c.view.element.find('scale-practice-history-actions').children.at(-1).textContent,/被新的練習取代/);
 assert.equal(c.history.load(storage,c.key,target.length).exists,false);
 assert.equal(f.history.loadDraft(storage,f.key,target.length).exists,true);
});
test('stopping an inactive-for-progress older tab cannot overwrite a newly measured draft',async()=>{
 const storage=memory(),old=build(storage,'major-C'),latest=build(storage,'major-F');
 await old.start();old.play(36,8);
 await latest.start();latest.play(36,9);await latest.stop();
 await old.stop();
 assert.equal(old.state.hasUnsaved(),false);
 assert.equal(old.state.needsExitWarning(),false);
 assert.equal(latest.history.loadDraft(storage,latest.key,target.length).exists,true);
});
test('retry of a draft that failed to write cannot replace another tab’s newer durable draft',async()=>{
 const storage=memory(),a=build(storage,'major-C'),b=build(storage,'major-F');
 await a.start();
 storage.fail=true; a.play(36,12); await a.stop();
 assert.equal(a.state.needsExitWarning(),true);
 storage.fail=false;
 await b.start();b.play(36,9);await b.stop();
 assert.equal(a.state.save(),false);
 assert.equal(a.state.needsExitWarning(),false);
 assert.equal(a.history.load(storage,a.key,target.length).exists,false);
 assert.equal(b.history.loadDraft(storage,b.key,target.length).exists,true);
});

test('measured chart and coaching restore after reload without changing mic or inventing A4 metadata',async()=>{
 const storage=memory(), initial=build(storage,'major-C','scale','single',realm(storage,''));
 assert.ok(!initial.view.element.find('scale-practice-coach').hidden);
 await initial.start();initial.play(36,8);await initial.stop();
 assert.ok(!initial.view.element.find('scale-practice-coach').hidden);
 const draft=initial.history.loadDraft(storage,initial.key,target.length).draft;
 assert.equal(draft.coach.engine,'SwiftF0');assert.equal(draft.coach.reference,442);
 const restored=build(storage,'major-C','scale','single',realm(storage,''));
 assert.equal(restored.prompts,0);
 assert.ok(!restored.view.element.find('scale-practice-coach').hidden);
 const legacy={...draft};delete legacy.coach;
 assert.equal(initial.history.saveDraft(storage,initial.key,legacy).ok,true);
 assert.equal(restored.history.loadDraft(storage,restored.key,target.length).draft.coach,undefined);
 const old=build(storage,'major-C','scale','single',realm(storage,''));
 assert.equal(old.view.element.find('scale-practice-coach').hidden,false);
 const off=build(storage,'major-C','scale','single',realm(storage,'','/daily-key-practice/'));
 assert.equal(off.view.element.find('scale-practice-coach'),undefined);
});

test('a finished measured trace restores when expanded and never revives after an empty successor',async()=>{
 const store=memory(), first=build(store,'major-C','scale','single');
 await first.start();first.play(36,21,32);first.play(null,0,5);first.play(38,-14,32);
 const checkpoint=first.history.loadDraft(store,first.key,target.length).draft;
 assert.equal(checkpoint.trend,undefined,'live draft checkpoints never store frames');
 const writes=store.calls.length;
 await first.stop();assert.equal(store.calls.length,writes+1);
 const finished=first.history.loadDraft(store,first.key,target.length).draft;
 assert.equal(finished.id,checkpoint.id);
 assert.equal(finished.trend.reference,442);
 assert.ok(finished.trend.data.length>=8);
 assert.equal(store.data.size,1,'no per-key/trace store');
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
 assert.match(details.children[1].textContent,/尚無可顯示/);
 assert.equal(first.history.loadDraft(store,first.key,target.length).draft.id,finished.id);
});

test('corrupt trace provenance is ignored, preserving the dot draft and leaving an honest missing-trace placeholder',async()=>{
 const store=memory(), first=build(store);
 await first.start();first.play(36,21,30);await first.stop();
 const slot=[...store.data.keys()][0], valid=store.data.get(slot);
 for(const corrupt of [raw=>{raw.trend.draftId='different';},raw=>{raw.trend.mode='single';},
  raw=>{raw.trend.reference=440;},raw=>{raw.trend.points[0][2]=999;}]){
  const raw=JSON.parse(valid);assert.ok(raw.trend);corrupt(raw);store.data.set(slot,JSON.stringify(raw));
  const next=build(store);
  const draft=next.history.loadDraft(store,next.key,target.length).draft;
  assert.equal(draft.trend,undefined);assert.equal(next.nodes[0].dataset.practice,'matched');
  next.view.element.showPracticeCharts(true);
  const details=next.view.element.find('scale-pitch-trend');
  assert.match(details.children[1].textContent,/尚無可顯示/);
 }
});

test('a stale tab cannot overwrite the newer draft during subsequent live frames or final trace write',async()=>{
 const store=memory(), a=build(store,'major-C'), b=build(store,'major-F');
 await a.start();a.play(36,12,24);
 await b.start();b.play(36,-16,26);await b.stop();
 const recent=b.history.loadDraft(store,b.key,target.length).draft;
 assert.ok(recent.trend.data.length>0);
 a.play(38,9,20);await a.stop();
 assert.equal(a.history.loadDraft(store,a.key,target.length).exists,false);
 assert.equal(b.history.loadDraft(store,b.key,target.length).draft.id,recent.id);
 assert.deepEqual(b.history.loadDraft(store,b.key,target.length).draft.trend,recent.trend);
 assert.equal(a.state.hasUnsaved(),false);
});

test('trace quota pressure still updates the currently owned dot draft and never leaves invalid tuples',async()=>{
 const store=memory(), a=build(store,'major-C','scale','single');
 const set=store.setItem;
 store.setItem=function(k,v){if(JSON.parse(v).trend)throw Error('trace quota');return set.call(this,k,v);};
 await a.start();a.play(36,14,30);await a.stop();
 const draft=a.history.loadDraft(store,a.key,target.length).draft;
 assert.equal(draft.trend,undefined);
 assert.ok(Number.isFinite(draft.values[0]));
 assert.equal(a.state.needsExitWarning(),false);
 assert.equal(store.data.size,1);
});

test('merging dots does not remove trace and old tabs cannot reopen a superseded trace',async()=>{
 const store=memory(), first=build(store,'major-C','scale','single');
 await first.start();first.play(36,18,30);await first.stop();
 const draft=first.history.loadDraft(store,first.key,target.length).draft;
 assert.ok(draft.trend);
 assert.equal(first.state.save(),true);
 const merged=first.history.loadDraft(store,first.key,target.length).draft;
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
