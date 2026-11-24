const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const standalone=path.join(__dirname,'../practice-progress.js');
const code=fs.existsSync(standalone)?fs.readFileSync(standalone,'utf8'):fs.readFileSync(path.join(__dirname,'../fingerboard.js'),'utf8').split('/* Local-only comparison with the last fresh take used for practice advice. */').at(-1);
const ctx={};vm.runInNewContext(code,ctx);const {create}=ctx.CelloPracticeProgress;
const plain=x=>JSON.parse(JSON.stringify(x));
const scope='major-C:scale';
const plan=(string,finger)=>({reviewed:true,string,finger,fingersReviewed:true,source:'visible-board'});
const note=(midi,direction,octave,name,string,finger)=>({midi,direction,octave,name,plan:plan(string,finger)});
const slots=[note(36,'up',2,'C','C',0),note(38,'up',2,'D','C',1),note(36,'down',2,'C','C',0)];
function attempt(beganAt,rows=[],over={}){
 return {scope,take:{id:'test:'+beganAt,beganAt},reference:442,detector:'SwiftF0',source:'confirmed/visible plan',
  slots:structuredClone(slots),rounds:rows.map((values,id)=>({id:id+1,values})),...over};
}
function storage(){
 const m=new Map(); return {m,get length(){return m.size;},key:i=>[...m.keys()][i]??null,getItem:k=>m.get(k)??null,
 setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};
}
const pitch={type:'pitch',slots:[1],minRounds:2}, interval={type:'interval',slots:[0,1],minRounds:2};
test('pins the originally acted-on slot only, compares positive and negative errors by absolute median',()=>{
 const s=storage(), api=create(s);
 assert.equal(api.pin(scope,attempt(100,[[0,32,0],[0,-28,0]]),pitch).status,'pinned');
 assert.deepEqual(plain(api.compare(scope,attempt(200,[[0,10,44],[0,-6,-44]]))),
  {status:'improved',label:'上行：C 弦上的 D的音準偏差',before:30,after:8,beforeRounds:2,afterRounds:2});
 assert.equal(api.compare(scope,attempt(201,[[0,45,0],[0,45,0]])).status,'worse');
 assert.equal(api.compare(scope,attempt(202,[[0,-29,0],[0,-33,0]])).status,'unchanged');
 assert.equal(api.compare(scope,attempt(203,[[0,-33,0],[0,-33,0]])).status,'worse');
 assert.equal(s.length,1,'reading several comparisons never changes baseline');
});
test('no invented take, no matching different key or exercise, detector, reference, order, route, or stale capture',()=>{
 const s=storage(),api=create(s);api.pin(scope,attempt(100,[[0,29,0],[0,31,0]]),pitch);
 const actual=attempt(200,[[0,0,0],[0,0,0]]);
 const other=structuredClone(actual);other.slots[1].plan.finger=4;
 const direction=structuredClone(actual);direction.slots[1].direction='down';
 for(const [key,x,why] of [[scope,actual,'ok'],['major-D♭:scale',actual,'no-baseline'],['major-C:arpeggio',actual,'no-baseline'],
   [scope,{...actual,reference:440},'settings'],[scope,{...actual,detector:'現有偵測'},'settings'],[scope,{...actual,restored:true},'provenance'],
   [scope,{...actual,source:'score only'},'provenance'],[scope,other,'route'],[scope,direction,'route'],[scope,attempt(100),'same-or-older']]){
   const v=api.compare(key,x);if(why==='ok')assert.equal(v.status,'improved');else assert.deepEqual(plain(v),{status:'unavailable',reason:why});
 }
});
test('interval uses both measured simultaneous round slots; missing, duplicates and zero-proof do not erase baseline',()=>{
 const s=storage(),api=create(s);
 assert.equal(api.pin(scope,attempt(100,[[17,-13,0],[-10,20,0]]),interval).status,'pinned');
 const missing=attempt(200,[[17,null,0],[null,17,0]]);
 assert.equal(api.compare(scope,missing).reason,'insufficient');
 assert.equal(api.pin(scope,missing,interval).reason,'insufficient');
 const duplicate=attempt(200,[[0,10,0],[0,10,0]]);duplicate.rounds[1].id=1;
 assert.equal(api.compare(scope,duplicate).reason,'insufficient');
 assert.deepEqual(plain(api.compare(scope,attempt(201,[[14,14,0],[-17,-17,0]]))),
  {status:'improved',label:'上行：C 弦上的 C → D的音程偏差',before:30,after:0,beforeRounds:2,afterRounds:2});
 assert.equal(api.pin(scope,attempt(210,[[12,0,13],[14,0,15]]),{...interval,slots:[1,2]}).reason,'insufficient');
 assert.equal(s.length,1);
});
test('front, tail and wobble require upstream-qualified trace for the correct slot and distinct laps',()=>{
 for(const [type,field] of [['front','front'],['tail','tail'],['wobble','range']]){
 const s=storage(),api=create(s), m={type,slots:[1],minRounds:2};
 const traces=(id,v)=>attempt(id,[[0,25,0],[0,25,0]],{trendMetrics:v});
 const data=(a,b)=>[{slot:1,lap:1,[field]:a},{slot:1,lap:2,[field]:b}];
 assert.equal(api.pin(scope,traces(100,data(25,25)),m).status,'pinned');
 assert.equal(api.compare(scope,traces(200,undefined)).reason,'insufficient');
 assert.equal(api.compare(scope,traces(201,data(10,10).map(x=>({...x,slot:2})))).reason,'insufficient');
 assert.equal(api.compare(scope,traces(202,data(10,10).map(x=>({...x,lap:1})))).reason,'insufficient');
 assert.equal(api.compare(scope,traces(202,data(10,10).map(x=>({...x,lap:x.lap+10})))).reason,'insufficient');
 const unmeasured=traces(202,data(10,10));unmeasured.rounds[0].values[1]=null;
 assert.equal(api.compare(scope,unmeasured).reason,'insufficient');
 const got=api.compare(scope,traces(203,data(10,9))); assert.equal(got.status,'improved');assert.equal(got.after,9.5);assert.equal(got.afterRounds,2);
 }
});
test('two tab instances cannot overwrite a newer captured baseline; storage failures are explicit',()=>{
 const s=storage(),a=create(s),b=create(s),take=n=>attempt(n,[[0,20,0],[0,24,0]]);
 assert.equal(a.pin(scope,take(200),pitch).status,'pinned');
 assert.equal(b.pin(scope,take(100),pitch).reason,'stale');
 assert.equal(b.compare(scope,take(300)).status,'unchanged');
 assert.equal(s.length,1);assert.match([...s.m.keys()][0],/:test:200$/);
 assert.equal(b.pin(scope,take(350),pitch).status,'pinned');
 assert.equal(s.length,1);assert.match([...s.m.keys()][0],/:test:350$/);
 assert.equal(b.pin(scope,take(350),{type:'pitch',slots:[0],minRounds:1}).status,'pinned');
 assert.equal(a.compare(scope,take(400)).label,'上行：C 弦上的 D的音準偏差','same take cannot re-pin a different metric');
 const blocked=create({get length(){throw Error('blocked');}});
 assert.equal(blocked.compare(scope,take(400)).reason,'storage');
 assert.equal(blocked.pin(scope,take(400),pitch).reason,'storage');
});
test('concurrent tab write interleaved during pin preserves newest id; no per-sample or text data persisted',()=>{
 const s=storage(),a=create(s),b=create(s),set=s.setItem;
 let nested=false;
 s.setItem=(key,v)=>{if(!nested){nested=true;b.pin(scope,attempt(200,[[0,15,0],[0,15,0]]),pitch);}set(key,v);};
 const result=a.pin(scope,attempt(100,[[0,28,0],[0,28,0]],{audio:'NEVER',trendMetrics:[{raw:'NEVER'}]}),pitch);
 assert.equal(result.reason,'stale');
 assert.equal(s.length,1);
 const [raw]=s.m.values();assert.doesNotMatch(raw,/NEVER|audio|trendMetrics|values/);
 assert.equal(a.compare(scope,attempt(300,[[0,5,0],[0,5,0]])).before,15);
});

test('canonical score-card spelling accepts real Unicode keys without merging exercise, mode or enharmonic IDs',()=>{
 const api=create(storage()),file=fs.readFileSync(path.join(__dirname,'../fingerboard.js'),'utf8');
 assert.match(file,/const id=\(mode==='major'\?'major-':'minor-'\)\+key\[0\]/);
 const first=attempt(100,[[0,22,0],[0,23,0]]),second=attempt(200,[[0,0,0],[0,0,0]]);
 for(const key of ['major-D♭:scale','minor-F♯:scale','minor-C♯:arpeggio']){
  assert.equal(api.pin(key,first,pitch).status,'pinned');
  assert.equal(api.compare(key,second).status,'improved');
 }
 for(const key of ['major-C♯:scale','minor-D♭:scale','minor-F#:scale','minor-F♯:scale ','minor-F♯:scale\n','major-0:scale'])
  assert.equal(api.compare(key,second).reason,'provenance');
 assert.equal(api.compare('minor-F♯:arpeggio',second).reason,'no-baseline');
});
