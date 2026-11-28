const test = require('node:test'), assert = require('node:assert/strict');
const vm=require('node:vm'), fs=require('node:fs');
const box={module:{exports:{}}};
vm.runInNewContext(fs.readFileSync('index.html','utf8').split('// SCALE_PRACTICE_START')[1].split('// SCALE_PRACTICE_END')[0],box);
const {clickAudioSession,micCapture}=box.module.exports;
function phone({ua='iPhone Safari',initial='auto',platform,maxTouchPoints}={}) {
  const events=[]; let type=initial;
  const audioSession={get type(){return type;},set type(v){type=v;events.push(v);}};
  return {events,audioSession,userAgent:ua,platform,maxTouchPoints};
}
test('iPhone restores media playback after mic release, then releases it on stop',()=>{
 const device=phone(), s=clickAudioSession(device);
 s.click(true); s.input(true); s.click(true); s.input(false); s.click(false);
 assert.deepEqual(device.events,['playback','auto','playback','auto']);
});
test('capture first, mute/unmute, and stopping the beat while recording',()=>{
 const device=phone(), s=clickAudioSession(device);
 s.input(true); s.click(true); s.click(false); s.input(false);
 assert.deepEqual(device.events,[]);
 s.click(true); s.click(false); s.click(true); s.click(false);
 assert.deepEqual(device.events,['playback','auto','playback','auto']);
});
test('iPad desktop identification and feature-detected fallback without affecting Macs or Android',()=>{
 for(const [device,calls] of [[phone({ua:'Macintosh Safari',platform:'MacIntel',maxTouchPoints:5}),['playback','auto']],
  [phone({ua:'Macintosh Safari',platform:'MacIntel',maxTouchPoints:0}),[]],[phone({ua:'Android Chrome'}),[]]]) {
   const s=clickAudioSession(device);s.click(true);s.click(false);assert.deepEqual(device.events,calls);
 }
 for(const device of [{userAgent:'iPhone'},{userAgent:'iPhone',get audioSession(){throw new Error('unsupported');}}]){
   const s=clickAudioSession(device);assert.doesNotThrow(()=>{s.click(true);s.input(true);s.input(false);s.click(false);});
 }
});
test('preserve pre-existing mode and do not overwrite someone else’s later mode change',()=>{
 for (const initial of ['play-and-record','playback']) {
  const d=phone({initial}),s=clickAudioSession(d);s.click(true);s.input(true);s.input(false);s.click(false);
  assert.deepEqual(d.events,[]);assert.equal(d.audioSession.type,initial);
 }
 const d=phone(),s=clickAudioSession(d);s.click(true);d.audioSession.type='transient';s.click(false);
 assert.deepEqual(d.events,['playback','transient']);
});
function fixture(device) {
 const s=clickAudioSession(device), open=[]; let resolve,reject;
 const track={stop(){open.push('track-stop');this.readyState='ended';},readyState:'live'};
 const analyser={disconnect(){}};const source={connect(){},disconnect(){}};
 class Context {
  get state(){return 'running';}
  resume(){return Promise.resolve();}
  close(){return Promise.resolve();}
  createMediaStreamSource(){return source;}
  createAnalyser(){return analyser;}
 }
 const env={AudioContext:Context,isSecureContext:true,clearTimeout(){},clearInterval(){},setInterval(){},
  navigator:{mediaDevices:{getUserMedia(){open.push(device.audioSession.type);return new Promise((a,b)=>{resolve=a;reject=b;});}}}};
 const mic=micCapture(env,()=>null,.0002,undefined,null,undefined,s.input);
 return {s,mic,track,open,allow:()=>resolve({getTracks:()=>[track],getAudioTracks:()=>[track]}),
  deny:()=>reject(Object.assign(new Error('blocked'),{name:'NotAllowedError'}))};
}
const tick=()=>new Promise(r=>setImmediate(r));
const subscriber={ready(){},frame(){},error(){}};
test('shared tuner/practice capture does not restore playback until the final consumer releases',async()=>{
 const d=phone(), f=fixture(d);f.s.click(true);const tuner=f.mic.subscribe(subscriber),practice=f.mic.subscribe(subscriber);
 assert.deepEqual(f.open,['auto']);f.allow();await tick();
 tuner();assert.equal(d.audioSession.type,'auto');assert.equal(f.track.readyState,'live');
 practice();assert.equal(f.track.readyState,'ended');assert.deepEqual(d.events,['playback','auto','playback']);
});
test('cancelled permission keeps browser routing until a late grant is stopped',async()=>{
 const d=phone(), f=fixture(d);f.s.click(true);f.mic.subscribe(subscriber)();assert.equal(d.audioSession.type,'auto');
 f.allow();await tick();assert.deepEqual(f.open,['auto','track-stop']);assert.equal(d.audioSession.type,'playback');
});
test('denied permission returns to playback without leaving the mic marked active',async()=>{
 const d=phone(), f=fixture(d);f.s.click(true);const release=f.mic.subscribe(subscriber);
 f.deny();await tick();release();assert.deepEqual(d.events,['playback','auto','playback']);
});
