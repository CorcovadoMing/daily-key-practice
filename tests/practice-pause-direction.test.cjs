const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const test=require('node:test');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const shell={module:{exports:{}},observed:[]};
const body=html.split('// SCALE_PRACTICE_START')[1].split('// SCALE_PRACTICE_END')[0].replace('function scoreValues(target, heard, result) {','function scoreValues(target, heard, result) {\n  observed.push(result.pairs.map(p=>[p.expected,heard[p.heard].midi,heard[p.heard].at]));');
vm.runInNewContext(body,shell);
const {manager}=shell.module.exports;
const target=[40,42,44,45,47,49,51,52,51,49,47,45,44,42,40].map(midi=>({midi}));
const prefix=[...target.slice(0,9).map(x=>x.midi),null,null,47];
async function run(mode,suffix){
 shell.observed.length=0;
 let now=0,listener,state;
 const route={subscribe(h){listener=h;return()=>{}}};
 const m=manager({performance:{now:()=>now},setTimeout:(f)=>setTimeout(f,1e6).unref(),clearTimeout},{capture:route,reference:()=>442,pitchReading:f=>({midi:Math.round(69+12*Math.log2(f/442)),cents:0}),pitchName:String});
 const view={target,mode,detector:'legacy',update(...args){state=args;}};
 await m.toggle(view);listener.ready();
 const checkpoints=[];
 for(const [pos,mid] of [...prefix,...suffix].entries()){
  for(let i=0;i<4;i++){now+=32;listener.frame({now,frequency:mid===null?null:442*2**((mid-69)/12),muted:false});}
  const display=state[5];
  checkpoints.push({pos,mid,progress:state[3],assigned:[...display.values].flatMap((x,i)=>Number.isFinite(x)?[i]:[]),laps:display.laps||0});
 }
 await m.toggle(view);
 return {shared:checkpoints.slice(0,prefix.length),tail:checkpoints.slice(prefix.length),score:JSON.parse(JSON.stringify(shell.observed)),lap:state[5]?.laps??null};
}
test('single and loop distinguish paused descent, ascending restart and deliberate skipped-note retry',async()=>{for(const mode of ['single','loop']){
 const down=await run(mode,[45,44,42,40]),up=await run(mode,[49,51,52]),stop=await run(mode,[]);
 const retry=await run(mode,[49,47,45,44,42,40]);
 assert.deepEqual(down.shared,up.shared);assert.deepEqual(up.shared,stop.shared);
 const grade=(r,i)=>r.score.some(z=>z.some(x=>x[0]===i));
 assert.ok(!down.shared.at(-1).assigned.includes(10));
 assert.ok(grade(down,10));assert.ok(!grade(up,10));assert.ok(!grade(up,9));assert.ok(!grade(stop,10));
 assert.ok(grade(retry,9));assert.ok(grade(retry,10));
}});
