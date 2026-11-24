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
 const trace=split.snapshot();
 const facts=coach.evidence(slots,[8,null],'single','scale',{trace,reference:442,detector:'SwiftF0'});
 a.match(facts.rows[0],/F2.*\+8¢/);a.match(facts.rows[1],/G2.*未辨識/);
 a.deepEqual(facts.trace,trace);
 a.doesNotMatch(facts.report,/前段|多輪/);
 const prompt=coach.completionRequest(facts,false,coach.packFullTrace(trace,{unbounded:true})[0].text).messages[0].content;
 a.match(prompt,/^你是虛擬大提琴老師。/);
 a.match(prompt,/不要推斷節奏、弓法/);
 a.match(prompt,/時間走勢原始資料：[\s\S]*線段間沒有連線/);
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
class ChartNode{
 constructor(tag){this.tag=tag;this.attrs={};this.dataset={};this.children=[];this.listeners={};this.scrollLeft=0;this.clientWidth=300;}
 append(...nodes){this.children.push(...nodes);}
 setAttribute(k,v){this.attrs[k]=String(v);}
 addEventListener(k,cb){this.listeners[k]=cb;}
 getBoundingClientRect(){return {top:0,left:0,width:Number(this.attrs.width)||300,height:112};}
}
const chartDocument={createElement:tag=>new ChartNode(tag),createElementNS:(_,tag)=>new ChartNode(tag)};
const pathOf=(t,cls)=>t.children[2].children[0].children.find(x=>x.attrs.class===cls);
const svgOf=t=>t.children[2].children[0];
test('both time plots are visible and share only measured end points, preserve pause and distinguish repeated pitches',()=>{
 const core=section('SCALE_PRACTICE',{document:chartDocument});
 const selected=[],group=core.timeCharts('音階',[{name:'F',octave:2},{name:'G',octave:2},{name:'F',octave:2}],i=>selected.push(i));
 a.equal(group.nodes.length,2);group.setView(true);
 for(const node of group.nodes){a.equal(node.tag,'section');a.match(node.children[1].textContent,/尚無可顯示/);a.equal(pathOf(node,'trend-line').attrs.d,'');}
 const packet={trend:{reference:442,start:0,end:9000,data:[
  {ms:1000,slot:0,lap:1,segment:1,cents:3},{ms:1048,slot:0,lap:1,segment:1,cents:4},
  {ms:5900,slot:2,lap:1,segment:2,cents:-5},{ms:5950,slot:2,lap:1,segment:2,cents:-2}]},
  loudness:{points:[{ms:1020,slot:0,lap:1,segment:1,db:2},{ms:1050,slot:0,lap:1,segment:1,db:3},
    {ms:5910,slot:2,lap:1,segment:2,db:-1},{ms:6000,slot:2,lap:1,segment:2,db:4}]}};
 const [p,v]=group.nodes;
 group.reset(null,packet);
 a.deepEqual(JSON.parse(JSON.stringify(core.sharedChartTime(packet.trend,packet.loudness))),{start:1000,end:6000});
 a.equal(svgOf(p).attrs.viewBox,svgOf(v).attrs.viewBox);
 a.equal(svgOf(p).children.at(-1).children.map(n=>n.textContent).join(','),svgOf(v).children.at(-1).children.map(n=>n.textContent).join(','));
 a.match(p.children[1].textContent,/A4 442/);
 a.match(v.children[1].textContent,/中位數/);
 for(const node of group.nodes){
   const d=pathOf(node,'trend-line').attrs.d;
   a.equal((d.match(/M/g)||[]).length,4,'two segments; interior pause is not bridged');
   a.equal(node.children[2].tabIndex,0);
 }
 group.select(2);
 a.equal(selected.at(-1),2);
 a.equal(pathOf(p,'trend-selection').attrs.d,pathOf(v,'trend-selection').attrs.d);
 a.match(pathOf(p,'trend-selection').attrs.d,/^M2\d\d[. /]/);
 group.select(1);
 a.equal(pathOf(p,'trend-selection').attrs.d,'','unmeasured slot is selectable but has no fabricated span');
 v.children[2].scrollLeft=87;v.children[2].listeners.scroll();
 a.equal(p.children[2].scrollLeft,87);
 const px=at=>42+(300-56)*(at-1000)/5000;
 svgOf(p).listeners.click({clientX:px(5920),clientY:32});
 a.equal(selected.at(-1),2,'actual descending printed slot, not identical ascending pitch');
 const before=selected.length;
 svgOf(v).listeners.click({clientX:px(2900),clientY:32});
 a.equal(selected.length,before,'no guessing in silent gaps');
});
test('live chart moves old samples left, uses a bounded read, reuses DOM and stops RAF when grading',()=>{
 const core=section('SCALE_PRACTICE',{document:chartDocument});
 let now=4000, sequence=0;
 const clock=new Map(),env={requestAnimationFrame(cb){clock.set(++sequence,cb);return sequence;},cancelAnimationFrame(id){clock.delete(id);}};
 const advance=t=>{const [id,cb]=clock.entries().next().value;clock.delete(id);cb(t);};
 const group=core.timeCharts('琶音',[{name:'A',octave:2}],null,env);
 const reads=[];
 group.setView(true);
 group.reset({elapsed:()=>now,read:since=>{reads.push(since);return {trend:{data:[{ms:3100,slot:0,lap:1,segment:2,cents:6}]}};}},null);
 advance(100);const [pitch,volume]=group.nodes, line=pathOf(pitch,'trend-line'), svg=svgOf(pitch);
 const first=Number(line.attrs.d.match(/^M([\d.]+)/)[1]);
 now=4500;advance(125);a.equal(reads.length,1,'coalesced animation frames do not replot at capture frequency');
 advance(200);const next=Number(line.attrs.d.match(/^M([\d.]+)/)[1]);
 a.ok(next<first,'the same point moves left as new time enters on the right');
 now=10000;advance(300);a.ok(reads.at(-1)>0);
 a.equal(pitch.dataset.live,'true');a.equal(volume.dataset.live,'true');
 a.equal(pathOf(volume,'trend-line').attrs.d,'');
 a.equal(pathOf(pitch,'trend-line'),line);a.equal(svgOf(pitch),svg);
 group.reset(null,{trend:{data:[{ms:3100,slot:0,lap:1,segment:2,cents:6}]}});
 a.equal(clock.size,0);a.equal(pitch.dataset.live,'false');
 group.reset(null,null);a.equal(line.attrs.d,'', 'old curve is cleared for the next take');
});
