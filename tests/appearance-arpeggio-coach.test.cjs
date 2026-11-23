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
  const root=new Node(), themeMeta=new Node(), select=new Node(), toggle=new Node();
  const media={matches, addListener(fn){this.changed=fn;}};
  const events={};
  const document={documentElement:root,querySelector:()=>themeMeta,getElementById:id=>id==='appearance-toggle'?toggle:select,
    addEventListener(k,fn){events[k]=fn;}};
  vm.runInNewContext(code('APPEARANCE'), {document,localStorage:store,matchMedia:()=>media});
  events.DOMContentLoaded();
  return {root,themeMeta,select,media,toggle,choice(val){select.value=val;select.handlers.change();}};
}
test('appearance keeps light default, persists manual choice, follows system only when selected, and works with denied storage',()=>{
  const store=memory(), page=appearance(store,true);
  assert.equal(page.root.dataset.appearance,'light');
  page.toggle.handlers.click();
  assert.equal(page.root.dataset.appearance,'dark');
  assert.equal(page.toggle.attrs['aria-label'],'切換淺色模式');
  assert.equal(appearance(store,false).select.value,'dark');
  assert.equal(appearance(store,false).themeMeta.attrs.content,'#16191d');
  page.choice('system');
  assert.equal(page.root.dataset.appearance,'dark');
  page.media.matches=false;page.media.changed();
  assert.equal(page.root.dataset.appearance,'light');
  const blocked=appearance({},false);
  blocked.choice('dark');
  assert.equal(blocked.root.dataset.appearance,'dark');
  assert.match(html,/@media print\{\.theme-choice\{display:none\}\}/);
  assert.match(html,/@media screen\{\s*:root\[data-appearance=dark\]/);
});

function app(store=memory(), search='', response) {
  const document={hidden:false,createElement:()=>new Node(),querySelectorAll:()=>[],addEventListener(){}};
  const window={};
  const env=vm.createContext({document,window,performance,setInterval,clearInterval,localStorage:store,URLSearchParams,location:{pathname:'/experimental/',search}});
  vm.runInContext(fingerboard,env);
  vm.runInContext(code('PRACTICE_COACH'),env);
  vm.runInContext(code('SCALE_PRACTICE'),env);
  const hooks=env.CelloScalePractice, coach=env.CelloPracticeCoach;
  const key=['C',0,'C D E F G A B'];
  let callbacks, now=10, listens=0, requested;
  const capture={subscribe(listener){listens++;callbacks=listener;return ()=>{};}};
  const manager=hooks.manager({performance:{now:()=>now}},{
    capture,swiftCapture:capture,
    reference:()=>442,
    pitchReading:midi=>({midi,cents:midi===40?28:-12}),
    pitchName:String
  });
  coach.service=()=>({isBusy:()=>false,cancel(){},dispose(){},async run(options,progress,config={}){
    requested=options;return response ? response(options,progress,config) : {advice:{steps:['停弓一拍，把下一音的手指先放好。','把這兩音接起來，連做三次。'],check:'再連拉一次，聽第二音起音是否平順。'}};
  }});
  function card(kind){
    const notes=window.CelloFingerboard.scoreNotes('major',key,kind==='arpeggio');
    const target=notes.map(n=>({...n,octave:Math.floor(n.midi/12)-1}));
    return hooks.card({querySelectorAll:()=>target.map(()=>new Node())},target,v=>manager.toggle(v),kind,'scope');
  }
  return {store,card,start:async view=>{await manager.toggle(view);callbacks.ready();},
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
  assert.match(coachOutput(panel),/C2.*E2.*停弓一拍.*起音是否平順.*智慧.*A4 442/);
  assert.equal(panel.find('scale-practice-coach-tip').children[3].children.length,2);
  const reloaded=app(p.store,'');
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
  assert.equal(p.requested.measured,0,'empty current take never sends old measured values');
  assert.doesNotMatch(coachOutput(panel),/上次保留的音準圖|C2|E2/);

});

test('experimental page has no coach setting and does not run it before an explicit ask',()=>{
  const p=app(memory(),'');
  assert.equal(p.card('arpeggio').element.find('scale-practice-coach').hidden,true);
  assert.equal(p.card('scale').element.find('scale-practice-coach').hidden,true);
  assert.equal(p.requested,undefined);
  assert.doesNotMatch(html,/id="practice-coach-(?:enable|disable|opt-in)"/);
});

test('the model retries once under the same action after the natural context boundary', async()=>{
 for(const kind of ['scale','arpeggio']){
  const calls=[];
  const p=app(memory(),'',(options,_progress,config)=>{
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
  assert.match(coachOutput(panel),/C2/);
  assert.doesNotMatch(coachOutput(panel),/D2|E2|未對上/);
 }
});
test('typing bubble reflects inference rather than downloads and is removed on an error',async()=>{
 let report, done;
 const p=app(memory(),'',(_options,progress)=>{
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
  const p=app(memory(),'',(options,_progress,config)=>{
   assert.equal(options.measured,0);
   assert.match(options.focus,/第一個譜音/);
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
