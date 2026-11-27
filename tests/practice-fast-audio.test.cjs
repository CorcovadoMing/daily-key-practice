const test = require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'), vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const section=(name)=>html.split('// '+name+'_START')[1].split('// '+name+'_END')[0];
const load=(name)=>{const context={module:{exports:{}},window:{}};vm.runInNewContext(section(name),context);return context.module.exports;};
const {detectPitch,pitchReading}=load('AUDIO_TOOLS');
const {trackNotes,align,metronomeClickGate}=load('SCALE_PRACTICE');
const hz=midi=>442*2**((midi-69)/12);
const reading=f=>f?pitchReading(f,442):null;
const wave=(f,t,rich=false)=>rich ? .020*Math.sin(2*Math.PI*f*t+.4)+.20*Math.sin(4*Math.PI*f*t)+.065*Math.sin(8*Math.PI*f*t+.31) : .20*Math.sin(2*Math.PI*f*t)+.045*Math.sin(4*Math.PI*f*t+.3);
function analyse(render, {rate=48000,windowMs=53,noteMs=27,options={stableMs:24,minFrames:2,releaseMs:65},end=1000,offset=0,clicks=false}={}){
 const samples=new Float32Array(Math.round(rate*windowMs/1000)), track=trackNotes(options),gate=metronomeClickGate(),events=[];
 for(let time=offset;time<=end;time+=noteMs){
  for(let i=0;i<samples.length;i++)samples[i]=render(time/1000-(samples.length-i-1)/rate);
  const frequency=detectPitch(samples,rate);
  const event=track(gate(frequency,time,clicks)?null:reading(frequency),time);
  if(event) events.push({...event,acceptedAt:time});
 }
 return events;
}
for(const rate of [44100,48000]){
 test('rich F2 is a real F2 and genuine F3 is not falsely lowered at '+rate,()=>{
  for(const ms of [53,4096/rate*1000])for(const midi of [41,53]){
   const input=Float32Array.from({length:Math.round(rate*ms/1000)},(_,i)=>wave(hz(midi),i/rate,midi===41));
   const result=reading(detectPitch(input,rate));
   assert.equal(result?.midi,midi);
   assert.ok(Math.abs(result.cents)<5);
  }
 });
}
function melody(notes,duration){
 return t=>{
  const index=Math.floor(t/duration);
  if(t<0 || index>=notes.length || notes[index]===null)return 0;
  const within=t-index*duration;
  const attack=Math.min(1,within/.005,(duration-within)/.005);
  return attack*wave(hz(notes[index]),within,notes[index]===41);
 };
}
test('short deliberately wrong and correct notes are heard, not inferred from the score',()=>{
 const played=[41,43,46,45,46,48,50,52,53,52,50,48,46,45,43,41],expected=played.filter((n,i)=>i!==2);
 for(const rate of [44100,48000])for(const offset of [0,7,14,21]){
  const heard=analyse(melody(played,.115),{rate,offset,end:played.length*115+110});
  const target=expected.map(midi=>({midi}));
  assert.ok(align(target,heard).complete,JSON.stringify({rate,offset,heard}));
  assert.ok(align(target,heard).extra>=1);
  assert.equal(heard[0]?.midi,41);
 }
 const onlyWrong=analyse(melody([53],.28),{end:380});
 assert.equal(align([{midi:41}],onlyWrong).complete,false);
});
test('unaccompanied speaker click does not become a score event',()=>{
 const click=t=>{
  if(t<.04)return 0;
  const measure=(t-.04)%1,local=measure%0.25,freq=measure<0.25?1200:850;
  if(local>=.05)return 0;
  const gain=local<.002?.3*local/.002:.3*(.001/.3)**((local-.002)/.043);
  return gain*Math.sin(2*Math.PI*freq*local);
 };
 for(const rate of [44100,48000])for(const offset of [0,9,18]){
  assert.deepEqual(analyse(click,{rate,offset,end:1300,clicks:true}),[]);
 }
});
test('low octave correction does not shift real high pitches into false lower octaves',()=>{
 for(const rate of [44100,48000])for(const f of [220,225,330,442,511,600,653,850,925,1050]){
  const samples=Float32Array.from({length:4096},(_,i)=>.2*Math.sin(2*Math.PI*f*i/rate));
  const result=detectPitch(samples,rate);
  assert.ok(Math.abs(result/f-1)<.02,JSON.stringify({rate,f,result}));
 }
});
test('real capture hub routes recent samples only to practice on one stream',async()=>{
 const {micCapture}=load('SCALE_PRACTICE');
 let reads=0,prompts=0,stops=0,tick;
 const calls=[],long=[],fast=[];
 const track={readyState:'live',stop(){stops++;}};
 const stream={getTracks:()=>[track],getAudioTracks:()=>[track]};
 class AudioContext {
  state='running';sampleRate=48000;
  resume(){return Promise.resolve();}
  close(){return Promise.resolve();}
  createMediaStreamSource(){return {connect(){},disconnect(){}};}
  createAnalyser(){return {disconnect(){},getFloatTimeDomainData(samples){reads++;for(let i=0;i<samples.length;i++)samples[i]=i;}};}
 }
 const hub=micCapture({
  AudioContext,isSecureContext:true,navigator:{mediaDevices:{getUserMedia:async()=>{prompts++;return stream;}}},
  performance:{now:()=>27},setInterval(fn){tick=fn;},clearInterval(){},clearTimeout(){}
 },samples=>{calls.push(['long',samples.length,samples[0]]);return 442;},.0003,()=>false,
 samples=>{calls.push(['fast',samples.length,samples[0]]);return 88;},()=>false);
 const sub=(frames,fastOnly=false)=>hub.subscribe({fast:fastOnly,ready(){},error:e=>assert.fail(e),frame:r=>frames.push(r.frequency)});
 const releaseFast=sub(fast,true);await new Promise(setImmediate);
 tick();
 const releaseLong=sub(long);await new Promise(setImmediate);tick();
 releaseFast();tick();releaseLong();
 assert.equal(reads,3);assert.equal(prompts,1);assert.equal(stops,1);
 assert.deepEqual(calls,[['fast',2544,1552],['long',4096,0],['fast',2544,1552],['long',4096,0]]);
 assert.deepEqual(fast,[88,88]);assert.deepEqual(long,[442,442]);
});
