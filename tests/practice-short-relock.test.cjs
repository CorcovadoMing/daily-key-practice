const fs=require('node:fs'),vm=require('node:vm'),a=require('node:assert/strict'),test=require('node:test');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const box={module:{exports:{}},observe:[]};
const source=html.split('// SCALE_PRACTICE_START')[1].split('// SCALE_PRACTICE_END')[0].replace(
 'function scoreValues(target, heard, result) {',
 'function scoreValues(target, heard, result) { observe.push(result.pairs.map(p=>({slot:p.expected,at:heard[p.heard].at})));');
vm.runInNewContext(source,box);
const {manager}=box.module.exports;
const target=[36,38,40,41,43,45,47,48,50,52,53,55,57,59,60,59,57,55,53,52,50,48,47,45,43,41,40,38,36].map(midi=>({midi}));
async function play(atoms,{mode='single',detector='existing'}={}){
 box.observe.length=0;
 let now=0,listener,state;
 const route={subscribe(h){listener=h;return()=>{};}};
 const m=manager({performance:{now:()=>now}},
  {capture:route,swiftCapture:route,reference:()=>442,pitchReading:midi=>({midi,cents:0}),pitchName:String});
 const view={target,mode,detector,update(...args){state=args;}};
 await m.toggle(view);listener.ready();
 const checkpoints=[];
 for(const atom of atoms){
  const [frequency,frames]=Array.isArray(atom)?atom:[atom,5];
  for(let i=0;i<frames;i++){
   now+=27;listener.frame({now,frequency,swiftHop:Math.round(now/16),confidence:.95,muted:false});
  }
  const values=state[5]?.values;
  checkpoints.push(values?Array.from(values,(v,i)=>Number.isFinite(v)?i:-1).filter(i=>i>=0):[]);
 }
 if(state[0]==='listening')await m.toggle(view);
 return {slots:Array.from(state[2]?.pairs??[],p=>p.expected),complete:Boolean(state[2]?.complete),laps:state[5]?.laps??0,passed:state[5]?.passed??0,checkpoints,timed:JSON.parse(JSON.stringify(box.observe)),frontier:state[5]?.progress??0};
}
const early=[43,45,47];
test('three adjacent ascending sounds can anchor much later than the missed opening but not color it',async()=>{
 for(const detector of ['existing','swift']){
   const found=await play(early,{detector});a.deepEqual(found.slots,[4,5,6]);a.equal(found.frontier,7);a.equal(found.complete,false);
   a.deepEqual(found.checkpoints.slice(0,2),[[],[]]);
 }
});
test('expected tonic wins immediately, long held notes and two clean loops work',async()=>{
 const us=target.map(x=>x.midi);
 const held=await play(us.map(p=>[p,32]));
 a.equal(held.complete,true);a.equal(held.slots.length,target.length);
 const loops=await play([...us,...us.slice(1)],{mode:'loop'});
 a.equal(loops.passed,2);a.equal(loops.laps,2);
 const retry=await play([...early,...us]);
 a.equal(retry.complete,true);a.equal(retry.slots.length,target.length);
});
test('wrong order, octave alias, non-note, held pitch and long interruption never create an anchor',async()=>{
 for(const phrase of [[43,47,45],[55,57,59],[43,45],[[43,46]],[43,[null,37],45,47],[43,[55,1],45,47],[[null,60]]]){
   const result=await play(phrase);
   a.deepEqual(result.slots,[],JSON.stringify(phrase));
 }
});
test('forward re-lock after an earlier missed group never fills slots skipped, rewind alone never jumps',async()=>{
 const verified=await play([36,38,40,[null,12],47,48,50,52]);
 a.deepEqual(verified.slots,[0,1,2,6,7,8,9]);
 const back=await play([36,38,40,[null,24],47,45,43]);
 a.ok(!back.slots.includes(6));
});

test('low octave flips cannot support an apparent early D2–E2 prefix',async()=>{
 const result=await play([[36,1],[null,8],[38,2],[50,1],[40,2],[52,1],[null,32],41]);
 a.deepEqual(result.slots,[]);
});
test('after a re-lock, a missed closing tonic cannot rewrite the descent with notes from a later incomplete round',async()=>{
 const first=target.slice(4,-1).map(x=>x.midi);
 const second=target.slice(1,-1).map(x=>x.midi);
 const result=await play([...first,[null,9],...second],{mode:'loop'});
 a.equal(result.laps,0);
 a.deepEqual(result.slots,Array.from({length:first.length},(_,i)=>i+4));
 a.ok(result.timed.at(-1).every(row=>row.at<=first.length*5*27));
});
