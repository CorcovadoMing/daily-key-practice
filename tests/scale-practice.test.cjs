const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const moduleBox = {module:{exports:{}}};
vm.runInNewContext(html.split('// SCALE_PRACTICE_START')[1].split('// SCALE_PRACTICE_END')[0],moduleBox);
const {align,trackNotes,manager,micCapture,metronomeClickGate,chartPoint,centsText,scoreValues,monitorPitch,liveSlot} = moduleBox.module.exports;
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
    target.map((n,i)=>i===5?tone(n.midi,41):n)
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
  }}},performance:{now:()=>time},setTimeout,clearTimeout,
    setInterval:f=>{callback=f;return 1;},clearInterval:()=>{callback=null;}};
  const calls=[], view={target,element:{},update(...args){calls.push(args);}};
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
  for(const n of target)f.play(n.midi);
  f.play(49); // Extra audio after the final tonic stays in the same attempt.
  assert.equal(f.calls.at(-1)[0],'listening');
  await f.m.toggle(f.view);
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
test('visual can show +45¢, but recording and score remain ±40¢',async()=>{
  const f=fixture(), starting=f.m.toggle(f.view);
  f.grant();await starting;
  f.play(36,45);
  let [phase,,,progress,,visual]=f.calls.at(-1);
  assert.equal(phase,'listening');assert.equal(progress,0);
  assert.equal(visual.live.slot,0);assert.equal(Math.round(visual.live.cents),45);
  assert.equal(visual.values[0],null);
  f.play(36,16);f.play(36,-17);
  [, , , progress,,visual]=f.calls.at(-1);
  assert.equal(progress,1);
  assert.equal(Math.round(visual.values[0]),16);
  assert.equal(visual.live.slot,0);assert.equal(Math.round(visual.live.cents),-17);
  f.play(0); f.play(0);
  [, , , progress,,visual]=f.calls.at(-1);
  assert.equal(progress,1);assert.equal(visual.live,null);
  assert.equal(Math.round(visual.values[0]),16);
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

test('arpeggio matching accepts exact tolerance after floating-point pitch conversion, not 40.01 cents',()=>{
  const expected=[tone(69),tone(72)];
  for(const sign of [1,-1]) {
    const convert=(midi,cents)=>pitchReading(442*2**((midi-69+cents/100)/12),442);
    const near=convert(69,sign*40);
    assert.equal(align(expected,[near,convert(72,0)]).complete,true);
    assert.equal(align(expected,[convert(69,sign*40.01),convert(72,0)]).complete,false);
    const push=trackNotes();
    for(const ms of [0,27,54])assert.equal(push(near,ms),null);
    assert.equal(push(near,81).midi,69);
  }
});

const cMajorArpeggio = [36,40,43,48,52,55,60,55,52,48,43,40,36].map(midi=>tone(midi));
test('switch scale ↔ arpeggio keeps one mic session but grades only selected score notes',async()=>{
  const f=fixture(), arpeggioCalls=[];
  const arpeggio={target:cMajorArpeggio,element:{},update(...args){arpeggioCalls.push(args);}};
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
  await f.m.toggle(arpeggio);
  const final=arpeggioCalls.at(-1)[2];
  assert.equal(final.complete,true);
  assert.equal(final.pairs.length,13);
  assert.equal(final.extra,1);
  assert.equal(f.track.stopCalls,1);
});
test('switching practice mode while permission is pending still makes one request',async()=>{
  const f=fixture(), arpeggioCalls=[];
  const arpeggio={target:cMajorArpeggio,element:{},update(...args){arpeggioCalls.push(args);}};
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
  const [action,status]=view.element.children;
  const [button]=action.children;
  assert.equal(view.element.dataset.practiceKind,'arpeggio');
  assert.equal(button.textContent,'開始練習');
  assert.equal(button.attributes['aria-label'],'開始琶音練習');
  view.update('pending');
  const chart=view.element.children.at(-1);
  assert.match(chart.attributes['aria-label'],/^琶音音準圖/);
  const grid=chart.children[1].children[1].children[0];
  assert.equal(grid.children.length,13);
  const result=align(cMajorArpeggio,cMajorArpeggio);
  view.update('idle',null,result,0,442,{values:scoreValues(cMajorArpeggio,cMajorArpeggio,result),final:true});
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
  assert.equal(align([tone(69)],[tone(69,41)],99).complete,false);
});

test('tolerance is snapshotted before permission and used for live visuals and scoring',async()=>{
  const f=fixture();
  let selected=15;
  Object.defineProperty(f.view,'tolerance',{ get:()=>selected });
  const started=f.m.toggle(f.view);
  assert.equal(f.calls.at(-1)[5].tolerance,15);
  selected=40; // another idle card changes the shared setting while permission is pending
  f.grant();await started;
  f.play(36,20);
  let [phase,,,progress,,visual]=f.calls.at(-1);
  assert.equal(phase,'listening');assert.equal(progress,0);
  assert.equal(visual.tolerance,15);assert.equal(Math.round(visual.live.cents),20);
  assert.equal(visual.live.slot,0);assert.equal(visual.values[0],null);
  for(const note of target.slice(1)) f.play(note.midi);
  await f.m.toggle(f.view);
  let [, ,result, , ,display]=f.calls.at(-1);
  assert.equal(result.complete,false);
  assert.equal(display.tolerance,15);
  assert.deepEqual(json(result.missing),[0]);
});

test('native tolerance selection persists and syncs scale/arpeggio without starting their mic',()=>{
  const mounted=[];
  class Node {
    constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.attributes={};this.handlers={};this.style={setProperty(){}};this.textContent='';}
    append(...children){this.children.push(...children);}
    setAttribute(key,f){this.attributes[key]=f;}
    addEventListener(name,fn){this.handlers[name]=fn;}
    querySelector(sel){return this.children.find(node=>sel[0]==='.'?node.className===sel.slice(1):node.tag===sel);}
  }
  const key='daily-key-practice:experimental:practice-tolerance';
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
  const [action]=scale.element.children, [otherAction]=arp.element.children;
  const [button,choice]=action.children, [otherBtn,otherChoice]=otherAction.children;
  const [label,select]=choice.children, [otherLabel,otherSelect]=otherChoice.children;
  assert.equal(action.attributes.role,'group');
  assert.equal(action.attributes['aria-label'],'音階練習控制');
  assert.equal(otherAction.attributes['aria-label'],'琶音練習控制');
  assert.equal(label.textContent,'判定：寬鬆 ▾');
  assert.deepEqual(select.children.map(x=>[x.value,x.textContent]),[['40','寬鬆 ±40¢'],['25','標準 ±25¢'],['15','嚴謹 ±15¢']]);
  assert.equal(select.attributes['aria-label'],'音階音準容許範圍');
  assert.equal(otherBtn.textContent,'開始練習');
  select.value='25';select.handlers.change();
  assert.equal(invoked,0);
  assert.equal(storage.get(key),'25');
  assert.equal(select.value,'25');
  assert.equal(otherSelect.value,'25');
  assert.equal(otherLabel.textContent,'判定：標準 ▾');
  assert.equal(load().card(score,target,()=>{}).tolerance,25);
  button.handlers.click();assert.equal(invoked,1);
  scale.update('pending',null,null,0,442,{tolerance:25});
  assert.equal(select.disabled,true);
  otherSelect.value='15';otherSelect.handlers.change();
  assert.equal(select.value,'25');
  assert.equal(label.textContent,'判定：標準 ▾');
  assert.equal(otherLabel.textContent,'判定：嚴謹 ▾');
  scale.update('idle',null,null);
  assert.equal(select.disabled,false);
  assert.equal(select.value,'15');
});
