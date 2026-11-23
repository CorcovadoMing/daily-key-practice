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
