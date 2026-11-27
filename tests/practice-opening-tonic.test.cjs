const fs=require('node:fs'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
const src=html.slice(html.indexOf('  function openingTonicGuard('),html.indexOf('  function manager(env, hooks)'));
const make=vm.runInNewContext(src+'\nopeningTonicGuard',{withinCents:c=>Math.abs(c)<=50+1e-7});
const ev=midi=>({midi});
const score=[36,38,40,41,43,45,47,48,47,45,43,41,40,38,36].map(midi=>({midi}));
test('normal onset unaffected by warmup',()=>{
 const run=make(score,8).observe;
 for(const midi of [40,38,42,45,47,36])assert.equal(run(ev(midi)),undefined);
});
test('wrong octave and reattack do not prove an opening',()=>{
 const run=make(score,8).observe;
 for(const midi of [47,45,43,38])run(ev(midi));
 for(const midi of [36,36,48,38,40])assert.equal(run(ev(midi)),null);
});
test('three tracked ascending events reopen, earlier original audio events untouched',()=>{
 const run=make(score,8).observe;
 for(const midi of [47,45,43,38])run(ev(midi));
 const tonic={midi:36,cents:-4}, second={midi:38,cents:1};
 assert.equal(run(tonic),null);assert.equal(run(second),null);
 const accepted=run(ev(40));assert.equal(accepted[0],tonic);assert.equal(accepted[1],second);
});
test('conflicting event breaks pending; fresh correct restart accepted',()=>{
 const run=make(score,8).observe;
 for(const midi of [47,45,43,36,38,42,40])run(ev(midi));
 assert.equal(run(ev(38)),null);assert.equal(run(ev(40)),null);
 for(const midi of [36,38])assert.equal(run(ev(midi)),null);
 assert.equal(run(ev(40)).length,2);
});
test('sustained tonic can confirm ascent; 3s silence cannot backfill warmup tonic',()=>{
 for(const silence of [true,false]){
  const guard=make(score,8),run=guard.observe;
  for(const [i,midi] of [47,45,43,36].entries())run(ev(midi),100*i);
  const signal=silence?null:{midi:36,cents:3};
  for(let t=325;t<=3400;t+=25)guard.sample(signal,signal,t);
  assert.equal(run(ev(38),3500),null);
  const result=run(ev(40),3650);
  if(silence)assert.equal(result,null);else assert.equal(result[0].midi,36);
 }
});
