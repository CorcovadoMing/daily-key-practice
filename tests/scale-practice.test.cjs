const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const moduleBox = {module:{exports:{}}};
vm.runInNewContext(html.split('// SCALE_PRACTICE_START')[1].split('// SCALE_PRACTICE_END')[0],moduleBox);
const {align,trackNotes,manager,chartPoint,centsText,scoreValues,monitorPitch,liveSlot} = moduleBox.module.exports;
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
  const resources={disconnects:0,closes:0,before:0};
  class AudioContext{
    state='running'; sampleRate=48000;
    resume(){return Promise.resolve();}
    close(){resources.closes++;return Promise.resolve();}
    createMediaStreamSource(){return {connect(){},disconnect(){resources.disconnects++;}};}
    createAnalyser(){return {fftSize:4096,getFloatTimeDomainData(){},disconnect(){resources.disconnects++;}};}
  }
  const env={AudioContext,isSecureContext:true,navigator:{mediaDevices:{getUserMedia:()=>{
    if(error)return Promise.reject(error);
    return new Promise(r=>permit=()=>r(stream));
  }}},performance:{now:()=>time},setTimeout,clearTimeout,
    setInterval:f=>{callback=f;return 1;},clearInterval:()=>{callback=null;}};
  const calls=[], view={target,element:{},update(...args){calls.push(args);}};
  const m=manager(env,{beforeStart:()=>resources.before++,reference:()=>442,
    detectPitch:()=>frequency,pitchReading,pitchName:String});
  return {m,view,calls,track,resources,grant:()=>permit(),reject:e=>error=e,
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
  assert.deepEqual(f.resources,{disconnects:2,closes:1,before:1});
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
