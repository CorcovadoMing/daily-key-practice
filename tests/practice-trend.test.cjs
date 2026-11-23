const test=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
function section(name,extras={}) {
 const c={module:{exports:{}}, ...extras};
 vm.runInNewContext(html.split('// '+name+'_START')[1].split('// '+name+'_END')[0],c);
 return c.module.exports;
}
const practice=section('SCALE_PRACTICE'),coach=section('PRACTICE_COACH'),json=x=>JSON.parse(JSON.stringify(x));
const p=(midi,cents)=>({midi,cents});
test('elapsed timestamps preserve initial silence and every explicit/time/slot/lap gap',()=>{
 const t=practice.createPitchTrend(1000);
 t.observe(999,p(41,3),0,1); t.observe(1000,null,null,1);
 for(const x of [[1600,3,0,1],[1616,10,0,1],[1648,15,0,1],[1680,null,null,1],[1696,-9,0,1],
                 [1712,2,null,1],[1730,-8,0,1],[1827,2,0,1],[1843,3,1,1],[1859,4,1,2]])
   t.observe(x[0],x[1]===null?null:p(41,x[1]),x[2],x[3]);
 t.observe(2500,null,null,2);t.observe(2400,p(41,2),0,2);
 const out=t.snapshot();
 a.equal(out.start,0);a.equal(out.end,1500);
 a.deepEqual(json(out.data.map(x=>x.ms)),[600,648,696,730,827,843,859]);
 a.deepEqual(json(practice.trendSegments(out.data).map(x=>x.length)),[2,1,1,1,1,1]);
});
test('long takes retain bounded trailing data with absolute elapsed times',()=>{
 const t=practice.createPitchTrend(1234);
 for(let i=0;i<=20000;i++)t.observe(1234+i*16,p(41,4),i%2,1);
 const out=t.snapshot();
 a.equal(out.end,320000);a.ok(out.data.length<=2564);
 a.ok(out.start>=200000);a.equal(out.data[0].ms,out.start);
 a.ok(out.data.every(x=>x.ms>=out.start));
});
function held(pattern,repeated=true){
 const t=practice.createPitchTrend(1);
 for(const origin of repeated?[1001,1901]:[1001]){
  const lap=origin===1001?1:2;
  for(let i=0;i<11;i++)t.observe(origin+i*48,p(41,pattern(i)),0,lap);
  t.observe(origin+550,null,null,lap);
 }
 return practice.pitchTrendSummary(t.snapshot());
}
test('sustained observations distinguish repeated settlement from persistent offset without a bow diagnosis',()=>{
 const settling=held(i=>i<4?27:5),persistent=held(i=>i<4?-27:-24);
 a.equal(settling.pattern,'settles');a.equal(settling.repeats,2);
 a.equal(persistent.pattern,'persists');a.equal(persistent.repeats,2);
 a.equal(held(i=>i<4?27:5,false).pattern,'held');
 const split=practice.createPitchTrend(0);
 for(const start of [1000,1900]){
  for(let i=0;i<11;i++)split.observe(start+i*48,p(41,i<4?27:5),0,1);
  split.observe(start+600,null,null,1);
 }
 a.equal(practice.pitchTrendSummary(split.snapshot()).pattern,'held');
 const slots=[{midi:41,name:'F',octave:2},{midi:43,name:'G',octave:2}];
 const close=coach.evidence(slots,[10.1,-20.1],'single','scale',{visual:practice.chartPoint});
 a.match(close.rows[0],/F2.*\+10\.1¢.*黃・略偏/);
 a.match(close.rows[1],/G2.*−20\.1¢.*紅・偏差較大/);
 const facts=coach.evidence(slots,[8,null],'single','scale',{trend:settling,reference:442,detector:'SwiftF0'});
 a.match(facts.rows[0],/F2.*前段 \+27¢、後段 \+5¢.*多輪由偏離回到較接近中心/);
 a.doesNotMatch(JSON.stringify(facts),/segment|audioTime|trajectory|"data":/);
 a.doesNotMatch(coach.evidence(slots,[null,8],'single','scale',{trend:settling}).report,/前段|多輪/);
 a.doesNotMatch(coach.evidence(slots,null,'single','scale',{trend:settling}).report,/前段|多輪/);
 const prompt=coach.completionRequest(facts,false).messages[0].content;
 a.match(prompt,/^你是虛擬大提琴老師。你的工作是給正在學習大提琴的學生具體、有建設性、能馬上練習的建議。/);
 a.match(prompt,/不可推斷節奏、弓法或動作原因/);
});
test('actual manager only records fresh, positively attributed pitch on either practice and graphs the final accepted point',async()=>{
 for(const kind of ['scale','arpeggio']){
  let callbacks,now=123000,updates=[];
  const capture={subscribe(listener){callbacks=listener;return ()=>{};}};
  const manager=practice.manager({performance:{now:()=>now}},{capture,swiftCapture:capture,
    reference:()=>444,pitchReading:f=>f,pitchName:String});
  const view={target:[{midi:41},{midi:kind==='scale'?43:45}],kind,mode:'single',detector:kind==='scale'?'swift':'existing',update(...args){updates.push(args);}};
  await manager.toggle(view);callbacks.ready();
  const first=now;
  const frame=(at,frequency,muted=false)=>{now=first+at;callbacks.frame({now,frequency,muted});};
  for(let i=1;i<15;i++)frame(i*24,p(41,20-i));
  frame(360,null);frame(384,null,true);frame(408,p(41,8),true);frame(432,p(53,9));frame(456,p(53,8));
  for(let i=20;i<30;i++)frame(i*24,p(view.target[1].midi,-4));
  const final=updates.findLast(x=>x[0]==='idle');
  a.ok(final[2].complete);a.equal(final[5].trend.reference,444);
  const out=final[5].trend;
  a.ok(out.data.some(x=>x.slot===0));a.equal(out.data.at(-1).slot,1);
  a.ok(out.data.every(x=>x.ms<360||x.ms>=480));
  a.equal(practice.trendSegments(out.data).length,2);
  a.ok(updates.filter(x=>x[0]==='listening').every(x=>!x[5].trend),'no live chart build or replace');
 }
});
test('native disclosure lazily renders labelled real-time axes and separately broken strokes',()=>{
 class Node{
  constructor(tag){this.tag=tag;this.attrs={};this.children=[];this.listeners={};}
  append(...nodes){this.children.push(...nodes);}
  setAttribute(k,v){this.attrs[k]=v;}
  addEventListener(k,cb){this.listeners[k]=cb;}
 }
 const doc={createElement:tag=>new Node(tag),createElementNS:(_,tag)=>new Node(tag)};
 const core=section('SCALE_PRACTICE',{document:doc});
 const t=core.createPitchTrend(100);
 for(const [now,cents] of [[100,3],[148,7],[200,null],[350,-4],[398,-8],[2000,null]])
   t.observe(now,cents===null?null:p(41,cents),cents===null?null:0,1);
 const node=core.pitchTrendChart({...t.snapshot(),reference:442},[{name:'F',octave:2}],'音階');
 a.equal(node.tag,'details'); a.equal(node.children.length,1);
 a.equal(node.children[0].textContent,'音準走勢');
 node.listeners.toggle();a.equal(node.children.length,1);
 node.open=true;node.listeners.toggle();node.listeners.toggle();
 const [_,desc,scroll]=node.children;
 a.equal(node.children.length,3);a.match(desc.textContent,/±50¢.*空白.*完整起音.*A4 442/);
 a.equal(scroll.tabIndex,0);
 const svg=scroll.children[0];
 a.match(svg.attrs['aria-label'],/0 秒 到 1\.9 秒/);
 a.equal(svg.children.filter(x=>x.tag==='path').length,2);
 a.ok(svg.children.some(x=>x.attrs.class==='trend-zero'));
 a.ok(svg.children.some(x=>x.textContent==='F2'));
 a.match(html,/\.scale-pitch-trend-scroll\{overflow:auto;max-width:100%\}/);
});

test('a prior draft or sparse current take keeps the disclosure without drawing invented times',()=>{
 const make=tag=>({tag,children:[],append(...x){this.children.push(...x);},addEventListener(_,cb){this.toggle=cb;}});
 const core=section('SCALE_PRACTICE',{document:{createElement:make}});
 for(const restored of [false,true]){
  const node=core.pitchTrendChart(undefined,[],'琶音',restored);
  a.equal(node.children[0].textContent,restored?'上次音準走勢':'音準走勢');
  node.open=true;node.toggle();
  a.equal(node.children.length,2);
  a.match(node.children[1].textContent,restored?/上次只保留.*沒有可用/:/沒有足夠.*樣本/);
 }
});
