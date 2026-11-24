const fs=require('node:fs'),vm=require('node:vm'),test=require('node:test'),a=require('node:assert/strict');
const html=fs.readFileSync(process.env.HTML||require('node:path').join(__dirname,'../index.html'),'utf8');
function mod(key){
 const s={module:{exports:{}}};vm.runInNewContext(html.split('// '+key+'_START')[1].split('// '+key+'_END')[0],s);return s.module.exports;
}
const {manager}=mod('SCALE_PRACTICE'),{pitchReading}=mod('AUDIO_TOOLS');
const guide=s=>typeof s==='string'&&s.includes('還沒對上開頭');
async function lab(notes,mode='single',detector='existing'){
 const events=[];let now=100,sub,releases=0;
 const env={performance:{now:()=>now},setTimeout(){return 0;},clearTimeout(){}};
 const capture={subscribe(x){sub=x;return()=>{releases++};}};
 const m=manager(env,{capture,swiftCapture:capture,reference:()=>442,pitchName:midi=>pitchReading(442*2**((midi-69)/12),442).name,pitchReading});
 const view={mode,detector,target:notes.map(midi=>({midi})),update(...update){events.push(update);}};
 await m.toggle(view);sub.ready();
 return {events, current:()=>events.at(-1),release:()=>releases,
  play(midi,frames=3){for(let i=0;i<frames;i++){
   now+=27;sub.frame({now,frequency:midi==null?null:442*2**((midi-69)/12)});
  }},stop:()=>m.toggle(view),elapse(ms){now+=ms;sub.frame({now,frequency:null});}};
}
test('heard opening neighbors never create chart dots, scored pairs, passes, or accepted history',async()=>{
 for(const detector of ['existing','swift']){
  const x=await lab([38,40,42,43],'single',detector);
  x.play(40);a.ok(!guide(x.current()[1]));
  x.play(42);const live=x.current();a.match(live[1],/E2、F♯2.*D2.*不用停止/);
  a.equal(live[3],0);a.equal(live[5].values.filter(Number.isFinite).length,0);
  a.equal(x.release(),0);
  await x.stop();
  const after=x.current();a.equal(after[2].pairs.length,0);a.equal(after[2].complete,false);
  a.equal(after[5].attemptHistory,undefined);a.match(after[1],/沒有計入/);
 }
});
test('different order, actual octave errors, intervening wrong pitches and mirrored suffix do not trigger',async()=>{
 for(const seq of [[42,40],[52,54],[40,45,42],[43,42,40],[40]]){
  const x=await lab([38,40,42,43,42,40,38],'loop');
  seq.forEach(m=>x.play(m));
  a.ok(!x.events.some(e=>guide(e[1])));a.equal(x.current()[5].laps,0);
 }
});
test('an intentional warm-up pair followed by real start still completes; guide is rebuttable',async()=>{
 const x=await lab([38,40,42]);x.play(40);x.play(42);a.ok(guide(x.current()[1]));
 x.play(38);a.ok(!guide(x.current()[1]));x.play(40);x.play(42);
 const final=x.current();a.equal(final[0],'idle');a.equal(final[2].complete,true);
 a.equal(final[2].pairs.length,3);a.equal(x.release(),1);a.ok(final[5].attemptHistory);
});
test('loop shared tonic and elapsed timeout remain unchanged',async()=>{
 const y=await lab([36,38,40,38,36],'loop');
 y.play(38);y.play(40);a.ok(guide(y.current()[1]));
 [36,38,40,38,36,38,40,38,36].forEach(m=>y.play(m));
 a.equal(y.current()[5].laps,2);a.equal(y.current()[5].passed,2);a.ok(!guide(y.current()[1]));
 const x=await lab([38,40,42]);x.play(40);x.play(42);a.ok(guide(x.current()[1]));
 x.elapse(120000);a.equal(x.current()[0],'idle');a.match(x.current()[1],/2 分鐘/);
 a.ok(!guide(x.current()[1]));a.equal(x.current()[2].complete,false);
});
