const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
function section(name){
 const box={module:{exports:{}},Float32Array};
 vm.runInNewContext(html.split('// '+name+'_START')[1].split('// '+name+'_END')[0],box);
 return box.module.exports;
}
const {createSwiftF0,swiftInput}=section('AUDIO_TOOLS');
const tick=()=>new Promise(setImmediate);
test('Swift consumes a local 16 kHz monophonic window, clamps to voiced model output only',async()=>{
 let fetched=0, created=0, runs=0, tensors=0;
 class Tensor {constructor(type,data,dims){this.type=type;this.data=data;this.dims=[...dims];}dispose(){tensors++;}}
 let confidence=.9;
 const env={AbortController,setTimeout,clearTimeout,fetch:async(url,options)=>{
  fetched++;
  assert.match(url,/lars76\/swift-f0-training@a3095d23d79097ed7f5fad59d1cb2e2a826501a8\/runs\/seed1\/model.onnx$/);
  assert.equal(options.credentials,'omit');assert.ok(options.integrity);
  assert.equal(options.body,undefined);return {ok:true,arrayBuffer:async()=>new ArrayBuffer(8)};
 },ort:{env:{wasm:{}},Tensor,InferenceSession:{async create(_,options){
  created++;assert.deepEqual([...options.executionProviders],['wasm']);
  return {async run(input){
   runs++;assert.deepEqual(input.audio.dims,[1,6144]);assert.deepEqual(input.fmin.dims,[]);assert.equal(input.fmax.data[0],2093.75);
   return {pitch:new Tensor('float32',Float32Array.from({length:24},(_,i)=>i===13?111:222),[1,24]),
           confidence:new Tensor('float32',Float32Array.from({length:24},()=>confidence),[1,24])};
  }};
 }}}};
 const detector=createSwiftF0(env);
 const silent=new Float32Array(32768);
 assert.equal(await detector.measure(silent,48000),null);assert.equal(fetched,0);
 const pcm=Float32Array.from({length:32768},(_,i)=>.12*Math.sin(i*2*Math.PI*111/44100));
 const signal=swiftInput(pcm,44100);
 assert.equal(signal.length,6144);
 assert.ok(Math.max(...signal)>.11);
 assert.equal(await detector.measure(pcm,44100),111);
 confidence=.3;
 assert.equal(await detector.measure(pcm,44100),null);
 assert.deepEqual([fetched,created,runs,tensors],[1,1,2,10]);
 assert.equal(env.ort.env.wasm.numThreads,1);
});
test('a Swift model load error is real and retryable; never provides a legacy estimate',async()=>{
 let tries=0;
 const env={AbortController,setTimeout,clearTimeout,fetch:async()=>({ok:++tries>1,arrayBuffer:async()=>new ArrayBuffer(8)}),
  ort:{env:{wasm:{}},Tensor:class{},InferenceSession:{async create(){return {};}}}};
 const detector=createSwiftF0(env), pcm=new Float32Array(32768).fill(.1);
 await assert.rejects(detector.measure(pcm,48000),/model unavailable/);
 assert.ok(await detector.load());
 assert.equal(tries,2);
});
test('A/B sharing routes Swift snapshots without a single legacy reading in Swift, and practice stays separate',async()=>{
 const {micCapture}=section('SCALE_PRACTICE');
 let polling, asks=0, stops=0, longRuns=0, fastRuns=0, rawReads=0;
 const track={readyState:'live',stop(){stops++;}};
 const stream={getTracks:()=>[track],getAudioTracks:()=>[track]};
 class AC{
  sampleRate=48000;state='running';
  resume(){return Promise.resolve();} close(){return Promise.resolve();}
  createMediaStreamSource(){return {connect(){},disconnect(){}};}
  createAnalyser(){return {disconnect(){},getFloatTimeDomainData(pcm){if(pcm.length===32768)rawReads++;pcm.fill(.1);}};}
 }
 const env={isSecureContext:true,AudioContext:AC,navigator:{mediaDevices:{getUserMedia:async()=>{asks++;return stream;}}},
  performance:{now:()=>1},setTimeout,clearTimeout,setInterval(fn){polling=fn;return 1;},clearInterval(){}};
 const hub=micCapture(env,()=>{longRuns++;return 220;},.0003,()=>false,()=>{fastRuns++;return 440;});
 let raw=false;const readings=[], practice=[];
 const common={ready(){},error:e=>assert.fail(e)};
 const stop=hub.subscribe({...common,raw:()=>raw,frame:r=>{
  readings.push(r.frequency);
  if(raw) assert.equal(r.readSwift().length,32768);
 }});
 await tick();polling();
 raw=true;
 const endPractice=hub.subscribe({...common,fast:true,frame:r=>practice.push(r.frequency)});
 await tick();polling();
 raw=false;polling();
 assert.deepEqual(readings,[220,null,220]);assert.deepEqual(practice,[440,440]);
 assert.deepEqual([longRuns,fastRuns,rawReads,asks],[2,2,1,1]);
 stop();assert.equal(stops,0);endPractice();assert.equal(stops,1);
});

test('acoustic octave check accepts stable alternating cycles, not a real upper octave',()=>{
 const {swiftLowerOctave}=section('AUDIO_TOOLS');
 for(const low of [64.8,73.4,87.4,110.5])for(const phase of [.4,1.8,4.2]){
  const pcm=fn=>Float32Array.from({length:7168},(_,i)=>fn(2*Math.PI*low*i/16000+phase));
  const rich=pcm(t=>.020*Math.sin(t)+.20*Math.sin(2*t)+.065*Math.sin(4*t+.31));
  const upper=pcm(t=>.20*Math.sin(2*t)+.045*Math.sin(4*t+.31)+.07*Math.sin(6*t));
  for(const hop of [11,13,17])for(const ratio of [.99,1,1.012]){
   const detected=low*2*ratio;
   assert.equal(swiftLowerOctave(rich,hop,detected),detected/2);
   assert.equal(swiftLowerOctave(upper,hop,detected),detected);
  }
  assert.equal(swiftLowerOctave(rich,13,low),low,'already correct model output stays put');
 }
});
test('short attack, changing notes and unstructured noise cannot alone double the period',()=>{
 const {swiftLowerOctave}=section('AUDIO_TOOLS');
 const f=175, center=13*256+128;
 let seed=17;
 const make=fn=>Float32Array.from({length:7168},(_,i)=>fn(i,2*Math.PI*f*i/16000));
 const cases=[
  make((i,t)=>(i>=center?.18*Math.sin(t):0)),
  make((i,t)=>(i>=center?.18*Math.sin(t):.16*Math.sin(.69*t))),
  make((i,t)=>.18*Math.sin(t)+(i>=center?.02*Math.sin(t/2):0)),
  make(()=>.2*((seed=(seed*16807)%2147483647)/2147483647-.5)),
  new Float32Array(7168)
 ];
 for(const pcm of cases)assert.equal(swiftLowerOctave(pcm,13,f),f);
});

test('tuner and shared practice inference apply the same acoustic safeguard, only on voiced output',async()=>{
 class Tensor {constructor(type,data,dims){this.data=data;this.dims=dims;}}
 let confidence=.95;
 const made={AbortController,setTimeout,clearTimeout,fetch:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)}),
  ort:{env:{wasm:{}},Tensor,InferenceSession:{async create(){return {async run({audio}){
   const n=audio.data.length/256;
   return {pitch:{data:new Float32Array(n).fill(176)},confidence:{data:new Float32Array(n).fill(confidence)}};
  }};}}}};
 const swift=createSwiftF0(made);
 const render=(rate,realLow,length)=>Float32Array.from({length},(_,i)=>{
  const t=i*2*Math.PI*88/rate;return (realLow?.022*Math.sin(t+.4):0)+.20*Math.sin(2*t)+.07*Math.sin(4*t);
 });
 assert.equal(await swift.measure(render(48000,true,32768),48000),88);
 assert.equal(await swift.measure(render(48000,false,32768),48000),176);
 assert.deepEqual(Array.from(await swift.infer(render(16000,true,7168),[11,13,17])),[88,88,88]);
 assert.deepEqual(Array.from(await swift.infer(render(16000,false,7168),[11,13,17])),[176,176,176]);
 confidence=.3;
 assert.deepEqual(Array.from(await swift.infer(render(16000,true,7168),[11,13])),[null,null]);
});

function sharedTunerFixture(initial={}) {
 const code=html.split('// AUDIO_TOOLS_START')[1].split('// AUDIO_TOOLS_END')[0];
 const lib=section('AUDIO_TOOLS'),practice=section('SCALE_PRACTICE');
 const subscribers=new Set(),renders=[],nodes=new Map(),store=new Map(Object.entries(initial));
 let now=0,runs=0,initialized=0,legacyReads=0,reads=0;
 const radio=value=>({value,checked:false,addEventListener(_,fn){this.change=fn;}});
 const practiceRadios=[radio('existing'),radio('swift')],tunerRadios=[radio('existing'),radio('swift')];
 const $=id=>{
  if(!nodes.has(id))nodes.set(id,{value:id==='tuner-a'?'444':'0',textContent:'',setAttribute(){},querySelectorAll:()=>id==='tuner-detector'?tunerRadios:practiceRadios});
  return nodes.get(id);
 };
 const capture={subscribe(listener){subscribers.add(listener);return ()=>subscribers.delete(listener);}};
 const detector={load:async()=>{initialized++;},infer:async(_,hops)=>{runs++;return hops.map(()=>444);}};
 const clock={};
 const window={
  performance:{now:()=>now},
  localStorage:{getItem(k){return store.get(k.split(':experimental:')[1])??null;},setItem(k,v){assert.match(k,/experimental:detector:(practice|tuner):v2$/);store.set(k.split(':experimental:')[1],v);}},
  CelloScalePractice:{...practice,micCapture:()=>capture}
 };
 const env={...lib,window,navigator:{},performance:window.performance,$,clickSession:practice.clickAudioSession({}),
  createSwiftF0:()=>detector,renderTuner:(pitch,hold)=>renders.push({pitch,hold}),metroRunning:false};
 vm.runInNewContext(code.slice(code.indexOf('  let tunerRelease'),code.indexOf('  function closeTool(name)'))+
   '\nglobalThis.control={startTuner,stopTuner}',env);
 function choose(radios,index){
  radios.forEach((input,i)=>input.checked=i===index);radios[index].change();
 }
 function ready(){for(const s of subscribers)s.ready();}
 async function frame() {
  now+=90;
  const raw={now,audioTime:now/1000,rate:48000,clock,frequency:null,rms:.04,muted:false,
    readSwift(){reads++;return new Float32Array(32768).fill(.1);}};
  for(const s of subscribers){
   if(!s.raw?.()){legacyReads++;s.frame({...raw,frequency:220});}
   else s.frame(raw);
  }
  await tick();
 }
 return {practiceRadios,tunerRadios,choosePractice:i=>choose(practiceRadios,i),chooseTuner:i=>choose(tunerRadios,i),
  ready,frame,control:env.control,renders,controller:window.CelloScalePractice.controller,field:$('pitch-detector'),
  tunerField:$('tuner-detector'),lockHint:$('pitch-detector-locked'),store,
  get runs(){return runs;},get reads(){return reads;},get legacyReads(){return legacyReads;},
  get subscribers(){return subscribers.size;},get initialized(){return initialized;}};
}

test('independent defaults ignore old shared choices; explicit choices survive reload', async()=>{
 const f=sharedTunerFixture({'pitch-detector':'swift','tuner-detector':'existing'});
 assert.match(html,/<fieldset id="pitch-detector"[^>]*>[\s\S]*?value="existing" checked><span>傳統/);
 assert.match(html,/<fieldset id="tuner-detector"[^>]*>[\s\S]*?value="swift" checked><span>智慧/);
 assert.equal(f.practiceRadios[0].checked,true);
 assert.equal(f.tunerRadios[1].checked,true);
 assert.equal(f.initialized,0);
 f.choosePractice(1);
 assert.equal(f.tunerRadios[1].checked,true);
 f.chooseTuner(0);
 assert.equal(f.practiceRadios[1].checked,true);
 const back=sharedTunerFixture(Object.fromEntries(f.store));
 assert.equal(back.practiceRadios[1].checked,true);
 assert.equal(back.tunerRadios[0].checked,true);
 const bad=sharedTunerFixture({'detector:tuner:v2':'other','detector:practice:v2':''});
 assert.equal(bad.tunerRadios[1].checked,true);
 assert.equal(bad.practiceRadios[0].checked,true);
});

test('all four mode combinations and both kinds run concurrently; each tool stops independently',async()=>{
 for(const demoKind of ['scale','arpeggio'])for(const p of [0,1])for(const t of [0,1]){
  const f=sharedTunerFixture(),updates=[];
  f.choosePractice(p);f.chooseTuner(t);
  const target=(p?[69,71]:[57,59]).map(midi=>({midi}));
  const view={demoKind,target,mode:'single',update(...x){updates.push(x);}};
  f.control.startTuner();await f.controller.toggle(view);f.ready();await tick();
  assert.equal(f.subscribers,2);
  assert.equal(f.field.disabled,true);assert.notEqual(f.tunerField.disabled,true);assert.equal(f.lockHint.hidden,false);
  f.choosePractice(1-p);
  assert.equal(f.practiceRadios[p].checked,true,'active exercise freezes its own choice');
  for(let i=0;i<6;i++)await f.frame();
  assert.equal(f.renders.at(-1).pitch.midi,t?69:57);
  assert.ok(updates.some(x=>x[3]===1),'first actual note reached the exercise matcher');
  assert.equal(f.runs,f.reads,'same Swift batch is shared');
  assert.equal(f.runs>0,Boolean(t||p));
  assert.equal(f.legacyReads>0,Boolean(!t||!p));
  f.chooseTuner(1-t);await tick();await f.frame();
  assert.equal(f.renders.at(-1).pitch.midi,t?57:69);
  assert.equal(f.subscribers,2);
  if(demoKind==='scale'){
   f.controller.stop();assert.equal(f.subscribers,1);assert.equal(f.field.disabled,false);
   await f.frame();assert.equal(f.renders.at(-1).pitch.midi,t?57:69);
   f.control.stopTuner();
  }else{
   f.control.stopTuner();assert.equal(f.subscribers,1);
   assert.equal(f.field.disabled,true);await f.frame();
   assert.equal(updates.at(-1)[0],'listening');
   f.controller.stop();assert.equal(f.field.disabled,false);
  }
  assert.equal(f.subscribers,0);assert.equal(f.lockHint.hidden,true);
 }
});
