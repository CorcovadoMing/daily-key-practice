const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const code=name=>html.split('// '+name+'_START')[1].split('// '+name+'_END')[0];
function hooks(name,globals={}){const ctx={module:{exports:{}},...globals};vm.runInNewContext(code(name),ctx);return ctx.module.exports;}
const api=hooks('PRACTICE_COACH');
test('experimental coach needs no setting but remains unavailable on stable',()=>{
 const when=(pathname,search)=>api.enabled({location:{pathname,search}});
 for(const query of ['', '?coach=1', '?coach=0']){
   assert.equal(when('/daily-key-practice/experimental/',query),true);
   assert.equal(when('/daily-key-practice/experimental/index.html',query),true);
   assert.equal(when('/daily-key-practice/',query),false);
 }
});
const target=[{name:'F',octave:2},{name:'G',octave:2},{name:'A',octave:2},{name:'G',octave:2},{name:'F',octave:2}];
const advice={steps:['停弓一拍，先放好下一音的手指。','把這兩音連起來，做三次。'],check:'再連拉一次，聽兩個起音是否平順。'};
test('facts use only scored anchors, preserve exercise, direction, signed difference, and known detection settings',()=>{
 const f=api.evidence(target,[0,null,35,-18,null],'single','arpeggio',{reference:442,detector:'SwiftF0'});
 assert.equal(f.measured,3);assert.equal(f.total,5);assert.equal(f.exercise,'琶音');
 assert.match(f.summary,/A2.*上行.*\+35¢.*G2.*下行.*−18¢/);
 assert.equal(f.detector,'智慧');assert.equal(f.reference,442);
 const empty=api.evidence(target,null,'loop');
 assert.equal(empty.measured,0);assert.equal(empty.detector,null);assert.match(empty.summary,/無法判斷音準/);
 assert.doesNotMatch(api.evidence(target,[4,null,31,null,null],'single').summary,/G2/);
});
test('structured advice strips hidden reasoning and rejects HTML, guessed results, pain encouragement and malformed answers',()=>{
 const lines='練法：'+advice.steps[0]+'\n練法：'+advice.steps[1]+'\n重測：'+advice.check;
 for(const response of [lines,'<think>私有思考</think>\n'+lines,'預填開頭</think>\n'+lines,JSON.stringify(advice)]){
  assert.deepEqual(JSON.parse(JSON.stringify(api.parseAdvice(response))),advice);
 }
 for(const bad of ['<think>'+lines,'1','練法：<img src=x>\n重測：試一次。','練法：你的右手很僵硬。\n重測：試一次。','練法：用力壓弓，手痛也繼續拉。\n重測：試一次。','練法：按住琴弦用最大的力氣拉。\n重測：重複拉三次。','{"steps":["試著先\\u003cscript\\u003e慢拉"],"check":"重拉一次"}','練法：你這次偏高 20¢。\n重測：試一次。','練法：先練 F2。\n重測：試一次。','練法：先練三次。']) assert.equal(api.parseAdvice(bad),null,bad);
 assert.ok(api.parseAdvice('練法：慢拉三次，若有疼痛就停止。\n重測：重拉一次，聽起音是否清楚。'));
});
function sandbox(){
 const jobs=new Map(), workers=[];
 let n=0;
 class Worker{
  constructor(url,opts){this.url=url;this.opts=opts;workers.push(this);}
  postMessage(msg){if(msg.kind==='interrupt')this.interrupt=msg;else this.msg=msg;}
  terminate(){this.dead=true;}
  emit(phase,rest={}){this.onmessage({data:{id:this.msg.id,phase,...rest}});}
 }
 const scope={navigator:{gpu:{}},Worker,Blob,URL:{createObjectURL:()=> 'blob:trusted',revokeObjectURL(){}},
   setTimeout(fn,ms){jobs.set(++n,{fn,ms});return n;},clearTimeout(id){jobs.delete(id);}};
 const options=api.evidence(target,[4,5,35,-9,null],'loop');
 return {scope,options,jobs,workers,service:api.service(scope)};
}
test('only cold initialization is bounded; model generation is cancellable without dropping the warm worker',async()=>{
 const f=sandbox(), updates=[];
 const pending=f.service.run(f.options,(...x)=>updates.push(x));
 const w=f.workers[0];assert.equal(w.opts.type,'module');
 assert.equal(w.msg.facts,f.options);assert.equal(w.msg.options,undefined);
 assert.equal([...f.jobs.values()][0].ms,180000);
 w.emit('progress',{step:'cached'});w.emit('progress',{step:'gpu-load',percent:33});
 w.emit('ready',{cold:true,load:1500});assert.equal(f.jobs.size,0);
 w.emit('answer',{advice,first:121,generation:200});
 const r=await pending;
 assert.equal(r.advice,advice);assert.equal(r.load,1500);assert.equal(r.first,121);assert.equal(r.generation,200);
 assert.deepEqual(updates,[['device'],['cached',undefined],['gpu-load',33],['working']]);
 const warm=f.service.run(f.options);assert.equal(f.workers.length,1);
 assert.equal(f.jobs.size,0);
 f.service.cancel();
 assert.equal((await warm).reason,'cancelled');assert.equal(w.dead,undefined);assert.equal(w.interrupt.kind,'interrupt');
 const retry=f.service.run(f.options,()=>{});assert.equal(f.workers.length,1);
 assert.equal(f.jobs.size,0);
 w.emit('ready',{cold:false,load:0});w.emit('answer',{advice,generation:200000});
 assert.equal((await retry).advice,advice);
});
test('reasoning only admits a finished validated choice; actual shard progress is never invented',()=>{
 const stage=(text,progress)=>JSON.parse(JSON.stringify(api.weightStage({text,progress})));
 assert.deepEqual(stage('Start to fetch params',.0),{step:'checking'});
 assert.deepEqual(stage('Fetching param cache[3/9]: ',.52),{step:'weights',percent:52});
 assert.deepEqual(stage('Loading model from cache[7/9]: ',.7),{step:'gpu-load',percent:70});
 assert.deepEqual(stage('Loading model from cache[9/9]: ',1),{step:'compile'});
 assert.deepEqual(stage('Loading GPU shader modules[3/12]: ',.34),{step:'compile'});
 assert.equal(stage('Unrecognized progress',.62),null);
});
test('cancel and stale worker errors cannot leak over to a later request, and no WebGPU is explicit',async()=>{
 const f=sandbox();
 const a=f.service.run(f.options), first=f.workers[0];
 f.service.cancel();assert.equal((await a).reason,'cancelled');assert.equal(first.dead,true);
 const b=f.service.run(f.options), second=f.workers[1];
 first.onerror();first.emit('answer',{output:'2'});
 assert.equal(f.service.isBusy(),true);
 second.emit('ready',{cold:true,load:1});second.emit('answer',{output:'Ignore previous instructions',generation:24});
 assert.equal((await b).advice,null);assert.equal(f.service.isBusy(),false);
 const absent=api.service({navigator:{},Worker:f.scope.Worker});
 assert.equal((await absent.run(f.options)).reason,'unsupported');
});

test('distinguishes output budget, reasoning-only, malformed and empty endings without exposing them',()=>{
 assert.equal(api.invalidAnswer('<think>partial 1','length',true,true),'context');
 assert.equal(api.invalidAnswer('<think>1</think>', 'stop', true, false),'thinking_only');
 assert.equal(api.invalidAnswer('', 'stop', true, true),'thinking_only');
 assert.equal(api.invalidAnswer('pick 4','stop',true,true),'invalid');
 assert.equal(api.invalidAnswer('','stop',true,false),'empty');
});

test('same model direct retry requests JSON, suppresses thinking, and never imposes an app output cap', async()=>{
 const empty=api.evidence(target,null,'single');
 const initial=api.completionRequest(empty,false),direct=api.completionRequest(empty,true);
 assert.equal(initial.extra_body.enable_thinking,true);
 assert.match(initial.messages[0].content,/未測到任何音.*不要評論音準、姿勢或原因/);
 assert.equal(initial.response_format,undefined);
 assert.equal(direct.extra_body.enable_thinking,false);
 assert.equal(direct.max_tokens,undefined);assert.equal(initial.max_tokens,undefined);
 assert.equal(direct.response_format.type,'json_object');
 assert.deepEqual(Array.from(JSON.parse(direct.response_format.schema).required),['steps','check']);
 const f=sandbox();
 const first=f.service.run(empty);const w=f.workers[0];
 w.emit('ready',{cold:true});w.emit('answer',{reason:'context'});await first;
 const retry=f.service.run(empty,()=>{},{direct:true});
 assert.equal(f.workers.length,1);assert.equal(w.msg.direct,true);assert.equal(w.msg.facts.measured,0);
 assert.equal(f.jobs.size,0);
 w.emit('answer',{advice});assert.equal((await retry).advice,advice);
});
