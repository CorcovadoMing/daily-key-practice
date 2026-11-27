const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const section=name=>html.split('// '+name+'_START')[1].split('// '+name+'_END')[0];
const shared={exports:{}};
new Function('module',section('PRACTICE_LOUDNESS'))(shared);
const loud=shared.exports;
function load(name){
  const context={module:{exports:{}},window:{},CelloPracticeLoudness:loud};
  vm.runInNewContext(section(name),context);
  return context.module.exports;
}
const wave=(amplitude,dc=0,rate=48000,ct=4096)=>Float32Array.from({length:ct},(_,i)=>dc+amplitude*Math.sin(2*Math.PI*200*i/rate));
test('short-tail centered RMS reflects a controlled signal and ignores earlier samples',()=>{
  for(const rate of [44100,48000]){
    const a=loud.measure(wave(.1,.035,rate),rate), b=loud.measure(wave(.2,.035,rate),rate);
    assert.ok(Math.abs(a.rms-.1/Math.sqrt(2))<.001);
    assert.ok(Math.abs(20*Math.log10(b.rms/a.rms)-6.0206)<.02);
    assert.equal(a.clipped,false);
    assert.ok(Math.abs(a.halfMs-17.5)<.02);
    const old=wave(.1,0,rate);old.fill(1,0,old.length-Math.round(rate*.035));
    assert.ok(Math.abs(loud.measure(old,rate).rms-a.rms)<.001);
    assert.equal(loud.measure(old,rate).clipped,false);
  }
  assert.equal(loud.measure(new Float32Array(4096).fill(.27),48000).rms,0);
  assert.equal(loud.measure(wave(1.2),48000).clipped,true);
  assert.equal(loud.measure(Float32Array.of(.2,NaN),48000),null);
});
const observe=(collector,ms,rms,flags={})=>collector.observeMic({now:ms,rms,...flags});
function synthetic(levelAt,flagsAt=()=>({})){
  const take=loud.capture(1000);
  // Mic frames arrive first. This is valid for delayed SwiftF0 inference.
  for(let t=0;t<=700;t+=25)observe(take,1000+t,levelAt(t),flagsAt(t));
  for(let t=0;t<=700;t+=16)take.observePitch(1000+t,2,1);
  return take.snapshot(.003);
}
test('fixed room gain cancels, steady sustains and note envelopes do not warn',()=>{
  const a=synthetic(t=>t<65||t>625?.014:.07),b=synthetic(t=>t<65||t>625?.028:.14);
  assert.deepEqual(a.points.map(x=>x.db),b.points.map(x=>x.db));
  assert.equal(a.best,null);
  assert.equal(b.best,null);
  assert.equal(loud.suggestion(a,'D3↑'),null);
});
test('only repeatable same-slot mic variation recommends a conditional exercise',()=>{
  const first=synthetic(t=>t<350?.06:.145);
  assert.equal(first.best.slot,2);assert.equal(first.best.lap,1);assert.ok(first.best.spread>=7);
  assert.ok(first.points.length>12,'one-off variation remains visible');
  assert.equal(loud.suggestion(first,'D'),null);
  function tracked(rows,accept){
    const take=loud.capture(1000);
    rows.forEach(([slot,lap,variable],i)=>{
      for(let t=0;t<=700;t+=25)observe(take,1000+i*800+t,variable&&t<350?.06:.145);
      for(let t=0;t<=700;t+=16)take.observePitch(1000+i*800+t,slot,lap);
    });
    return take.snapshot(.003,accept);
  }
  const repeated=tracked([[2,1,true],[2,2,true],[2,3,false]]);
  assert.deepEqual(repeated.repeated,{slot:2,hits:2,usable:3});
  const advice=loud.suggestion(repeated,'D');
  assert.match(advice.observation,/D.*收音強弱有起伏（2／3 輪）/);
  assert.match(advice.action,/如果.*單獨慢拉這個音兩次/);
  assert.doesNotMatch(advice.action,/弓速|琴橋/);
  assert.match(advice.check,/手機位置/);
  for(const trace of [
    tracked([[2,1,true],[2,2,false]]),
    tracked([[2,1,true],[3,2,true]]),
    tracked([[2,1,true],[2,1,true],[2,2,true]]),
    tracked([[2,1,true],[2,2,true]],span=>span.lap===1),
    tracked([[2,1,true],[2,2,true],[2,3,false],[2,4,false]])
  ])assert.equal(loud.suggestion(trace,'D'),null);
});
test('clipping, metronome, mute and silence cause gaps, not spin or false dips',()=>{
  const a=synthetic(t=>t===475?.0001:.05,t=>({clipped:t===200,metro:t===350,muted:t===575}));
  assert.equal(a.clipped,true);assert.equal(a.metronome,true);
  for(const t of [200,350,375,400,425,450,475,575])assert.ok(!a.points.some(x=>x.ms===t));
  assert.equal(new Set(a.points.map(p=>p.segment)).size,4);
  assert.equal(a.best,null);
  assert.equal(synthetic(()=>.0001).points.length,0);
});
test('auto-processing may show readings but suppresses the technique observation',()=>{
  const a=synthetic(t=>t<350?.06:.15,t=>({processed:t===100}));
  assert.ok(a.points.length>0);assert.equal(a.processing,true);assert.equal(a.best,null);
});
test('unvoiced and out-of-span frames are omitted and each take is separate',()=>{
  const take=loud.capture(3000,8);
  observe(take,2999,.5);
  for(let t=0;t<12;t++)observe(take,3000+t*25,.08);
  for(let t=1;t<8;t++)take.observePitch(3000+t*25,t===4?null:1,1);
  const a=take.snapshot();
  assert.equal(a.capped,true);assert.equal(a.points.length,6);
  assert.equal(new Set(a.points.map(p=>p.segment)).size,2);
  assert.ok(!a.points.some(p=>p.ms===0||p.ms>=200||p.ms===100));
  assert.deepEqual(loud.capture(4000).snapshot().points,[]);
});
test('Swift capture forwards the current scalar untouched, not with historical frame time',async()=>{
  const {swiftPracticeCapture}=load('AUDIO_TOOLS');
  let mic,stopCount=0;
  const levels=[],pitches=[];
  const source={subscribe(listener){mic=listener;return()=>stopCount++;}};
  const batch=()=>Promise.resolve([{now:140,frequency:196,muted:false,swiftHop:6}]);
  const swift=swiftPracticeCapture({performance:{now:()=>100}},source,{load:()=>Promise.resolve()},batch,()=>false);
  const stop=swift.subscribe({ready(){},frame:p=>pitches.push(p),loudness:p=>levels.push(p),error:x=>assert.fail(x)});
  mic.ready();await Promise.resolve();
  mic.loudness({now:242.5,rms:.052,muted:false});
  mic.frame({now:260,rms:.045,muted:false});await Promise.resolve();
  assert.equal(levels[0].now,242.5);assert.equal(pitches[0].now,140);
  assert.equal(pitches[0].rms,undefined);
  stop();mic.loudness({now:270,rms:.07});assert.equal(levels.length,1);assert.equal(stopCount,1);
});
test('shared hub provides a scalar-only practice tap without opening another stream or altering detector',async()=>{
  const {micCapture}=load('SCALE_PRACTICE');
  let tick,count=0;
  const pitches=[],measurements=[];
  class AudioContext {
    state='running';sampleRate=48000;
    createMediaStreamSource(){return {connect(){},disconnect(){}};}
    createAnalyser(){return {getFloatTimeDomainData(buf){buf.set(wave(.2));},disconnect(){}};}
    close(){return Promise.resolve();} resume(){return Promise.resolve();}
  }
  const track={readyState:'live',getSettings:()=>({autoGainControl:true}),stop(){}};
  const tracks={getTracks:()=>[track],getAudioTracks:()=>[track]};
  const hub=micCapture({AudioContext,isSecureContext:true,performance:{now:()=>100},
    navigator:{mediaDevices:{getUserMedia:async()=>{count++;return tracks}}},
    setInterval(fn){tick=fn;},clearInterval(){},clearTimeout(){}},()=>196,.001);
  const stop=hub.subscribe({ready(){},error:x=>assert.fail(x),frame:x=>pitches.push(x.frequency),
    loudness:x=>measurements.push(x)});
  const stop2=hub.subscribe({ready(){},error:x=>assert.fail(x),frame:x=>pitches.push(x.frequency)});
  await new Promise(setImmediate);tick();stop();stop2();
  assert.equal(count,1);assert.deepEqual(pitches,[196,196]);assert.equal(measurements.length,1);
  assert.equal(measurements[0].now,82.5);assert.equal(measurements[0].processed,true);
  assert.ok(Math.abs(measurements[0].rms-.2/Math.sqrt(2))<.001);
  assert.deepEqual(Object.keys(measurements[0]).sort(),['clipped','halfMs','muted','now','processed','rms']);
});
test('actual coach button renders current take loudness and resets from next take; no audio data is persisted',async()=>{
  let fetches=0, writes=0;
  class Node {
    children=[];dataset={};attributes={};handlers={};style={setProperty(){}};className='';
    constructor(tag){this.tag=tag;}
    append(...children){this.children.push(...children);for(const c of children)c.parent=this;}
    insertBefore(child,other){this.children.splice(this.children.indexOf(other),0,child);child.parent=this;}
    remove(){this.parent.children=this.parent.children.filter(x=>x!==this);}
    setAttribute(k,v){this.attributes[k]=v;}
    addEventListener(k,v){this.handlers[k]=v;}
    get textContent(){return (this.text??'')+this.children.map(x=>x.textContent).join('');}
    set textContent(s){this.text=s;this.children=[];}
    find(p){return p(this)?this:this.children.map(c=>c.find(p)).find(Boolean);}
  }
  const context=vm.createContext({
    module:{exports:{}},CelloPracticeLoudness:loud,CelloPracticeCoach:{enabled:()=>true},
    localStorage:{getItem(){return 'loop';},setItem(){writes++;}},
    fetch(){fetches++;throw Error('unexpected network access');},
    document:{createElement:t=>new Node(t),createElementNS:(_,t)=>new Node(t)},
    location:{hostname:'example.test',pathname:'/experimental/',search:''}
  });
  vm.runInContext(section('SCALE_PRACTICE'),context);
  const {manager,card}=context.module.exports, {pitchReading}=load('AUDIO_TOOLS');
  let clock=1000,listener;
  const capture={subscribe(next){listener=next;return()=>{};}};
  const managerInstance=manager({performance:{now:()=>clock}},{
    capture,swiftCapture:capture,pitchReading,pitchName:String,reference:()=>442,loudnessCapture:loud.capture
  });
  const target=[38,40,41,40,38].map((midi,i)=>({midi,name:['D','E','F','E','D'][i],octave:2}));
  const view=card({querySelectorAll:()=>target.map(()=>new Node('g'))},target,()=>{});
  async function play(repeatCount,makeVariation){
    await managerInstance.toggle(view);listener.ready();
    const route=[38,...Array.from({length:repeatCount},()=>[40,41,40,38]).flat()];
    for(let slot=0;slot<route.length;slot++){
      const midi=route[slot],repeat=slot%4===1;
      for(let i=0;i<(repeat?30:10);i++){
        clock+=27;
        listener.loudness({now:clock-17.5,rms:makeVariation&&repeat&&i<15?.065:.155});
        listener.frame({now:clock,frequency:442*2**((midi-69)/12)});
      }
    }
    await managerInstance.toggle(view);
  }
  const chart=()=>view.element.find(n=>n.tag==='section'&&n.dataset.chartTime==='volume');
  await play(1,true);
  assert.ok(chart());
  assert.match(chart().textContent,/本回收音中位數/);
  assert.ok(chart().find(n=>n.attributes.class==='trend-line')?.attributes.d.includes('L'));
  assert.doesNotMatch(view.element.textContent,/收音強弱有起伏/);
  assert.doesNotMatch(view.element.textContent,/Paul Katz：用弓塑造聲音/);
  const first=chart();
  await play(2,true);
  assert.match(view.element.textContent,/上行：E.*收音強弱有起伏（2／2 輪）/);
  assert.match(view.element.textContent,/Paul Katz：用弓塑造聲音/);
  await play(2,false);
  assert.equal(chart(),first,'reuse the same chart across takes');
  assert.doesNotMatch(view.element.textContent,/收音強弱有起伏/);
  assert.doesNotMatch(view.element.textContent,/Paul Katz：用弓塑造聲音/);
  assert.equal(writes,0);assert.equal(fetches,0);
});
test('a provisional score match may be visualized but cannot recommend a technique',()=>{
  const take=loud.capture(1000);
  // Strong variation was genuinely recorded, but the provisional pitch was
  // later rejected/reassigned by the final score alignment.
  for(let t=0;t<=660;t+=25){
    observe(take,1000+t,t<330?.055:.15);
    take.observePitch(1000+t,2,1);
  }
  const rejected=take.snapshot(.003,()=>false);
  const accepted=take.snapshot(.003,span=>span.slot===2&&span.lap===1&&span.start===1000);
  assert.ok(rejected.points.length>12);assert.equal(rejected.best,null);
  assert.equal(accepted.best.slot,2);
  assert.equal(loud.suggestion(rejected,'D'),null);
});
test('window spanning start is discarded even if its center is after start',()=>{
  const take=loud.capture(1000);
  take.observePitch(1000,0,1);
  take.observePitch(1025,0,1);
  take.observePitch(1050,0,1);
  observe(take,1006,.5,{halfMs:17.5});
  observe(take,1025,.1,{halfMs:17.5});
  assert.deepEqual(take.snapshot().points.map(x=>x.ms),[25]);
});
