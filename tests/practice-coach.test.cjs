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
test('suggestions ground direction and exercise in actual notes, never infer cause',()=>{
 const target=[{name:'F',octave:2},{name:'G',octave:2},{name:'A',octave:2},{name:'G',octave:2},{name:'F',octave:2}];
 const options=api.drills(target,[0,null,35,-18,0],'single');
 assert.deepEqual(Array.from(options,x=>x.id),['slow_pair','center_one','bridge_pair']);
 assert.match(options[0].observation,/G2.*上行.*第 2 音.*不能判斷是漏拉還是未辨識/);
 assert.match(options[0].action,/F2.*G2.*兩拍.*三次/);
 assert.match(options[1].retest,/相同偵測方式和 A4.*\+35¢/);
 assert.match(options[2].observation,/下行.*−18¢/);
 assert.equal(api.drills(target,[null,null,null,null,null],'single').length,0);
 assert.equal(api.pick(' 2 ',options).id,'center_one');
 assert.equal(api.pick('<think>\n</think>\n3',options).id,'bridge_pair');
 for(const unsafe of ['<img src="#">','option 1','<think>3','1 2',''])assert.equal(api.pick(unsafe,options),null);
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
 const options=[{id:'center_one',fact:'offset@3:35'}, {id:'slow_pair',fact:'gap@2'}];
 return {scope,options,jobs,workers,service:api.service(scope)};
}
test('thinking is default, timeout leaves warm engine for a separate bounded quick request',async()=>{
 const f=sandbox(), updates=[];
 const pending=f.service.run(f.options,(...x)=>updates.push(x));
 const w=f.workers[0];assert.equal(w.opts.type,'module');assert.equal(w.msg.thinking,true);
 assert.deepEqual(Array.from(w.msg.options),['1 center_one offset@3:35','2 slow_pair gap@2']);
 assert.equal([...f.jobs.values()][0].ms,180000);
 w.emit('progress',{step:'cached'});w.emit('progress',{step:'gpu-load',percent:33});
 w.emit('ready',{cold:true,load:1500});assert.equal([...f.jobs.values()][0].ms,30000);
 w.emit('answer',{digit:2,first:121,generation:200});
 const r=await pending;
 assert.equal(r.choice.id,'slow_pair');assert.equal(r.load,1500);assert.equal(r.first,121);assert.equal(r.generation,200);
 assert.deepEqual(updates,[['device'],['cached',undefined],['gpu-load',33],['working']]);
 const warm=f.service.run(f.options);assert.equal(f.workers.length,1);
 assert.equal([...f.jobs.values()][0].ms,30000);
 w.emit('ready',{cold:false,load:0});[...f.jobs.values()][0].fn();
 assert.equal((await warm).reason,'slow');assert.equal(w.dead,undefined);assert.equal(w.interrupt.kind,'interrupt');
 const quick=f.service.run(f.options,()=>{},false);assert.equal(f.workers.length,1);assert.equal(w.msg.thinking,false);
 assert.equal([...f.jobs.values()][0].ms,10000);
 w.emit('ready',{cold:false,load:0}); w.emit('answer',{digit:1,generation:20});
 assert.equal((await quick).choice.id,'center_one');
});
test('reasoning only admits a finished validated choice; actual shard progress is never invented',()=>{
 for(const input of ['<think>3','I guess 3','<think>use option 3</think>','unfinished 3'])assert.equal(api.finalDigit(input),null);
 assert.equal(api.finalDigit('<think>first choice 2</think>\n3'),3);
 assert.equal(api.finalDigit('thinking text\n</think>\n1'),1,'Qwen may have prefilled the opening tag');
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
 assert.equal((await b).choice,null);assert.equal(f.service.isBusy(),false);
 const absent=api.service({navigator:{},Worker:f.scope.Worker});
 assert.equal((await absent.run(f.options)).reason,'unsupported');
});
