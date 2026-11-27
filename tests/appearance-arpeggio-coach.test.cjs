const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'), vm=require('node:vm'), path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const fingerboard=fs.readFileSync(path.join(__dirname,'../fingerboard.js'),'utf8');
const code=name=>html.split('// '+name+'_START')[1].split('// '+name+'_END')[0];
class Node {
  constructor(){this.children=[];this.dataset={};this.style={setProperty(){}};this.handlers={};this.attrs={};}
  append(...xs){this.children.push(...xs);}
  insertBefore(x,other){this.children.splice(this.children.indexOf(other),0,x);}
  addEventListener(k,v){this.handlers[k]=v;}
  setAttribute(k,v){this.attrs[k]=v;}
  set textContent(v){this.text=v;this.children=[];}
  get textContent(){return this.text;}
  find(cls){return this.className?.split(' ').includes(cls)?this:this.children.map(child=>child.find(cls)).find(Boolean);}
}
const memory=()=>{const m=new Map();return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};};
function appearance(store, matches) {
  const root=new Node(), themeMeta=new Node(), toggle=new Node();
  const media={matches, addListener(fn){this.changed=fn;}};
  const events={};
  const document={documentElement:root,querySelector:()=>themeMeta,getElementById:id=>id==='appearance-toggle'?toggle:null,
    addEventListener(k,fn){events[k]=fn;}};
  vm.runInNewContext(code('APPEARANCE'), {document,localStorage:store,matchMedia:()=>media});
  events.DOMContentLoaded();
  return {root,themeMeta,media,toggle};
}
test('appearance keeps light default, persists manual choice, follows system only when selected, and works with denied storage',()=>{
  const store=memory(), page=appearance(store,true);
  assert.equal(page.root.dataset.appearance,'light');
  page.toggle.handlers.click();
  assert.equal(page.root.dataset.appearance,'dark');
  assert.equal(page.toggle.attrs['aria-label'],'切換淺色模式');
  assert.equal(appearance(store,false).root.dataset.appearance,'dark');
  assert.equal(appearance(store,false).themeMeta.attrs.content,'#16191d');
  store.setItem('cello-experimental-appearance','system');
  const legacy=appearance(store,true);
  assert.equal(legacy.root.dataset.appearance,'dark');
  legacy.media.matches=false;legacy.media.changed();
  assert.equal(legacy.root.dataset.appearance,'light');
  const blocked=appearance({},false);
  blocked.toggle.handlers.click();
  assert.equal(blocked.root.dataset.appearance,'dark');
  assert.doesNotMatch(html,/appearance-choice|footer-theme/);
  assert.match(html,/\.local-audio-note\{[^}]*text-align:left;align-self:flex-start/);
  assert.match(html,/@media screen\{\s*:root\[data-appearance=dark\]/);
});

test('global action is compact with the lower height; filled score primary applies only to idle scale/arpeggio',()=>{
  assert.match(html,/\.launch-controls\{\s*grid-template-columns:clamp\(6\.5rem,27vw,8\.25rem\) minmax\(0,1fr\);/);
  assert.match(html,/\.launch-controls #draw-button\{\s*width:100%;max-inline-size:8\.25rem;min-block-size:3\.75rem/);
  assert.match(html,/\.scale-practice\[data-phase=idle\]>\.scale-practice-action \.scale-start-shell>\.scale-practice-button\{\s*background:var\(--score-start-fill\)/);
  assert.match(html,/\[data-appearance=dark\] \.scale-practice\{--score-start-fill:#363d46/);
});

function app(store=memory(), search='?aiCoach=1', response) {
  const events={},docEvents={};
  const document={hidden:false,createElement:()=>new Node(),querySelectorAll:()=>[],addEventListener(name,run){docEvents[name]=run;}};
  const window={};
  const env=vm.createContext({document,window,addEventListener(name,run){events[name]=run;},performance,setInterval,clearInterval,localStorage:store,URLSearchParams,location:{pathname:'/experimental/',hostname:'localhost',search}});
  vm.runInContext(fingerboard,env);
  vm.runInContext(code('PRACTICE_COACH'),env);
  vm.runInContext(code('SCALE_PRACTICE'),env);
  const hooks=env.CelloScalePractice, coach=env.CelloPracticeCoach;
  const key=['C',0,'C D E F G A B'];
  let callbacks, now=10, listens=0, requested, disposals=0, cancellations=0;
  const capture={subscribe(listener){listens++;callbacks=listener;return ()=>{};}};
  const manager=hooks.manager({performance:{now:()=>now}},{
    capture,swiftCapture:capture,detector:()=>'swift',
    reference:()=>442,
    pitchReading:midi=>({midi,cents:midi===40?28:-12}),
    pitchName:String
  });
  coach.service=()=>({isBusy:()=>false,cancel(){cancellations++;},dispose(){disposals++;},async run(options,progress,config={}){
    requested=options;return response ? response(options,progress,config) : {advice:{steps:['停弓一拍，把下一音的手指先放好。','把這兩音接起來，連做三次。'],check:'再連拉一次，聽第二音起音是否平順。'}};
  }});
  function card(kind){
    const notes=window.CelloFingerboard.scoreNotes('major',key,kind==='arpeggio');
    const target=notes.map(n=>({...n,octave:Math.floor(n.midi/12)-1}));
    return hooks.card({querySelectorAll:()=>target.map(()=>new Node())},target,v=>manager.toggle(v),kind,'scope');
  }
  return {store,card,visibility(hidden){document.hidden=hidden;docEvents.visibilitychange?.();},
    pagehide(persisted){events.pagehide?.({persisted});},get disposals(){return disposals;},get cancellations(){return cancellations;},start:async view=>{await manager.toggle(view);callbacks.ready();},
    stop:view=>manager.toggle(view),play(midi){for(let i=0;i<5;i++)callbacks.frame({now:now+=25,frequency:midi,muted:false});},
    get listens(){return listens;},get requested(){return requested;}};
}
const coachOutput=panel=>{const flatten=n=>[n.textContent,...n.children.map(flatten)].join(' ');return flatten(panel.find('scale-practice-coach-tip')).trim();};
test('actual arpeggio manager/card reveals its own measured coaching only after stopping',async()=>{
  const p=app(), arp=p.card('arpeggio'), scale=p.card('scale');
  const panel=arp.element.find('scale-practice-coach');
  assert.equal(panel.hidden,true);
  await p.start(arp);
  for(const midi of [36,40,43,48]) p.play(midi); // opening C2, E2, G2, C3
  assert.equal(panel.hidden,true);
  await p.stop(arp);
  assert.equal(panel.hidden,false);
  assert.equal(scale.element.find('scale-practice-coach').hidden,true);
  const button=panel.find('scale-practice-coach-action');
  await button.handlers.click();
  assert.equal(p.requested.exercise,'琶音');
  assert.match(p.requested.coverage,/本次練習.*4／13.*空白不代表拉錯/);
  assert.match(p.requested.report,/C2.*−12¢.*黃[\s\S]*E2.*\+28¢.*紅/);
  assert.equal(p.requested.rows.length,13);
  const proof=panel.find('scale-practice-coach-raw-details');
  proof.open=true;proof.handlers.toggle();
  assert.match(proof.children.at(-1).textContent,/時間走勢：[0-9]+ 個保留資料點/);
  assert.ok(proof.children.at(-1).textContent.startsWith(p.requested.report));
  assert.match(coachOutput(panel),/空白不代表拉錯/);

  assert.match(coachOutput(panel),/停弓一拍.*起音是否平順.*智慧.*A4 442/);
  assert.equal(panel.find('scale-practice-coach-steps').children.length,2);
  const reloaded=app(p.store,'?aiCoach=1');
  const restored=reloaded.card('arpeggio');
  assert.equal(reloaded.card('scale').element.find('scale-practice-coach').hidden,true);
  assert.equal(restored.element.find('scale-practice-coach').hidden,false,'latest exact arpeggio draft restores advice');
  assert.equal(reloaded.listens,0);
  assert.equal(reloaded.requested,undefined);
  const restoredPanel=restored.element.find('scale-practice-coach');
  await restoredPanel.find('scale-practice-coach-action').handlers.click();
  assert.ok(reloaded.requested.measured>0);
  assert.match(coachOutput(restoredPanel),/上次量到什麼.*上次保留的音準圖/);

  await p.start(arp);
  assert.equal(panel.hidden,true,'new take hides previous advice while listening');
  await p.stop(arp);
  assert.equal(panel.hidden,false,'an empty take restores existing measured draft without replacing it');
  assert.match(arp.element.find('scale-practice-status').textContent,/上次|未辨識/);
  await button.handlers.click();
  assert.ok(p.requested.measured>0,'explicit advice request acts on the displayed older graph');
  assert.match(coachOutput(panel),/上次保留的音準圖/);

});

test('experimental page has no coach setting and does not run it before an explicit ask',()=>{
  const p=app(memory(),'?aiCoach=1');
  assert.equal(p.card('arpeggio').element.find('scale-practice-coach').hidden,true);
  assert.equal(p.card('scale').element.find('scale-practice-coach').hidden,true);
  assert.equal(p.requested,undefined);
  assert.doesNotMatch(html,/id="practice-coach-(?:enable|disable|opt-in)"/);
});

test('the model retries once under the same action after the natural context boundary', async()=>{
 for(const kind of ['scale','arpeggio']){
  const calls=[];
  const p=app(memory(),'?aiCoach=1',(options,_progress,config)=>{
   calls.push(config);return config.direct?{advice:{steps:['這個音各拉兩拍，重複三次。'],check:'再拉一次，聽起音是否清楚。'}}:{reason:'context'};
  });
  const view=p.card(kind),panel=view.element.find('scale-practice-coach');
  await p.start(view);p.play(36);await p.stop(view);
  const action=panel.find('scale-practice-coach-action');await action.handlers.click();
  assert.equal(p.requested.measured,1);
  assert.equal(calls.length,2);
  assert.equal(calls[0].direct,undefined);
  assert.equal(calls[1].direct,true);
  assert.equal(panel.find('scale-practice-coach-quick'),undefined);
  assert.equal(action.textContent,'練習建議');
  assert.equal(panel.find('scale-practice-coach-status').textContent,'');
  assert.match(panel.find('scale-practice-coach-elapsed').textContent,/^耗時 [0-9.]+ 秒$/);
  assert.doesNotMatch(coachOutput(panel),/Qwen3/);
  assert.match(p.requested.report,/C2.*[¢]/);
  assert.doesNotMatch(coachOutput(panel),/D2|E2|未對上/);
 }
});
test('typing bubble reflects inference rather than downloads and is removed on an error',async()=>{
 let report, done;
 const p=app(memory(),'?aiCoach=1',(_options,progress)=>{
  report=progress;
  return new Promise(resolve=>{done=resolve;});
 });
 const view=p.card('scale'),panel=view.element.find('scale-practice-coach');
 await p.start(view);p.play(36);await p.stop(view);
 const action=panel.find('scale-practice-coach-action'), bubble=panel.find('scale-practice-coach-typing');
 const result=action.handlers.click();
 assert.equal(action.textContent,'中斷');
 report('weights',15);
 assert.equal(bubble.hidden,true);
 assert.match(panel.find('scale-practice-coach-status').textContent,/15%/);
 report('working');
 assert.equal(bubble.hidden,false);
 assert.equal(bubble.children.length,3);
 assert.equal(bubble.attrs['aria-hidden'],'true');
 assert.match(panel.children.find(n=>n.className.includes('sr-only')).textContent,/正在撰寫/);
 done({reason:'error'});await result;
 assert.equal(bubble.hidden,true);
 assert.equal(action.textContent,'練習建議');
 assert.match(panel.find('scale-practice-coach-status').textContent,/無法執行.*重試/);
 assert.match(html,/@media\(prefers-reduced-motion:reduce\)\{\.scale-practice-coach-typing span\{animation:none\}/);
});

test('after recording nothing, the only coach action sends synthetic facts and needs a model selection',async()=>{
 for(const kind of ['scale','arpeggio']){
  let selected=true;
  const p=app(memory(),'?aiCoach=1',(options,_progress,config)=>{
   assert.equal(options.measured,0);
   assert.match(options.report,/沒有辨識到可用音符/);
   return selected ? {advice:{steps:['先開調音器，拉第一個譜音兩秒。'],check:'確認畫面出現音名，再回到練習。'}} : {reason:'unsupported'};
  });
  const view=p.card(kind),panel=view.element.find('scale-practice-coach');
  assert.equal(panel.hidden,true);
  await p.start(view);p.play(99);await p.stop(view);
  assert.equal(panel.hidden,false);
  const action=panel.find('scale-practice-coach-action');
  assert.equal(action.hidden,false);
  assert.match(panel.find('scale-practice-coach-status').textContent,/沒有辨識到可用音符.*練習建議/);
  assert.equal(p.requested,undefined);
  await action.handlers.click();
  assert.match(coachOutput(panel),/無法判斷音準.*先開調音器/);
  assert.doesNotMatch(coachOutput(panel),/442|A4|音分/);
  selected=false;await action.handlers.click();
  assert.equal(coachOutput(panel),'');
  assert.match(panel.find('scale-practice-coach-status').textContent,/WebGPU/);
 }
});

test('both real off-format examples and a truncated response stay literal and never auto-retry',async()=>{
 const raws=[
  '練法：拍數或次數：5次，左右手交替拍，注意音連\n練法：拍數或次數：6次，左右手配合拍，注意音連\n重測：拍數或次數：5次，左右手交替拍，注意音連',
  JSON.stringify({steps:['練法：分開拉弓，停住弓再準備手指，把音連起來','重測：用耳朵或音準圖檢查'],check:'用耳朵或音準圖檢查'}),
  '  這段沒完\n<img src=x onerror="boom">  <a href="https://example.com/">link</a>  '
 ];
 for(const [i,raw] of raws.entries()){
  let calls=0;
  const p=app(memory(),'?aiCoach=1',()=>{calls++;return {raw,reason:i===2?'context':'invalid',partial:i===2};});
  const view=p.card('scale'),panel=view.element.find('scale-practice-coach');
  await p.start(view);p.play(36);await p.stop(view);
  await panel.find('scale-practice-coach-action').handlers.click();
  assert.equal(calls,1);
  const literal=panel.find('scale-practice-coach-literal');
  assert.equal(literal.textContent,raw);
  assert.deepEqual(literal.children,[]);
  assert.match(panel.find('scale-practice-coach-status').textContent,i===2?/尚未寫完/:/未整理/);
  assert.match(panel.find('scale-practice-coach-elapsed').textContent,/耗時/);
 }
});
test('pending coach survives app hide/show and cached pagehide, but not a real page exit',async()=>{
 let finish;
 const raw='練法：先分弓把兩音拉清楚。\n重測：聽音與音交接有沒有變順。';
 const p=app(memory(),'?aiCoach=1',()=>new Promise(resolve=>{finish=resolve;}));
 const view=p.card('scale'),panel=view.element.find('scale-practice-coach');
 await p.start(view);p.play(36);await p.stop(view);
 const answer=panel.find('scale-practice-coach-action').handlers.click();
 p.visibility(true);p.pagehide(true);p.visibility(false);
 assert.equal(p.disposals,0);assert.equal(p.cancellations,0);
 finish({advice:{steps:['先分弓把兩音拉清楚。'],check:'聽音與音交接有沒有變順。'},raw});
 await answer;
 assert.match(coachOutput(panel),/可以這樣練.*分弓/);
 const disclosure=panel.find('scale-practice-coach-raw-details');
 assert.equal(disclosure.open,undefined);
 assert.equal(disclosure.children[0].textContent,'原始回覆');
 assert.equal(disclosure.find('scale-practice-coach-literal').textContent,raw);
 p.pagehide(false);assert.equal(p.disposals,1);
});
