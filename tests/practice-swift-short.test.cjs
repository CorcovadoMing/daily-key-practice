const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
function load(section){
 const globals={module:{exports:{}},Float32Array};
 vm.runInNewContext(html.split('// '+section+'_START')[1].split('// '+section+'_END')[0],globals);
 return globals.module.exports;
}
const {createSwiftBatches,pitchReading}=load('AUDIO_TOOLS');
const {manager}=load('SCALE_PRACTICE');
async function run(input, mode='swift'){
 let sub,state;
 const route={subscribe(s){sub=s;return()=>{};}};
 const env={performance:{now:()=>0}};
 const control=manager(env,{capture:route,swiftCapture:route,pitchReading,pitchName:String,reference:()=>442});
 const view={target:[{midi:38},{midi:40},{midi:42}],detector:mode,mode:'single',update(...s){state=s;}};
 await control.toggle(view);sub.ready();
 const snapshots=[];
 for(const [time,hop,confidence,midi=38,cents=0,extra={}] of input){
   sub.frame({now:time,swiftHop:hop,confidence,frequency:midi==null?null:442*2**((midi-69+cents/100)/12),...extra});
   snapshots.push(state[3]);
 }
 return snapshots;
}
test('actual practice manager accepts two distinct 16ms Swift hops only on the expected pitch',async()=>{
 assert.deepEqual(await run([[160,10,.72],[176,11,.78]]),[0,1]);
 assert.deepEqual(await run([[160,10,.72,40],[176,11,.99,40]]),[0,0]);
 assert.deepEqual(await run([[160,10,.72],[176,11,.78],[192,12,.88,42],[208,13,.91,42]]),[0,1,1,1]);
});
test('the speedup never counts one frame, the same hop, a rejected frame, an octave override, or a wide pitch movement',async()=>{
 assert.deepEqual(await run([[160,10,.80]]),[0]);
 assert.deepEqual(await run([[160,10,.80],[176,10,.90]]),[0,0]);
 assert.deepEqual(await run([[160,10,.80],[176,12,.90]]),[0,0]);
 assert.deepEqual(await run([[160,10,.60],[176,11,.62]]),[0,0]);
 assert.deepEqual(await run([[160,10,.50],[176,11,.95,38,0,{muted:true}]]),[0,0]);
 assert.deepEqual(await run([[160,10,.99,38,-15],[176,11,.99,38,15]]),[0,0]);
 assert.deepEqual(await run([[160,10,.99,38,-30],[176,11,.99,38,-19]]),[0,0]);
 assert.deepEqual(await run([[160,10,.99],[176,11,.99,38,0,{octaveCorrected:true}]]),[0,0]);
});
test('legacy practice still needs 24ms and weak Swift evidence may still pass the original stable gate',async()=>{
 assert.deepEqual(await run([[160,10,.99],[176,11,.99],[192,12,.99]],'existing'),[0,0,1]);
 assert.deepEqual(await run([[160,10,.54],[176,11,.51],[192,12,.54]]),[0,0,1]);
});
test('shared model results preserve unique hops, confidence and octave evidence without altering values used by the tuner',async()=>{
 const track=createSwiftBatches({async infer(input,indices,quality){assert.equal(quality,true);return indices.map(h=>({frequency:100+h,confidence:.72,octaveCorrected:h===17}));}});
 const clock={};
 const raw=(now)=>({now,audioTime:now/1e3,rate:48000,clock,readSwift:()=>new Float32Array(32768)});
 const one=track(raw(500)); assert.equal(one,track(raw(500)));
 const rows=[...await one,...await track(raw(554))];
 assert.deepEqual(rows.map(x=>x.swiftHop),[20,21,22,23]); 
 assert.deepEqual(rows.map(x=>Math.round(x.now)),[320,336,352,368]);
 assert.ok(rows.every(x=>Number.isFinite(x.frequency)&&x.confidence===.72));
 assert.ok(rows.some(x=>x.octaveCorrected) && rows.some(x=>!x.octaveCorrected));
});
