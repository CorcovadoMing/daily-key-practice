const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const moduleBox = {module:{exports:{}}};
vm.runInNewContext(html.split('// SCALE_PRACTICE_START')[1].split('// SCALE_PRACTICE_END')[0],moduleBox);
const {resolveMidpoint,align,trackNotes,manager,micCapture,metronomeClickGate,chartPoint,centsText,scoreValues,monitorPitch,liveSlot} = moduleBox.module.exports;
const audio = {module:{exports:{}}};
vm.runInNewContext(html.split('// AUDIO_TOOLS_START')[1].split('// AUDIO_TOOLS_END')[0],audio);
const {pitchReading,detectPitch} = audio.module.exports;
const tone = (midi, cents=0) => ({midi,cents});
const target = [36,38,40,41,43,45,47,48,47,45,43,41,40,38,36].map(midi=>tone(midi));
const json = value => JSON.parse(JSON.stringify(value));
test('full alignment removes false starts, wrong pitches, and repeats without compressing required turns',()=>{
  const heard = [tone(49),tone(36,30),tone(36,3),tone(29),...target.slice(1,8),tone(49),...target.slice(8,-1),tone(36,30),tone(36,2)];
  const r = align(target, heard);
  assert.equal(r.complete,true);
  assert.equal(r.extra,5);
  assert.equal(r.pairs[0].heard,2);
  assert.equal(r.pairs.at(-1).heard,heard.length-1);
});
test('missing, swapped, wrong-octave, and detuned notes cannot substitute',()=>{
  for (const heard of [
    target.filter((_,i)=>i!==5),
    target.map((n,i)=>i===5?target[6]:i===6?target[5]:n),
    target.map((n,i)=>i===5?tone(n.midi+12):n),
    target.map((n,i)=>i===5?tone(n.midi,51):n)
  ]) {
    const r=align(target,heard);
    assert.equal(r.complete,false);
    assert.equal(r.pairs.length,14);
    assert.equal(r.missing.length,1);
  }
  assert.deepEqual(json(align([tone(40),tone(40)], [tone(40)]).missing), [1]);
  assert.equal(align([],[]).complete,false);
});
test('debounce noise and vibrato; count rearticulation after a clear rest',()=>{
  const push=trackNotes();
  const input=[
    [tone(36),0],[tone(36,16),27],[tone(36,-19),54],[tone(36,10),81],
    [tone(36,-21),108],[tone(37),135],[tone(36),162],[null,189],[tone(36),216],
    [null,243],[null,270],[null,297],[null,324],[null,351],[null,378],
    [tone(36),405],[tone(36),432],[tone(36),459],[tone(36),486]
  ];
  assert.deepEqual(json(input.map(e=>push(...e)).filter(Boolean).map(e=>e.midi)),[36,36]);
});
test('synthetic C2 and top of score are recognized with A4=442',()=>{
  for (const midi of [36,37,47,60,71]) {
    const hz=442*2**((midi-69)/12);
    const sample=Float32Array.from({length:4096},(_,i)=>{
      const p=2*Math.PI*hz*i/48000;
      return .12*Math.sin(p)+.07*Math.sin(2*p)+.05*Math.sin(3*p);
    });
    const r=pitchReading(detectPitch(sample,48000),442);
    assert.equal(r.midi,midi);
    assert.ok(Math.abs(r.cents)<5);
  }
});
function fixture() {
  let time=0, frequency=0, callback=null, permit, error=null;
  const track={stopCalls:0, stop(){this.stopCalls++;}, muted:false};
  const stream={getTracks:()=>[track],getAudioTracks:()=>[track]};
  const resources={disconnects:0,closes:0,prompts:0,reads:0};
  class AudioContext{
    state='running'; sampleRate=48000;
    resume(){return Promise.resolve();}
    close(){resources.closes++;return Promise.resolve();}
    createMediaStreamSource(){return {connect(){},disconnect(){resources.disconnects++;}};}
    createAnalyser(){return {fftSize:4096,getFloatTimeDomainData(){resources.reads++;},disconnect(){resources.disconnects++;}};}
  }
  const env={AudioContext,isSecureContext:true,navigator:{mediaDevices:{getUserMedia:()=>{
    resources.prompts++;
    if(error)return Promise.reject(error);
    return new Promise(r=>permit=()=>r(stream));
  }}},performance:{now:()=>time},setTimeout:(...args)=>setTimeout(...args).unref(),clearTimeout,
    setInterval:f=>{callback=f;return 1;},clearInterval:()=>{callback=null;}};
  const calls=[], view={target,mode:"single",element:{},update(...args){calls.push(args);}};
  const capture=micCapture(env,()=>frequency,.0003);
  const m=manager(env,{capture,reference:()=>442,pitchReading,pitchName:String});
  return {m,view,calls,track,resources,capture,grant:()=>permit(),reject:e=>error=e,
    play:(midi,cents=0)=>{
      frequency=midi?442*2**((midi-69+cents/100)/12):0;
      for(let i=0;i<5;i++){time+=27;callback?.();}
    }};
}
test('permission canceled before grant releases returned stream and never starts',async()=>{
  const f=fixture(), starting=f.m.toggle(f.view);
  assert.equal(f.calls.at(-1)[0],'pending');
  await f.m.toggle(f.view);
  f.grant();await starting;
  assert.equal(f.track.stopCalls,1);
  assert.equal(f.resources.closes,1);
  assert.ok(!f.calls.some(x=>x[0]==='listening'));
});
test('denied permission is visible and closes context',async()=>{
  const f=fixture();
  f.reject({name:'NotAllowedError'});
  await f.m.toggle(f.view);
  await new Promise(setImmediate);
  assert.match(f.calls.at(-1)[1],/未取得麥克風權限/);
  assert.equal(f.resources.closes,1);
  assert.equal(f.track.stopCalls,0);
});
test('capture accepts the whole attempt, grades on stop and cleans every resource',async()=>{
  const f=fixture(), starting=f.m.toggle(f.view);
  f.grant();await starting;
  f.play(35);f.play(0);
  for(const n of target.slice(0,-1))f.play(n.midi);
  f.play(49); // Extra audio before the final tonic stays in the same attempt.
  assert.equal(f.calls.at(-1)[0],'listening');
  f.play(target.at(-1).midi);
  const [phase,,result]=f.calls.at(-1);
  assert.equal(phase,'idle');
  assert.equal(result.complete,true);
  assert.equal(result.extra,2);
  assert.equal(f.resources.disconnects,2);
  assert.equal(f.resources.closes,1);
  assert.equal(f.resources.prompts,1);
  assert.equal(f.track.stopCalls,1);
});
test('hidden-card interruption stops rather than scoring a partial take',async()=>{
  const f=fixture(), starting=f.m.toggle(f.view);
  f.grant();await starting;
  f.play(36);
  f.m.stopWithin({contains:entry=>entry===f.view.element});
  assert.match(f.calls.at(-1)[1],/已離開/);
  assert.equal(f.calls.at(-1)[2],null);
  assert.equal(f.track.stopCalls,1);
});

test('chart cents positions are signed, centered and bounded without fabricating missing points',()=>{
  assert.deepEqual(json([-65,-45,0,26,60,null].map(x=>chartPoint(x)?.y??null)),[100,95,50,24,0,null]);
  assert.deepEqual([0,-0.1,25,-18,null].map(centsText),['0¢','0¢','+25¢','−18¢','—']);
  assert.equal(chartPoint(7).band,'center');
  assert.equal(chartPoint(-14).band,'near');
  assert.equal(chartPoint(45).band,'outside');
});
test('visual and scoring accept +45¢ in the original octave',async()=>{
  const f=fixture(), starting=f.m.toggle(f.view);
  f.grant();await starting;
  f.play(36,45);
  let [phase,,,progress,,visual]=f.calls.at(-1);
  assert.equal(phase,'listening');assert.equal(progress,1);
  assert.equal(visual.live.slot,0);assert.equal(Math.round(visual.live.cents),45);
  assert.equal(Math.round(visual.values[0]),45);
  f.play(36,16);f.play(36,-17);
  [, , , progress,,visual]=f.calls.at(-1);
  assert.equal(progress,1);
  assert.equal(Math.round(visual.values[0]),45);
  assert.equal(visual.live.slot,0);assert.equal(Math.round(visual.live.cents),-17);
  f.play(0); f.play(0);
  [, , , progress,,visual]=f.calls.at(-1);
  assert.equal(progress,1);assert.equal(visual.live,null);
  assert.equal(Math.round(visual.values[0]),45);
  f.play(39,14);
  [, , , progress,,visual]=f.calls.at(-1);
  assert.equal(progress,1);assert.equal(visual.live.slot,null);
  assert.equal(Math.round(visual.live.cents),14);
  f.m.stop();
});
test('visual median does not confuse a single intrusion with a new held pitch',()=>{
  const observe=monitorPitch();
  assert.equal(observe(tone(36,10),0),null);
  assert.equal(observe(tone(36,11),27),null);
  assert.deepEqual(json(observe(tone(36,12),54)),tone(36,11));
  assert.equal(observe(tone(37,4),81).midi,36);
  assert.equal(observe(tone(36,7),108).midi,36);
  assert.equal(observe(tone(36,8),135).midi,36);
  assert.deepEqual(json(observe(tone(36,9),162)),tone(36,8));
  assert.equal(observe(null,303),null);
  assert.equal(liveSlot(target,1,tone(36,-9),{midi:36,slot:0}),0);
  assert.equal(liveSlot(target,1,tone(50),null),null);
});
test('final slots follow weighted pairs, prefer a cleaner take and preserve missing score positions',()=>{
  const expected=[tone(36),tone(38),tone(40),tone(41)];
  const heard=[tone(36,37),tone(36,-6),tone(39,1),tone(40,4),tone(41,-17)];
  const result=align(expected,heard);
  assert.equal(result.complete,false);
  assert.deepEqual(json(scoreValues(expected,heard,result)),[-6,null,4,-17]);
});


test('two subscribers share one permission prompt and one audio analysis per frame',async()=>{
  const f=fixture(), updates=[];
  const start=f.m.toggle(f.view);
  const release=f.capture.subscribe({ready(){updates.push('ready')},frame(r){updates.push(r.frequency)},error:e=>assert.fail(e)});
  f.grant();await start;
  f.play(36);
  assert.equal(f.resources.prompts,1);
  assert.equal(f.resources.reads,5);
  assert.equal(updates.length,6);
  assert.equal(f.calls.at(-1)[0],'listening');
  f.m.stop();
  assert.equal(f.track.stopCalls,0);
  f.play(38);
  assert.equal(f.resources.reads,10);
  assert.equal(updates.length,11);
  release();
  assert.equal(f.track.stopCalls,1);
  assert.equal(f.resources.closes,1);
});
test('last pending cancel and immediate restart reuse one request with a fresh context',async()=>{
  const f=fixture();
  const noop={ready(){},frame(){},error:e=>assert.fail(e)};
  const first=f.capture.subscribe(noop);
  first();
  assert.equal(f.resources.closes,1);
  const second=f.capture.subscribe(noop);
  f.grant();await new Promise(setImmediate);
  assert.equal(f.resources.prompts,1);
  assert.equal(f.track.stopCalls,0);
  second();assert.equal(f.track.stopCalls,1);
  assert.equal(f.resources.closes,2);
});
test('mic interruption releases both listeners and all owned resources',async()=>{
  const f=fixture(), updates=[];
  const start=f.m.toggle(f.view);
  f.capture.subscribe({ready(){},frame(){},error:e=>updates.push(e)});
  f.grant();await start;f.track.onended();
  assert.match(updates[0],/麥克風已中斷/);
  assert.match(f.calls.at(-1)[1],/麥克風已中斷/);
  assert.equal(f.track.stopCalls,1);
  assert.equal(f.resources.closes,1);
});
test('short near-click estimates are filtered without beat gating other notes',()=>{
  const gate=metronomeClickGate();
  for(const x of [850,843,856,1200,1193,1209])assert.ok(gate(x,0,true),x);
  for(const x of [66,110,147,221,493,600,831,880,1175,1244])assert.equal(gate(x,27,true),false,x);
  assert.equal(gate(850,27,false),false,'mute or stopped metronome never filters');
});
test('a sustained note near a click (A♭5 +20¢ at A442) passes after the short guard',()=>{
  const gate=metronomeClickGate(), frequency=442*2**((11+.2)/12);
  assert.ok(frequency>843&&frequency<846);
  for(let ms=0;ms<160;ms+=27)assert.equal(gate(frequency,ms,true),true);
  assert.equal(gate(frequency,162,true),false);
  assert.equal(gate(frequency,189,true),false);
  assert.equal(gate(null,216,true),false);
  assert.equal(gate(frequency,243,true),true,'silence resets the transient length');
});

test('arpeggio matching resolves exact half-semitone to score, not 50.01 cents',()=>{
  const expected=[tone(69),tone(72)];
  for(const sign of [1,-1]) {
    const convert=(midi,cents)=>pitchReading(442*2**((midi-69+cents/100)/12),442);
    const near=resolveMidpoint(convert(69,sign*50),69,null);
    assert.equal(align(expected,[near,convert(72,0)]).complete,true);
    assert.equal(align(expected,[convert(69,sign*50.01),convert(72,0)]).complete,false);
    const push=trackNotes();
    for(const ms of [0,27,54])assert.equal(push(near,ms),null);
    assert.equal(push(near,81).midi,69);
  }
});

const cMajorArpeggio = [36,40,43,48,52,55,60,55,52,48,43,40,36].map(midi=>tone(midi));
test('switch scale ↔ arpeggio keeps one mic session but grades only selected score notes',async()=>{
  const f=fixture(), arpeggioCalls=[];
  const arpeggio={target:cMajorArpeggio,mode:'single',element:{},update(...args){arpeggioCalls.push(args);}};
  const start=f.m.toggle(f.view);
  f.grant();await start;
  f.play(38); // Must not be added to the succeeding arpeggio take.
  await f.m.toggle(arpeggio);
  assert.match(f.calls.at(-1)[1],/已切換到另一項練習/);
  assert.equal(f.calls.at(-1)[2],null);
  assert.equal(f.track.stopCalls,0);
  assert.equal(f.resources.prompts,1);
  assert.equal(arpeggioCalls.at(-1)[0],'listening');
  f.play(37); // An inserted wrong note does not substitute for a miss.
  for(const n of cMajorArpeggio)f.play(n.midi);
  const final=arpeggioCalls.at(-1)[2];
  assert.equal(final.complete,true);
  assert.equal(final.pairs.length,13);
  assert.equal(final.extra,1);
  assert.equal(f.track.stopCalls,1);
});
test('switching practice mode while permission is pending still makes one request',async()=>{
  const f=fixture(), arpeggioCalls=[];
  const arpeggio={target:cMajorArpeggio,mode:'single',element:{},update(...args){arpeggioCalls.push(args);}};
  await f.m.toggle(f.view);
  await f.m.toggle(arpeggio);
  assert.equal(f.resources.prompts,1);
  assert.match(f.calls.at(-1)[1],/已切換到另一項練習/);
  f.grant();await new Promise(setImmediate);
  assert.equal(arpeggioCalls.at(-1)[0],'listening');
  assert.equal(f.track.stopCalls,0);
  f.m.stop();
  assert.equal(f.track.stopCalls,1);
});
test('arpeggios use distinct kind labels, chart and results without changing button copy',()=>{
  class Node {
    constructor(){this.children=[];this.dataset={};this.attributes={};this.style={setProperty(){}};this.textContent='';}
    append(...children){this.children.push(...children);}
    setAttribute(key,f){this.attributes[key]=f;}
    addEventListener(){}
  }
  const standalone={module:{exports:{}},document:{createElement:()=>new Node()}};
  vm.runInNewContext(html.split('// SCALE_PRACTICE_START')[1].split('// SCALE_PRACTICE_END')[0],standalone);
  const heads=cMajorArpeggio.map(()=>new Node());
  const view=standalone.module.exports.card({querySelectorAll:()=>heads},cMajorArpeggio,()=>{},'arpeggio');
  const [action,,status]=view.element.children;
  const [button]=action.children;
  assert.equal(view.element.dataset.practiceKind,'arpeggio');
  assert.equal(button.textContent,'開始練習');
  assert.equal(button.attributes['aria-label'],'開始琶音練習');
  view.update('pending');
  const chart=view.element.children.at(-1);
  assert.match(chart.attributes['aria-label'],/^琶音音準圖/);
  const grid=chart.children[1].children[1].children[0];
  assert.equal(grid.children.length,13);
  // A displayed-but-not-accepted pitch is a live cue, not a successful note.
  view.update('listening',null,null,0,442,{live:{slot:0,cents:45,name:'C2'},values:[],progress:0,listening:true});
  assert.equal(heads[0].dataset.practiceCurrent,'true','46¢ stable exact MIDI can color a score note');
  assert.equal(heads[0].dataset.practice,undefined);
  view.update('listening',null,null,1,442,{live:{slot:0,cents:0,name:'C2'},values:[0],progress:1,listening:true});
  assert.equal(heads[0].dataset.practice,'matched');
  view.update('listening',null,null,1,442,{live:{slot:null,cents:0,name:'C♯2'},values:[0],progress:1,listening:true});
  assert.ok(heads.every(n=>n.dataset.practiceCurrent===undefined),'unmapped notes may not color the next expected slot');
  assert.equal(heads[0].dataset.practice,'matched');
  view.update('listening',null,null,1,442,{live:{slot:1,cents:0,name:'E2'},values:[0],progress:1,listening:true});
  assert.equal(heads[1].dataset.practiceCurrent,'true');
  view.update('listening',null,null,1,442,{live:null,values:[0],progress:1,listening:true});
  assert.ok(heads.every(n=>n.dataset.practiceCurrent===undefined),'silence clears only the live cue');
  view.update('listening',null,null,1,442,{live:{slot:1,cents:0,name:'E2'},values:[0],progress:1,listening:true});
  const result=align(cMajorArpeggio,cMajorArpeggio);
  view.update('idle',null,result,0,442,{values:scoreValues(cMajorArpeggio,cMajorArpeggio,result),final:true});
  assert.ok(heads.every(n=>n.dataset.practiceCurrent===undefined),'finished takes cannot retain a live cue');
  assert.match(status.textContent,/琶音通過！/);
  assert.match(status.textContent,/13／13/);
  assert.equal(heads.filter(n=>n.dataset.practice==='matched').length,13);
});

test('all three cutoffs honor signed mathematical boundaries in both tracking and final alignment',()=>{
  for(const tolerance of [15,25,40])for(const sign of [-1,1]){
    const of=cents=>pitchReading(442*2**(sign*cents/1200),442);
    assert.equal(align([tone(69)],[of(tolerance)],tolerance).complete,true);
    assert.equal(align([tone(69)],[of(tolerance+.01)],tolerance).complete,false);
    const a=trackNotes({tolerance}), b=trackNotes({tolerance});
    for(const i of [0,27,54]) { assert.equal(a(of(tolerance),i),null); assert.equal(b(of(tolerance+.01),i),null); }
    assert.equal(a(of(tolerance),81).midi,69);
    assert.equal(b(of(tolerance+.01),81),null);
  }
  assert.equal(align([tone(69)],[tone(69,39)],99).complete,true,'unknown tolerance uses safe default');
  assert.equal(align([tone(69)],[tone(69,51)],99).complete,false);
});

test('the exercise snapshots mode before permission and always accepts up to ±50 cents',async()=>{
  const f=fixture();
  let mode='single';
  Object.defineProperty(f.view,'mode',{get:()=>mode});
  const started=f.m.toggle(f.view);
  assert.equal(f.calls.at(-1)[5].mode,'single');
  mode='loop';
  f.grant();await started;
  f.play(37,-49);
  assert.equal(f.calls.at(-1)[3],0);
  f.play(36,49);
  assert.equal(f.calls.at(-1)[3],1);
  for(const note of target.slice(1)) f.play(note.midi);
  const [, ,result, , ,display]=f.calls.at(-1);
  assert.equal(result.complete,true);
  assert.equal(display.mode,'single');
  assert.equal(Math.round(display.values[0]),49);
});

test('loop shares the descent tonic, layers identical positions, and preserves a partial round on stop',async()=>{
  const f=fixture();
  f.view.mode='loop';
  const started=f.m.toggle(f.view);
  f.grant();await started;
  target.forEach((note,i)=>f.play(note.midi,i===0 ? 8 : i===14 ? -14 : i===3 ? 11 : 0));
  let [,,,progress,,display]=f.calls.at(-1);
  assert.equal(display.laps,1);
  assert.equal(progress,1,'descending tonic is the next ascent start');
  assert.equal(Math.round(display.values[0]),-14);
  assert.deepEqual(json([...display.history[0].entries()]),[[8,1]]);
  assert.deepEqual(json([...display.history[14].entries()]),[[-14,1]]);
  target.slice(1).forEach((note,i)=>f.play(note.midi,i===2 ? 11 : 0));
  [,,,progress,,display]=f.calls.at(-1);
  assert.equal(display.laps,2);
  assert.equal(display.passed,2);
  assert.deepEqual(json([...display.history[0].entries()]),[[8,1],[-14,1]]);
  assert.deepEqual(json([...display.history[3].entries()]),[[11,2]]);
  assert.equal(progress,1);
  f.play(target[1].midi,-7);
  await f.m.toggle(f.view);
  const [phase,,result,,,last]=f.calls.at(-1);
  assert.equal(phase,'idle');
  assert.equal(result.complete,false);
  assert.equal(last.laps,2);
  assert.equal(Math.round(last.values[1]),-7);
  assert.deepEqual(json([...last.history[3].entries()]),[[11,2]]);
  assert.equal(f.resources.prompts,1);
  assert.equal(f.track.stopCalls,1);
});

test('loop can recover one omitted ascent note without falsely accepting an early stray tonic',async()=>{
  const f=fixture();f.view.mode='loop';
  const start=f.m.toggle(f.view);f.grant();await start;
  [36,38,40,36].forEach(midi=>f.play(midi));
  assert.equal(f.calls.at(-1)[5].laps,0);
  target.slice(3).filter((_,i)=>i!==2).forEach(note=>f.play(note.midi));
  const display=f.calls.at(-1)[5];
  assert.equal(display.laps,1);
  assert.equal(display.passed,0);
  assert.equal(display.history[5].size,0);
  assert.equal(display.progress,1);
  await f.m.toggle(f.view);
  const [,,result,,,last]=f.calls.at(-1);
  assert.equal(result,null,'shared tonic alone is not a new incomplete take');
  assert.equal(last.laps,1);
  assert.equal(last.values[5],null);
});

test('native practice-mode selection persists and syncs scale/arpeggio without starting their mic',()=>{
  const mounted=[];
  class Node {
    constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.attributes={};this.handlers={};this.style={setProperty(){}};this.textContent='';}
    append(...children){this.children.push(...children);}
    setAttribute(key,f){this.attributes[key]=f;}
    addEventListener(name,fn){this.handlers[name]=fn;}
    querySelector(sel){return this.children.find(node=>sel[0]==='.'?node.className===sel.slice(1):node.tag===sel);}
  }
  const key='daily-key-practice:experimental:practice-mode';
  const storage=new Map();
  const localStorage={getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)};
  const document={createElement:tag=>{const el=new Node(tag);mounted.push(el);return el;},
    querySelectorAll:sel=>mounted.filter(el=>el.className===sel.slice(1))};
  const load=()=>{const box={module:{exports:{}},document,localStorage};
    vm.runInNewContext(html.split('// SCALE_PRACTICE_START')[1].split('// SCALE_PRACTICE_END')[0],box);
    return box.module.exports;};
  const api=load(), score={querySelectorAll:()=>[]};
  let invoked=0;
  const scale=api.card(score,target,()=>invoked++), arp=api.card(score,cMajorArpeggio,()=>invoked++,'arpeggio');
  const [action,options]=scale.element.children, [otherAction,otherOptions]=arp.element.children;
  const [button]=action.children, [otherBtn]=otherAction.children;
  const [,choice]=options.children, [,otherChoice]=otherOptions.children;
  assert.equal(options.tag,'details');
  assert.equal(options.children[0].textContent,'練習設定');
  assert.equal(Boolean(options.open),false);
  const [label,select]=choice.children, [otherLabel,otherSelect]=otherChoice.children;
  assert.equal(action.attributes.role,'group');
  assert.equal(action.attributes['aria-label'],'音階練習控制');
  assert.equal(otherAction.attributes['aria-label'],'琶音練習控制');
  assert.equal(label.textContent,'循環 ▾');
  assert.deepEqual(select.children.map(x=>[x.value,x.textContent]),[['single','單次'],['loop','循環']]);
  assert.equal(select.attributes['aria-label'],'音階練習方式');
  assert.equal(otherBtn.textContent,'開始練習');
  select.value='loop';select.handlers.change();
  assert.equal(invoked,0);
  assert.equal(storage.get(key),'loop');
  assert.equal(select.value,'loop');
  assert.equal(otherSelect.value,'loop');
  assert.equal(otherLabel.textContent,'循環 ▾');
  assert.equal(load().card(score,target,()=>{}).mode,'loop');
  button.handlers.click();assert.equal(invoked,1);
  scale.update('pending',null,null,0,442,{mode:'loop'});
  assert.equal(select.disabled,true);
  otherSelect.value='single';otherSelect.handlers.change();
  assert.equal(select.value,'loop');
  assert.equal(label.textContent,'循環 ▾');
  assert.equal(otherLabel.textContent,'單次 ▾');
  scale.update('idle',null,null);
  assert.equal(select.disabled,false);
  assert.equal(select.value,'single');
});

test('a missed pitch stays blank while subsequent notes light up; it never counts as a single pass',async()=>{
  const f=fixture();
  const start=f.m.toggle(f.view);f.grant();await start;
  f.play(36);f.play(40,7);
  let [,,,progress,,d]=f.calls.at(-1);
  assert.equal(progress,3);
  assert.equal(d.live.slot,2);
  assert.equal(d.values[1],null);
  assert.equal(Math.round(d.values[2]),7);
  for(const n of target.slice(3)) f.play(n.midi);
  assert.equal(f.calls.at(-1)[0],'listening');
  await f.m.toggle(f.view);
  assert.deepEqual(json(f.calls.at(-1)[2].missing),[1]);
});

test('chart stacks historic and current pitches by printed slot, and keeps awaiting visual distinct',()=>{
  class Node {
    constructor(){this.children=[];this.dataset={};this.attributes={};this.variables={};
      this.style={setProperty:(key,value)=>{this.variables[key]=value;}};this._text='';}
    get textContent(){return this._text;}
    set textContent(value){this._text=value;this.children=[];}
    append(...children){this.children.push(...children);}
    setAttribute(key,f){this.attributes[key]=f;}
    addEventListener(){}
  }
  const standalone={module:{exports:{}},document:{createElement:()=>new Node()}};
  vm.runInNewContext(html.split('// SCALE_PRACTICE_START')[1].split('// SCALE_PRACTICE_END')[0],standalone);
  const notes=target.map(note=>({...note,name:'C',octave:2}));
  const heads=notes.map(()=>new Node());
  const view=standalone.module.exports.card({querySelectorAll:()=>heads},notes,()=>{});
  const history=notes.map(()=>new Map());
  history[0].set(-12,3);history[0].set(4,1);history[14].set(22,1);
  const values=Array(notes.length).fill(null);values[0]=-15;
  view.update('listening',null,null,1,442,{mode:'loop',laps:3,passed:2,values,history,progress:1,listening:true});
  const chart=view.element.children.at(-1);
  const slots=chart.children[1].children[1].children[0].children;
  const [past,recorded,live]=slots[0].children[0].children;
  assert.equal(past.children.length,2);
  assert.equal(past.children[0].variables['--pitch-y'],'62%');
  assert.ok(past.children[0].variables['--past-opacity']>past.children[1].variables['--past-opacity']);
  assert.equal(slots[14].children[0].children[0].children[0].variables['--pitch-y'],'28%');
  assert.equal(recorded.variables['--pitch-y'],'65%');
  assert.ok(live.hidden);
  assert.equal(heads[1].dataset.practiceNext,'true');
  assert.equal(heads[1].dataset.practiceCurrent,undefined);
  view.update('listening',null,null,1,442,{mode:'loop',laps:3,values,history,progress:1,listening:true,live:{slot:1,cents:-4,name:'D2'}});
  assert.equal(heads[1].dataset.practiceCurrent,'true');
  assert.equal(heads[1].dataset.practiceNext,undefined);
  view.update('idle',null,null,0,442,{mode:'loop',laps:3,values,history,final:true});
  assert.equal(heads[1].dataset.practiceCurrent,undefined);
});
