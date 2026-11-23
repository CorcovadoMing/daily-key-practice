const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
function load(name,globals={}){
 const box={module:{exports:{}},Float32Array,...globals};
 vm.runInNewContext(html.split('// '+name+'_START')[1].split('// '+name+'_END')[0],box);
 return box.module.exports;
}
const {createSwiftBatches,swiftPracticeCapture,pitchReading}=load('AUDIO_TOOLS');
const {manager}=load('SCALE_PRACTICE');
const tick=()=>new Promise(setImmediate);
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
test('shared batches use unique 16ms capture timestamps and infer once for both subscribers',async()=>{
 let calls=0, reads=0;
 const raw=(time,clock)=>({now:time,audioTime:time/1000,rate:48000,clock,readSwift(){reads++;return new Float32Array(32768).fill(.01);}});
 const detector={async infer(samples,indices){calls++;assert.equal(samples.length,7168);return indices.map(i=>100+i);}};
 const batch=createSwiftBatches(detector), clock={};
 const first=batch(raw(500,clock));assert.equal(first,batch(raw(500,clock)));
 const a=await first;
 assert.equal(a.length,1);
 assert.ok(Math.abs(a[0].now-320)<1e-6);
 assert.equal(batch(raw(527,clock)),null);
 const second=batch(raw(554,clock));assert.equal(second,batch(raw(554,clock)));
 const b=await second;
 assert.equal(b.length,3);
 assert.deepEqual(Array.from(b,x=>Math.round(x.now)),[336,352,368]);
 assert.equal(calls,2);assert.equal(reads,2);
 const restart=await batch(raw(20,{}));assert.equal(restart.length,1);
 assert.ok(restart[0].now<20);
});
test('stop grades the last pre-click Swift frames and ignores pre-start and post-click pitches',async()=>{
 const gate=deferred();let raw,now=100,releases=0,legacy=0,last,latest;
 const env={performance:{now:()=>now},setTimeout,clearTimeout};
 const capture={subscribe(listener){raw=listener;return ()=>releases++;}};
 const legacyCapture={subscribe(){legacy++;return ()=>{};}};
 const detector={load:()=>gate.promise};
 const swiftCapture=swiftPracticeCapture(env,capture,detector,()=>Promise.resolve(latest),()=>false);
 const scale=manager(env,{capture:legacyCapture,swiftCapture,pitchReading,pitchName:String,reference:()=>442});
 const view={target:[{midi:41},{midi:43}],detector:'swift',mode:'loop',update(...state){last=state;}};
 const hz=midi=>442*2**((midi-69)/12);
 const frames=(midi,...times)=>times.map(now=>({frequency:hz(midi),now,muted:false}));
 await scale.toggle(view);raw.ready();assert.equal(raw.raw(),true);assert.match(last[1],/智慧偵測/);
 gate.resolve();await tick();
 assert.equal(last[0],'listening');
 latest=frames(41,60,76,92);raw.frame({});await tick();assert.equal(last[3],0);
 latest=frames(41,112,128,144);raw.frame({});await tick();assert.equal(last[3],1);
 now=215;
 const stopped=scale.toggle(view);
 assert.match(last[1],/最後一音/);
 latest=[...frames(43,160,176,192),...frames(44,208,224,240)];raw.frame({});await stopped;
 assert.equal(last[0],'idle');assert.equal(last[2].complete,true);
 assert.equal(last[2].extra,0);assert.equal(legacy,0);assert.equal(releases,1);
});
test('missing or failed Swift request does not fall back to the original detector',async()=>{
 const gate=deferred();let listener,releases=0,legacy=0,last;
 const env={performance:{now:()=>100},setTimeout,clearTimeout};
 const swiftCapture=swiftPracticeCapture(env,{subscribe(h){listener=h;return ()=>releases++;}},
  {load:()=>gate.promise},()=>null,()=>false);
 const scale=manager(env,{capture:{subscribe(){legacy++;}},swiftCapture,reference:()=>442});
 const view={target:[{midi:41}],detector:'swift',mode:'single',update(...r){last=r;}};
 await scale.toggle(view);listener.ready();gate.reject(Error('network'));await tick();
 assert.match(last[1],/智慧偵測無法載入.*傳統/);assert.equal(last[0],'idle');assert.equal(releases,1);assert.equal(legacy,0);
});
class Node{
 constructor(){this.children=[];this.dataset={};this.attributes={};this.handlers={};this.style={setProperty(){}};}
 append(...items){this.children.push(...items);}
 setAttribute(n,v){this.attributes[n]=v;}
 addEventListener(n,f){this.handlers[n]=f;}
 find(name){return this.className?.split(' ').includes(name)?this:this.children.map(x=>x.find(name)).find(Boolean);}
}
test('scale detector uses visible native segments and only explicit scope choices are saved',()=>{
 const saved=new Map(),writes=[];
 const localStorage={getItem:k=>saved.get(k),setItem(k,v){saved.set(k,v);writes.push(k);}};
 const fresh=()=>load('SCALE_PRACTICE',{document:{createElement:()=>new Node()},localStorage});
 const score={querySelectorAll:()=>[]}, {card}=fresh();
 let starts=0;
 const scale=card(score,[],()=>starts++,'scale','major-C'), arpeggio=card(score,[],()=>starts++,'arpeggio','major-C');
 const other=card(score,[],()=>starts++,'scale','minor-C');
 const segment=scale.element.find('scale-practice-detector');
 const [trad,smart]=segment.children.map(label=>label.children[0]);
 assert.deepEqual(segment.children.map(label=>label.children[1].textContent),['傳統','智慧']);
 assert.equal(trad.type,'radio');assert.equal(smart.checked,true);
 assert.equal(trad.name,smart.name);
 assert.notEqual(trad.name,other.element.find('scale-practice-detector').children[0].children[0].name);
 assert.equal(scale.detector,'swift');assert.equal(arpeggio.detector,'swift');
 const arpTrad=arpeggio.element.find('scale-practice-detector').children[0].children[0];
 assert.notEqual(arpTrad.name,trad.name);
 assert.equal(writes.length,0);
 assert.equal(starts,0);
 scale.update('pending','正在準備智慧偵測…');assert.equal(segment.disabled,true);
 trad.checked=true;trad.handlers.change();assert.equal(scale.detector,'swift');assert.equal(writes.length,0);
 scale.update('idle');assert.equal(segment.disabled,false);
 assert.equal(trad.checked,false);assert.equal(smart.checked,true);
 trad.checked=true;smart.checked=false;trad.handlers.change();
 assert.equal(scale.detector,'existing');assert.equal(starts,0);assert.equal(writes.length,1);
 const reloaded=fresh().card;
 assert.equal(reloaded(score,[],()=>{},'arpeggio','major-C').detector,'swift');
 arpTrad.checked=true;arpTrad.handlers.change();
 assert.equal(writes.length,2);
 assert.ok(writes[0].endsWith(':major-C'));assert.ok(writes[1].endsWith(':arpeggio:major-C'));
 assert.equal(fresh().card(score,[],()=>{},'arpeggio','major-C').detector,'existing');
 assert.equal(reloaded(score,[],()=>{},'scale','major-C').detector,'existing');
 assert.equal(reloaded(score,[],()=>{},'scale','minor-C').detector,'swift');
});
test('lookahead grace admits already-captured exact next notes without making a fuzzy hop renew the clock',async()=>{
 for(const second of [43,45]){
  let wall=0,listen,due,timer,last;
  const env={performance:{now:()=>wall},setTimeout(fn,ms){timer=fn;due=wall+ms;return 1;},clearTimeout(){timer=null;}};
  function advance(now){while(timer&&due<=now){wall=due;const fn=timer;timer=null;fn();}wall=now;}
  const tool=manager(env,{capture:{subscribe(){assert.fail('no legacy fallback');}},
   swiftCapture:{subscribe(h){listen=h;return ()=>{};}},reference:()=>442,pitchReading,pitchName:String});
  const view={target:[41,43,45,46].map(midi=>({midi})),detector:'swift',mode:'loop',update(...state){last=state;}};
  await tool.toggle(view);listen.ready();
  function frames(midi,...timestamps){
   const frequency=442*2**((midi-69)/12);
   timestamps.forEach(now=>listen.frame({now,frequency}));
  }
  advance(290);frames(41,68,84,100);
  advance(120300);
  frames(second,120058,120074,120090);
  assert.equal(last[3],second===43?2:3);
  advance(120370);
  assert.equal(last[0],second===43?'listening':'idle');
  tool.stop();
 }
});
