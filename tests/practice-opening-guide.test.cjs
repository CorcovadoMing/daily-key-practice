const fs=require('node:fs'),vm=require('node:vm'),test=require('node:test'),a=require('node:assert/strict');
const html=fs.readFileSync(process.env.HTML||require('node:path').join(__dirname,'../index.html'),'utf8');
function mod(key){
 const s={module:{exports:{}}};vm.runInNewContext(html.split('// '+key+'_START')[1].split('// '+key+'_END')[0],s);return s.module.exports;
}
const {manager}=mod('SCALE_PRACTICE'),{pitchReading}=mod('AUDIO_TOOLS');
const guide=s=>typeof s==='string'&&(s.includes('還沒對上開頭')||s.includes('第一音未對上'));
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
test('a confirmed opening pair marks only real later score positions, never fills tonic or saves unconfirmed history',async()=>{
 for(const detector of ['existing','swift']){
  const x=await lab([38,40,42,43],'single',detector);
  x.play(40);a.ok(!guide(x.current()[1]));
  x.play(42);const live=x.current();a.match(live[1],/第一音未對上.*接著練|重新拉第一音/);
  a.equal(live[3],3);a.deepEqual(Array.from(live[5].values),[null,0,0,null]);
  a.equal(x.release(),0);
  await x.stop();
  const after=x.current();a.deepEqual(Array.from(after[2].pairs,p=>p.expected),[1,2]);a.equal(after[2].complete,false);
  a.equal(after[5].attemptHistory,undefined);a.equal(after[5].planDiagnostics,undefined);a.match(after[1],/只計入後續/);
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

test('one confirmed later continuation retains measured partial and never declares the opener passed',async()=>{
 const x=await lab([36,38,40,41]);
 [38,40,41].forEach(m=>x.play(m));
 a.equal(x.current()[0],'listening');a.equal(x.release(),0);
 await x.stop();
 const final=x.current();
 a.deepEqual(Array.from(final[2].missing),[0]);a.equal(final[2].complete,false);
 a.ok(final[5].attemptHistory);a.equal(final[5].values[0],null);
});
test('an incomplete first cycle can close only with known descent, and true shared tonic seeds a clean next loop',async()=>{
 const x=await lab([36,38,40,41,43,41,40,38,36],'loop');
 [38,40,41,43,41,40,38,36].forEach(m=>x.play(m));
 let d=x.current()[5];
 a.equal(d.laps,1);a.equal(d.passed,0);a.equal(d.history[0].size,0);a.equal(d.values[0],0);
 [38,40,41,43,41,40,38,36].forEach(m=>x.play(m));
 d=x.current()[5];a.equal(d.laps,2);a.equal(d.passed,1);a.equal(d.history[0].size,1);
});
test('delayed adjacent notes can form a partial; a real subsequent start resets their score, draft and trend',async()=>{
 const x=await lab([36,38,40,41,43]);x.elapse(90000);x.play(38);x.play(40);
 a.ok(x.current()[5].openingRecovered);a.equal(x.current()[5].values[0],null);
 x.play(36);
 a.equal(x.release(),0);a.equal(x.current()[5].openingRecovered,false);
 a.deepEqual(Array.from(x.current()[5].values),[0,null,null,null,null]);
 [38,40,41,43].forEach(m=>x.play(m));
 const final=x.current();
 a.equal(final[2].complete,true);a.equal(final[2].extra,0);
 a.ok(final[5].trend.data.every(p=>p.ms<=500)); // old warmup timing not mixed
});

test('long silence before opening pair or corroboration cannot turn isolated notes into a saved take',async()=>{
 const start=await lab([36,38,40,41,43]);
 start.play(38);start.elapse(45000);start.play(40);start.elapse(45000);start.play(41);
 a.equal(start.current()[5].openingRecovered,false);
 await start.stop();
 a.equal(start.current()[2].pairs.length,0);a.equal(start.current()[5].attemptHistory,undefined);a.equal(start.current()[5].planDiagnostics?.rounds.length??0,0);
 const middle=await lab([36,38,40,41,43]);
 middle.play(38);middle.play(40);a.ok(middle.current()[5].openingRecovered);
 middle.elapse(45000);middle.play(41);
 a.equal(middle.current()[5].openingRecovered,false);
 await middle.stop();
 a.equal(middle.current()[2].pairs.length,0);a.equal(middle.current()[5].attemptHistory,undefined);a.equal(middle.current()[5].planDiagnostics?.rounds.length??0,0);
});

test('slow sustained notes and breathing pauses retain a continuous evidence chain without a tempo requirement',async()=>{
 const x=await lab([36,38,40,41,43]);
 x.play(38,200);x.elapse(1800);x.play(40,160);x.elapse(1900);x.play(41);
 await x.stop();
 const final=x.current();
 a.deepEqual(Array.from(final[2].pairs,p=>p.expected),[1,2,3]);
 a.ok(final[5].attemptHistory);
 assertPartial(final);
 function assertPartial(result){a.equal(result[2].complete,false);a.equal(result[5].values[0],null);}
});

test('sparse repeated pulses cannot renew or re-arm opening support even if pitches are genuinely steady for two frames',async()=>{
 for(const afterBoot of [false,true]){
  const x=await lab([36,38,40,41,43]);
  x.play(38);
  if(afterBoot){x.play(40);a.equal(x.current()[5].openingRecovered,true);}
  const note=afterBoot?40:38;
  for(let burst=0;burst<15;burst++){x.elapse(2200);x.play(note,2);}
  if(!afterBoot)x.play(40);
  x.play(41);
  a.equal(x.current()[5].openingRecovered,false);
  await x.stop();
  a.equal(x.current()[2].pairs.length,0);
  a.equal(x.current()[5].attemptHistory,undefined);
  a.equal(x.current()[5].planDiagnostics?.rounds.length??0,0);
 }
});
