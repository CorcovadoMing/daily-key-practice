const test=require('node:test'),a=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');
const code=name=>html.split('// '+name+'_START')[1].split('// '+name+'_END')[0];
class Node{
 constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.attrs={};this.events={};this.style={setProperty(){}};}
 append(...x){this.children.push(...x);}
 insertBefore(x,other){this.children.splice(this.children.indexOf(other),0,x);}
 setAttribute(k,v){this.attrs[k]=v;}
 addEventListener(k,v){this.events[k]=v;}
 find(cls){return this.className?.split(' ').includes(cls)?this:this.children.map(n=>n.find(cls)).find(Boolean);}
 set textContent(v){this.text=v;this.children=[];}
 get textContent(){return this.text||'';}
}
const key=['C',0,'C D E F G A B'];
const flatText=n=>[n.textContent,...n.children.map(flatText)].join(' ');
function setup(data,search='',reject=()=>false,configurePlan=x=>x,adviceContext=null,scope='major-C'){
 let now=0,reference=443,listener,network=0;
 const localStorage={get length(){return Object.keys(data).length;},key:i=>Object.keys(data)[i]??null,removeItem:k=>delete data[k],getItem:k=>data[k]??null,setItem:(k,v)=>{if(reject(k,v))throw Error('QuotaExceededError');data[k]=v;}};
 const mounted=[],events={};
 const document={createElement:tag=>new Node(tag),querySelectorAll:()=>mounted,addEventListener(){}};
 const box=vm.createContext({document,window:{},addEventListener:(k,fn)=>events[k]=fn,performance,localStorage,URLSearchParams,location:{pathname:'/experimental/',hostname:'corcovadoming.github.io',search},
   fetch(){network++;throw Error('no network');},Worker:class{constructor(){network++;throw Error('no worker');}}});
 for(const file of ['fingering-presets.js','fingerboard.js'])vm.runInContext(fs.readFileSync(file,'utf8'),box);
 vm.runInContext(code('PRACTICE_COACH'),box);vm.runInContext(code('SCALE_PRACTICE'),box);
 box.CelloPracticeCoach.service=()=>{network++;throw Error('no model');};
 const {manager,card,planSuggestion,practiceAdviceReport,measuredTrendIssues,measuredTrendMetrics}=box.CelloScalePractice,fb=box.window.CelloFingerboard;
 const target=fb.scoreNotes('major',key).map(n=>({...n,octave:Math.floor(fb.staffStep(n)/7)}));
 const startPlan=fb.visiblePlan('major',key);
 let plan=configurePlan(startPlan);
 const capture={subscribe(x){listener=x;return ()=>{};}};
 const m=manager({performance:{now:()=>now}},{capture,swiftCapture:capture,reference:()=>reference,
   pitchName:f=>String(f.midi),pitchReading:f=>f});
 const view=card({querySelectorAll:()=>target.map(()=>new Node('g'))},target,v=>m.toggle(v),'scale',scope,()=>plan,adviceContext);
 const panel=view.element.find('scale-practice-local-coach');
 const press=()=>view.element.find('scale-practice-button').events.click();
 mounted.push(view.element);
 const advise=()=>flatText(panel.find('scale-practice-coach-tip'));
 return {sync:()=>events.storage(),target,view,planSuggestion,practiceAdviceReport,measuredTrendIssues,measuredTrendMetrics,fb,startPlan,panel,press,advise,ready(){listener.ready();},
   play(n,cents=0,frames=5){for(let i=0;i<frames;i++){now+=25;listener.frame({now,frequency:{midi:n.midi,cents}});}},
   setPlan(x){plan=x;},setA4(x){reference=x;},get network(){return network;}};
}
test('actual start and stop deliver a repeatable static crossing suggestion without initializing the model',async()=>{
 const cache={};const f=setup(cache);a.ok(!f.panel.hidden);a.match(f.advise(),/開始練習後/);
 await f.press();
 f.setPlan(f.fb.visiblePlan('major',key,{upMap:'{"43":{"s":0,"f":4}}'})); // newer board not this take
 f.ready();a.match(f.advise(),/練習結束後/);f.setA4(445);
 for(const n of f.target)f.play(n,n.midi===43?-24:0);
 for(const n of f.target.slice(1))f.play(n,n.midi===43?-23:0);
 await f.press();
 a.ok(!f.panel.hidden);a.equal(f.panel.find('scale-practice-coach-action'),undefined);
 a.ok(f.view.element.children.indexOf(f.view.element.find('scale-pitch-chart'))<f.view.element.children.indexOf(f.panel));
 const message=f.advise();
 a.match(message,/上行：G 空弦.*反覆偏低.*可以這樣練.*調音器.*A4 443 Hz.*偏低.*C 弦上的 F → G 弦上的 G.*下一弦的高度/);
 a.doesNotMatch(message,/445|實際換弦|因此|造成/);
 const restored=setup(cache);
 restored.setPlan(restored.fb.visiblePlan('major',key,{upMap:'{"43":{"s":0,"f":4}}'}));
 a.equal(restored.advise().replace('上次保留的建議 ',''),message);
 a.equal(restored.network,0);
 a.equal(f.network,0);
});
test('new confirmed board used only next take; stale mismatched route rolls back to score-only suggestion',async()=>{
 const f=setup({});
 const edited=f.fb.visiblePlan('major',key,{upMap:'{"43":{"s":0,"f":4}}'});
 f.setPlan(edited);
 await f.press();f.ready();for(const n of f.target)f.play(n,n.midi===43?-25:0);
 for(const n of f.target.slice(1))f.play(n,n.midi===43?-24:0);await f.press();
 a.doesNotMatch(f.advise(),/換弦 C→G/);
 const broken={...f.startPlan,slots:[{midi:99},...f.startPlan.slots.slice(1)]};
 f.setPlan(broken);
 await f.press();f.ready();for(const n of f.target)f.play(n,n.midi===43?-25:0);
 for(const n of f.target.slice(1))f.play(n,n.midi===43?-24:0);await f.press();
 const plain=f.advise();
 a.match(plain,/上行：G 反覆偏低/);a.doesNotMatch(plain,/照這次指板|換弦/);
 a.equal(f.network,0);
});
test('missing, partial and restored takes are honest and cannot reuse board or model',async()=>{
 const cache={};const f=setup(cache);
 await f.press();f.ready();f.play(f.target[0],4);await f.press();
 a.match(f.advise(),/沒有足夠資料/);
 const g=setup(cache);
 a.equal(g.advise().replace('上次保留的建議 ',''),f.advise());
 await g.press();g.ready();await g.press();
 a.match(g.advise(),/上次保留的建議/);
 a.doesNotMatch(g.advise(),/沒有辨識到可用音符/);
 a.equal(g.network,0);
});
test('relative interval requires both accepted notes in each round and works on reverse',()=>{
 const {planSuggestion}=setup({});
 const p=(midi,finger)=>({midi,direction:'down',plan:{reviewed:true,string:'A',finger,fingersReviewed:true,anchor:1,shape:'normal'}});
 const base={slots:[p(70,3),p(69,2)],source:'confirmed/visible plan',reference:442,detector:'SwiftF0'};
 const rounds=[{id:1,values:[-20,0]},{id:2,values:[-25,0]},{id:3,values:[null,25]}];
 a.match(planSuggestion({...base,rounds}).observation,/下行：A 弦上的.*多次量到的音程偏窄/);
 a.equal(planSuggestion({...base,rounds:rounds.slice(0,1)}).kind,'insufficient');
 a.equal(planSuggestion({...base,rounds:[{id:1,values:[-20,null]},{id:2,values:[null,20]}]}).kind,'insufficient');
});

test('old URL query cannot activate model on public Pages; opened string gets its own objective check',async()=>{
 const f=setup({},'?aiCoach=1');a.ok(f.panel);
 await f.press();f.ready();for(const n of f.target)f.play(n,n.midi===43?-23:0);
 for(const n of f.target.slice(1))f.play(n,n.midi===43?-22:0);
 await f.press();
 a.match(f.advise(),/先用調音器.*單獨慢拉 G 空弦.*先把這條弦調準.*下一弦的高度/);
 a.equal(f.network,0);
});

const latestKey=cache=>Object.keys(cache).find(k=>k.endsWith(':latest'));
test('legacy and corrupted optional payloads use only signed saved downward note; replacing the keyed chart recomputes advice',async()=>{
 const cache={},f=setup(cache);
 await f.press();f.ready();f.play(f.target[0],20);await f.press();
 const k=latestKey(cache), old=JSON.parse(cache[k]);
 const slot=f.target.length-2;
 old.values=old.values.map((_,i)=>i===slot?-24:null);
 // A mismatched take payload stays optional; the dot chart is still valid.
 old.advice={v:1,draftId:'different-take',mode:old.mode,kind:'insufficient',observation:'無關資料'};
 cache[k]=JSON.stringify(old);
 const g=setup(cache);
 a.match(g.advise(),/下行：D，偏低/);
 a.doesNotMatch(g.advise(),/無關資料|換弦|反覆|[0-9]／[0-9]/);
 delete old.advice;cache[k]=JSON.stringify(old);
 a.doesNotMatch(setup(cache).advise(),/這是一次讀數/);
 cache[k]=JSON.stringify({...old,id:'replacement'});
 g.sync();a.match(g.advise(),/下行：D，偏低/);a.ok(!g.panel.hidden);
 delete cache[k];
 a.ok(!setup(cache).panel.hidden);
});
test('stale mounted view clears previously rendered advice when notified',async()=>{
 const cache={}, f=setup(cache);
 await f.press();f.ready();f.play(f.target[0],24);await f.press();
 a.match(f.advise(),/C 空弦.*調音器/);
 delete cache[latestKey(cache)];
 f.sync();a.match(f.advise(),/開始練習後/);a.ok(!f.panel.hidden);
});

test('quota fallback keeps measured chart if optional advice does not fit',async()=>{
 const cache={}; const f=setup(cache,'',(k,v)=>k.endsWith(':latest')&&Boolean(JSON.parse(v).advice));
 await f.press();f.ready();f.play(f.target[0],-21);await f.press();
 const snapshot=JSON.parse(cache[latestKey(cache)]);
 a.equal(snapshot.advice,undefined);a.equal(snapshot.values[0],-21);
 const g=setup(cache);
 a.match(g.advise(),/上次量到.*上行：C，偏低.*調音器/);
});
test('reload at a completed loop checkpoint restores its same-lap advice without restarting the microphone',async()=>{
 const cache={},f=setup(cache);
 await f.press();f.ready();
 for(const n of f.target)f.play(n,n.midi===43?-25:0);
 for(const n of f.target.slice(1))f.play(n,n.midi===43?-24:0);
 const g=setup(cache);
 a.match(g.advise(),/G 空弦.*反覆偏低.*調音器.*偏低.*下一弦的高度/);
 a.equal(g.network,0);
});

test('actual partial C major take connects F3→G3, then restores its whole D-string run in the printed order',async()=>{
 const f=setup({});
 await f.press();f.ready();
 for(const n of f.target.slice(0,12))f.play(n,n.midi===55?-27:0);
 await f.press();
 const tip=f.advise();
 a.match(tip,/上行：D 弦同一把位.*其他音接近零線，只有 G 偏低.*先保留 F 的落點，不移整手.*G 的 4 指往琴橋.*慢拉 D 弦上的 F → G.*E、F、G/);
 a.doesNotMatch(tip.replace(/A4 \d+ Hz/g,''),/[A-G][2-5]|第 \d+ 音|中位|反覆|你手.*太/);
});

test('the exact score and route distinguish equal offsets, a missing predecessor, wide intervals and descending order',()=>{
 const f=setup({});
 const make=marks=>f.startPlan.slots.map((_,i)=>Object.hasOwn(marks,i)?marks[i]:null);
 const advice=(one,two=one)=>f.planSuggestion({...f.startPlan,rounds:[{id:1,values:make(one)},{id:2,values:make(two)}]});
 a.equal(advice({10:-27,11:-27}).kind,'note');
 a.equal(advice({11:-27}).kind,'note');
 const wide=advice({10:0,11:25});
 a.match(wide.action,/往琴枕.*收窄一點/);
 const down=advice({17:0,18:-25});
 a.match(down.observation,/下行：D 弦上的 G → F.*音程偏寬/);
 a.match(down.action,/F 的 2 指落點往琴橋.*收窄.*G、F、E、D/);
 const sharedApex=advice({14:0,15:-25});
 a.notEqual(sharedApex.kind,'fingers');a.doesNotMatch(sharedApex.action,/C4/);
});

test('actual saved edit changes advice from fingers to bow; unknown/harmonic plans do not infer finger motion',()=>{
 const f=setup({});
 const plan=f.fb.visiblePlan('major',key,{upMap:'{"55":{"s":1,"f":3}}'});
 const values=f.startPlan.slots.map((_,i)=>i===10?0:i===11?-27:null);
 const measured={rounds:[{id:1,values},{id:2,values}]};
 const c=f.planSuggestion({...plan,...measured});
 a.match(c.observation,/上行：D 弦上的 F → G 弦上的 G/);
 a.match(c.action,/兩條空弦.*高度.*準備 3 指.*D 弦上的 F → G 弦上的 G/);
 a.doesNotMatch(c.action,/距離|硬撐|琴橋/);
 const unknown=f.startPlan.slots.map((slot,i)=>i===11?{...slot,plan:null}:slot);
 a.equal(f.planSuggestion({...f.startPlan,slots:unknown,...measured}).kind,'note');
 const same=f.startPlan.slots.map((slot,i)=>i===11?{...slot,plan:{...slot.plan,finger:2}}:slot);
 a.match(f.planSuggestion({...f.startPlan,slots:same,...measured}).action,/手移到 G 的落點.*不要硬拉開/);
});

test('explicit extension is never inferred and an open-string landing never receives a finger correction',()=>{
 const f=setup({});
 const make=(a,b)=>f.startPlan.slots.map((_,i)=>i===a?0:i===b?-21:null);
 const rounds=values=>[{id:1,values},{id:2,values}];
 const marked=f.startPlan.slots.map((s,i)=>i===11?{...s,edge:{from:10,reviewed:true,extension:true}}:s);
 const extension=f.planSuggestion({...f.startPlan,slots:marked,rounds:rounds(make(10,11))});
 a.equal(extension.kind,'extension');a.match(extension.action,/照指板提示.*不要硬撐/);
 const open=f.planSuggestion({...f.startPlan,rounds:rounds(make(3,4))});
 a.equal(open.kind,'note');a.match(open.action,/先用調音器.*單獨慢拉 G 空弦/);a.doesNotMatch(open.action,/0 指|琴橋/);
 const split=f.planSuggestion({...f.startPlan,rounds:[{id:1,values:make(9,11)},{id:2,values:make(10,12)}]});
 a.notEqual(split.kind,'fingers');
});

test('confirmed sharp/flat open notes outrank larger neighboring drift, handle outgoing crossing, and do not assume tuning is the cause',()=>{
 const f=setup({});
 const advice=(marks,slots=f.startPlan.slots,source='confirmed/visible plan')=>{
  const values=slots.map((_,i)=>marks[i]??null);
  return f.planSuggestion({...f.startPlan,slots,source,reference:443,detector:'SwiftF0',rounds:[{id:1,values}]});
 };
 const sharp=advice({3:0,4:19,5:-48});
 a.match(sharp.observation,/G 空弦.*這次量到偏高/);
 a.match(sharp.action,/先用調音器，沿用 A4 443 Hz.*若調音器也持續顯示偏高.*C 弦上的 F → G 弦上的 G.*下一弦的高度/);
 const flat=advice({4:-23,5:34});
 a.match(flat.action,/G 空弦.*持續顯示偏低.*G 弦上的 G → A/);
 a.doesNotMatch(flat.action,/指落點|調整手指|琴橋/);
 const outboundCrossing=advice({4:-25,5:0},f.startPlan.slots.map((s,i)=>i===5?{...s,plan:{...s.plan,string:'C'}}:s));
 a.match(outboundCrossing.action,/先用調音器.*G 弦上的 G → C 弦上的 A.*下一弦的高度/);
 const lone=advice({4:-22});
 a.match(lone.action,/先用調音器.*再慢拉譜上的這個音/);
 a.doesNotMatch(lone.action,/→/);
 const stopped=f.fb.visiblePlan('major',key,{upMap:'{"43":{"s":0,"f":4}}'});
 a.doesNotMatch(advice({3:0,4:-22},stopped.slots).action||'',/G 空弦|調音器/);
 a.doesNotMatch(advice({4:-22},f.startPlan.slots,'score only').action||'',/G 空弦|調音器/);
});

test('v1 advice is not replayed, valid chart remains and old open pitch wording is conditional only',async()=>{
 const cache={},f=setup(cache);
 await f.press();f.ready();f.play(f.target[0],-21);await f.press();
 const k=latestKey(cache), saved=JSON.parse(cache[k]);
 a.equal(saved.advice.v,4);
 a.match(setup(cache).advise(),/上次保留的建議.*先用調音器/);
 saved.advice={...saved.advice,v:1,action:'把空弦手指往琴橋移。'};
 cache[k]=JSON.stringify(saved);
 const reopened=setup(cache).advise();
 a.match(reopened,/上次量到的音：上行：C，偏低.*如果這個音用 C 空弦拉.*相同 A4.*確定偏高或偏低再調弦/);
 a.doesNotMatch(reopened,/空弦手指|上次保留的建議/);
});

test('advice preserves written accidentals and does not invent the string or add octave/slot jargon',()=>{
 const f=setup({});
 const names=['F♯','B♭'];
 const slots=f.startPlan.slots.map((n,i)=>i===10||i===11?{...n,name:names[i-10]}:n);
 const values=slots.map((_,i)=>i===10?0:i===11?-22:null);
 const pair=f.planSuggestion({...f.startPlan,slots,rounds:[{id:1,values}]});
 a.match(pair.observation,/上行：D 弦上的 F♯ → B♭/);
 for(const s of [pair.observation,pair.action,pair.check])a.doesNotMatch(s,/[A-G][♯♭]?[2-3]|第 \d+ 音|中位|\d+／\d+/);
 const old=f.planSuggestion({restored:true,slots,values});
 a.match(old.observation,/上行：B♭，偏低/);
 a.doesNotMatch(old.observation,/弦|中位|第 \d+ 音/);
});

test('real manager shows timing from measured same-take tail alongside observations and at most three drills',async()=>{
 const cache={},f=setup(cache);
 await f.press();f.ready();
 f.play(f.target[0],19); // open tuning has priority
 f.play(f.target[1],0,28); // sustained identified D
 f.play(f.target[1],24,16);
 f.play(f.target[2],0,9);
 await f.press();
 const tip=f.advise();
 a.match(tip,/這次觀察.*C 空弦.*量到的前段較接近零線，後段偏高.*可以這樣練.*先用調音器.*一弓長音.*後半仍維持速度/);
 a.doesNotMatch(tip,/再拉一次|運弓造成|第 \d+ 音/);
 a.equal(setup(cache).advise().replace('上次保留的建議 ',''),tip);
});

test('only deterministic distinct qualified slot/lap fragments report timing, and stable spans remain comparable',()=>{
 const f=setup({});
 const {slots}=f.startPlan;
 const values=slots.map((_,i)=>i<6?0:null);
 const p={...f.startPlan,reference:443,detector:'SwiftF0',rounds:[{id:1,values}]};
 const seed=(slot,segment,from,curve,lap=1)=>curve.map((cents,i)=>({slot,segment,lap,cents,ms:from+i*55}));
 const front=seed(1,1,200,[-25,-25,-25,3,3,3,3,3,3]);
 const tail=seed(2,2,900,[2,2,2,2,2,2,23,24,25]);
 const stable=seed(3,3,1600,[0,0,0,1,1,1,1,1,1]);
 const wobble=seed(4,4,2300,[2,1,0,28,28,28,-23,-22,-23,5,5,5]);
 const badSlot=seed(10,5,3400,[-30,-30,-30,0,0,0,0,0,0]);
 const input={...p,trend:{data:[...front,...tail,...stable,...wobble,...badSlot],start:0,end:4100,reference:443}};
 const report=f.practiceAdviceReport(input);
 a.equal(report.issues.length,3);a.equal(report.drills.length,1);
 a.deepEqual(Array.from(f.measuredTrendIssues(input),x=>x.type),['bow-front','bow-tail','bow-wobble']);
 a.equal(f.measuredTrendMetrics(input).length,4); // stable can compare; not described as a fault
 a.equal(f.measuredTrendIssues({...input,trend:{...input.trend,data:[...front,null]}}).length,0);
 const fragmented={...input,trend:{...input.trend,data:[...front,...seed(1,8,800,[0]),...tail]}};
 a.deepEqual(Array.from(f.measuredTrendIssues(fragmented),x=>x.type),['bow-tail']);
 const clipped={...input,trend:{...input.trend,data:[...front,...tail],start:150}};
 a.deepEqual(Array.from(f.measuredTrendIssues(clipped),x=>x.type),['bow-tail']);
});

test('automatic advice compares a measured healthier next take to the prior issue, and does not overwrite the baseline on reread',async()=>{
 const cache={},f=setup(cache);
 await f.press();f.ready();f.play(f.target[0],24);await f.press();
 a.match(f.advise(),/C 空弦.*偏高/);a.doesNotMatch(f.advise(),/跟上次比較/);
 await f.press();f.ready();f.play(f.target[0],2);await f.press();
 const changed=f.advise();
 a.match(changed,/跟上次比較.*上行：C 弦上的 C.*這次有改善/);
 a.equal(f.advise(),changed);
 const reopened=setup(cache);
 a.doesNotMatch(reopened.advise(),/跟上次比較/); // no reconstructed baseline from a draft
});

test('real restored legacy report replaces the reported stale copy with the written downward pair and preparation note',async()=>{
 const cache={},f=setup(cache);
 await f.press();f.ready();f.play(f.target[0],-25);await f.press();
 const key=latestKey(cache),old=JSON.parse(cache[key]);
 old.values=old.values.map((_,i)=>i===old.values.length-1?-22:null);
 old.advice={v:3,draftId:old.id,mode:old.mode,issues:['上次量到的音：下行：C，偏低。這是一次讀數。'],
  drills:['先把這個音單獨慢拉成長音，停一下再拉一弓。']};
 cache[key]=JSON.stringify(old);
 const text=setup(cache).advise();
 a.match(text,/下行：C，偏低.*如果這個音用 C 空弦拉.*照目前指板試練.*D → C.*慢慢連拉幾次.*E → D → C/);
 a.doesNotMatch(text,/這是一次讀數|單獨慢拉成長音|D 也偏|手指要拉開/);
 const unknown=setup(cache,'',()=>false,()=>null);
 a.match(unknown.advise(),/D → C.*E → D → C/);
 a.doesNotMatch(unknown.advise(),/照目前指板|弦上的|手指.*落點/);
});

test('fresh isolated-note observation adds the written predecessor without claiming it was measured; turns do not bridge',()=>{
 const f=setup({});
 const {slots}=f.startPlan;
 const values=slots.map((_,i)=>i===11?-25:null);
 const pitch=f.planSuggestion({...f.startPlan,reference:443,detector:'SwiftF0',rounds:[{id:1,values},{id:2,values}]});
 a.match(pitch.observation,/上行：D 弦上的 G 反覆偏低/);
 a.match(pitch.action,/F → G.*E → F → G/);
 a.doesNotMatch(pitch.action,/留寬一點|往琴橋/);
 const tail=slots.map((_,i)=>i===15?-25:null);
 const boundary=f.planSuggestion({restored:true,slots,values:tail,currentPlan:f.startPlan});
 a.doesNotMatch(boundary.action,/C → B|循環|前一輪/);
});

test('a verified current crossing can guide the next drill, without asserting that it caused the historical pitch',()=>{
 const f=setup({});
 const route=f.fb.visiblePlan('major',key,{upMap:'{"55":{"s":1,"f":3}}'});
 const values=f.target.map((_,i)=>i===11?-24:null);
 const info=f.planSuggestion({restored:true,slots:f.target,values,currentPlan:route});
 a.match(info.observation,/上行：G，偏低/);
 a.doesNotMatch(info.observation,/換弦|指板|F|弦上的/);
 a.match(info.action,/照目前指板試練.*換弓時平順到 G 弦.*準備好 3 指.*D 弦上的 F → G 弦上的 G.*E → F → G/);
 const both=f.target.map((_,i)=>i===10?0:i===11?-24:null);
 const spacing=f.planSuggestion({restored:true,slots:f.target,values:both,currentPlan:f.startPlan});
 a.match(spacing.action,/照目前指板試練.*G 的 4 指落點往琴橋.*距離留寬.*不要硬撐/);
 const equallyFlat=f.target.map((_,i)=>i===10||i===11?-24:null);
 a.doesNotMatch(f.planSuggestion({restored:true,slots:f.target,values:equallyFlat,currentPlan:f.startPlan}).action,/留寬一點/);
});

test('a confirmed shift in today’s same-string plan offers arrival prep rather than stretching',()=>{
 const f=setup({});
 const currentPlan={...f.startPlan,slots:f.startPlan.slots.map((s,i)=>i===11?{...s,edge:{from:10,reviewed:true,shift:true}}:s)};
 const values=f.target.map((_,i)=>i===10?0:i===11?-25:null);
 const got=f.planSuggestion({restored:true,slots:f.target,values,currentPlan});
 a.match(got.action,/照目前指板試練.*換把.*手移到 G 的落點.*F → G.*E → F → G/);
 a.doesNotMatch(got.action,/兩指的距離|往琴橋/);
 a.doesNotMatch(got.observation,/換把|指板/);
});


test('a stopped note in today’s confirmed route does not become an open string merely from its pitch',()=>{
 const f=setup({});
 const currentPlan=f.fb.visiblePlan('major',key,{upMap:'{"43":{"s":0,"f":4}}'});
 const values=f.target.map((_,i)=>i===4?-25:null);
 const route=f.planSuggestion({restored:true,slots:f.target,values,currentPlan});
 a.match(route.action,/照目前指板試練.*C 弦上的 F → G/);
 a.doesNotMatch(route.action,/空弦|調音器/);
 const unresolved=f.planSuggestion({restored:true,slots:f.target,values});
 a.match(unresolved.action,/如果這個音用 G 空弦拉.*調音器/);
});

test('actual recommendation cites only the rendered training recipe, at the very bottom, with safe links restored by ID',async()=>{
 const cache={},f=setup(cache);
 await f.press();f.ready();
 for(const n of f.target.slice(0,12))f.play(n,n.midi===55?-27:0);
 await f.press(); const current=f.advise();
 const body=f.panel.find('scale-practice-coach-tip'),footer=body.children.at(-1);
 a.equal(footer.className,'scale-practice-coach-sources');
 a.equal(footer.children[0].textContent,'本次建議參考');
 const list=footer.children[1];
 a.equal(list.tag,'ol');
 const links=list.children.map(item=>item.children[0]);
 a.equal(links.length,3);
 a.ok(links.some(link=>link.textContent.includes('Feuermann')));
 a.ok(links.some(link=>link.textContent.includes('Seattle Public Schools')));
 a.ok(links.some(link=>link.textContent.includes('Mantel')));
 for(const link of links){
  a.equal(link.tag,'a');a.match(link.attrs.href,/^https:\/\//);
  a.equal(link.attrs.rel,'noopener noreferrer');a.equal(link.attrs.target,'_blank');
 }
 a.doesNotMatch(current,/McDonagh|Katz/);
 a.equal(f.network,0);
 const reopened=setup(cache);a.equal(reopened.advise().replace('上次保留的建議 ',''),current.replace(' 兩音一弓 下次練法：一音一弓  ',' '));
 const k=latestKey(cache),recent=JSON.parse(cache[k]);
 a.equal(recent.advice.v,4);a.deepEqual(recent.advice.drillSources,[['spacing','connected','approach']]);
 recent.advice.drillSources=[['javascript:alert(1)','crossing']];
 cache[k]=JSON.stringify(recent);
 const sanitized=setup(cache).advise();a.match(sanitized,/只有 G 偏低/);a.doesNotMatch(sanitized,/本次建議參考|javascript:/);
 recent.advice.v=3;recent.advice.drillSources=[['shift']];cache[k]=JSON.stringify(recent);
 a.doesNotMatch(setup(cache).advise(),/本次建議參考|Katz/);
});

test('unsupported observation, lone tuner check, and no matching notes do not get generic sources',async()=>{
 const f=setup({});await f.press();f.ready();f.play(f.target[0],-20);await f.press();
 a.match(f.advise(),/先用調音器/);a.doesNotMatch(f.advise(),/本次建議參考/);
 await f.press();f.ready();await f.press();
 a.doesNotMatch(f.advise(),/本次建議參考/);
 const values=f.startPlan.slots.map((_,i)=>i===3?0:i===4?-24:null);
 const built=f.practiceAdviceReport({...f.startPlan,rounds:[{id:1,values}],reference:443,detector:'SwiftF0'});
 a.deepEqual(Array.from(built.drillSources[0]),['crossing']);
});

test('opt-in only decorates the next same-string pair; one drill changes, links follow, history stays unchanged',async()=>{
 const cache={},f=setup(cache);
 await f.press();f.ready();
 for(const n of f.target.slice(0,12))f.play(n,n.midi===55?-27:n.midi===36?21:0);
 await f.press();
 const original=f.advise();
 const defaults=JSON.stringify(cache);
 const body=f.panel.find('scale-practice-coach-tip');
 const button=()=>f.panel.find('scale-practice-slur-option');
 a.equal(button().attrs['aria-pressed'],'false');
 a.match(original,/先用調音器.*D 弦上的 F → G，一音一弓.*Feuermann/);
 a.doesNotMatch(original,/McDonagh：練習連弓/);
 button().events.click();
 const alt=flatText(body);
 a.equal(button().attrs['aria-pressed'],'true');
 a.match(alt,/先用調音器.*D 弦上的 F → G，只把這兩音放在同一弓裡.*前後各用半弓.*原譜弓法/);
 a.match(alt,/McDonagh：練習連弓/);
 a.doesNotMatch(alt,/Feuermann|Mantel|一音一弓、弓聲不斷/);
 a.equal(body.find('scale-practice-coach-phase').children.find(n=>n.tag==='ol').children.length,2);
 a.equal(JSON.stringify(cache),defaults);
 button().events.click();a.equal(flatText(body),original);
 const reopened=setup(cache);
 a.match(reopened.advise(),/一音一弓、弓聲不斷/);a.equal(reopened.panel.find('scale-practice-slur-option'),undefined);
 a.equal(f.network,0);
});

test('a cross-string report does not offer same-string slur or infer recorded bowing',async()=>{
 const f=setup({});
 f.setPlan(f.fb.visiblePlan('major',key,{upMap:'{"55":{"s":1,"f":3}}'}));
 await f.press();f.ready();
 for(const n of f.target.slice(0,12))f.play(n,n.midi===55?-27:0);
 await f.press();
 const text=f.advise();
 a.match(text,/D 弦上的 F → G 弦上的 G/);
 a.equal(f.panel.find('scale-practice-slur-option'),undefined);
 a.doesNotMatch(text,/兩音一弓|練習連弓/);
});


test('a cross-string pair with centered landing does not fall back to a same-string interval or slur',()=>{
 const f=setup({});
 const plan=f.fb.visiblePlan('major',key,{upMap:'{"55":{"s":1,"f":3}}'});
 const values=plan.slots.map((_,i)=>i===10?-29:i===11?0:null);
 const report=f.practiceAdviceReport({...plan,rounds:[{id:1,values},{id:2,values}]});
 a.equal(report.slur,undefined);
 a.doesNotMatch(report.issues.join(' '),/音程偏窄|音程偏寬/);
});

test('single natural completion automatically replaces the listening placeholder with current advice',async()=>{
 const f=setup({});
 // The manager reads the view mode; isolate this from unrelated radio UI.
 Object.defineProperty(f.view,'mode',{value:'single'});
 await f.press();f.ready();
 f.target.forEach(n=>f.play(n,n===f.target[0]?24:0));
 a.equal(f.view.element.dataset.phase,'idle');
 a.match(f.advise(),/這次觀察/);
 a.doesNotMatch(f.advise(),/練習結束後|上次保留/);
 a.equal(f.network,0);
});
test('mixed timing observations never assign another notes tail cue to the first note',()=>{
 const f=setup({}), slots=f.startPlan.slots, values=slots.map((_,i)=>i>=1&&i<=3?0:null);
 const seg=(slot,base,curve)=>curve.map((cents,i)=>({slot,segment:slot,lap:1,cents,ms:base+i*55}));
 const front=[-25,-25,-25,3,3,3,3,3,3],tail=[1,1,1,1,1,1,23,24,25];
 const ask=(curves)=>f.practiceAdviceReport({...f.startPlan,reference:443,detector:'SwiftF0',rounds:[{id:1,values}],trend:{start:0,end:2400,reference:443,data:curves.flatMap((v,i)=>seg(i+1,200+i*660,v))}});
 const a1=ask([front,tail,front]);
 a.equal(a1.issues.length,3);a.equal(a1.drills.length,1);a.equal(a1.metric.type,'front');
 a.match(a1.drills[0],/弓毛先放穩再起音/);
 a.doesNotMatch(a1.drills[0],/後半|上行：C 弦上的 E|其他有走勢/);
 a.match(a1.drills[0],/同樣練法也可用在「上行：C 弦上的 F」/);
 const a2=ask([tail,front,tail]);
 a.equal(a2.issues.length,3);a.equal(a2.metric.type,'tail');a.match(a2.drills[0],/後半仍維持速度/);
 a.doesNotMatch(a2.drills[0],/再起音|上行：C 弦上的 E|其他有走勢/);
 a.match(a2.drills[0],/同樣練法也可用在「上行：C 弦上的 F」/);
});

test('actual mixed D/E/F tracing keeps every observation in report and suggests only matching-phase advice', async()=>{
 const cache={},f=setup(cache);await f.press();f.ready();
 f.play(f.target[0],0,25);
 f.play(f.target[1],-24,14); f.play(f.target[1],0,28);
 f.play(f.target[2],0,28); f.play(f.target[2],23,14);
 f.play(f.target[3],-24,14); f.play(f.target[3],0,28);
 f.play(f.target[4],0,24); await f.press();
 const text=f.advise();
 a.match(text,/上行：C 弦上的 D，量到的前段偏低.*上行：C 弦上的 E，量到的前段較接近零線，後段偏高.*上行：C 弦上的 F，量到的前段偏低/);
 const drill=text.split('可以這樣練')[1];
 a.ok(drill);
 if(process.env.TIMING_BASE==='1'){
   a.match(drill,/先把弓放穩再開始.*後半仍維持速度/);
   a.match(drill,/其他有走勢變化的音/);
 }else{
   a.match(drill,/拿「上行：C 弦上的 D」.*弓毛先放穩再起音.*上行：C 弦上的 F/);
   a.doesNotMatch(drill,/後半仍維持速度|上行：C 弦上的 E|其他有走勢變化的音/);
 }
 a.equal(f.network,0);
 const restored=setup(cache).advise().replace('上次保留的建議 ','');
 a.equal(restored,text);
});

test('advice follows actual keyed graph, including a redraw of the same key',async()=>{
 const cache={},old={id:'personal:111',replay:false},redraw={id:'personal:222',replay:false};
 const f=setup(cache,'',undefined,undefined,old);
 await f.press();f.ready();f.play(f.target[0],-26);await f.press();
 a.match(f.advise(),/這次觀察/);
 a.match(setup(cache,'',undefined,undefined,old).advise(),/上次保留的建議/);
 a.match(setup(cache,'',undefined,undefined,redraw).advise(),/上次保留的建議/);
 a.match(setup(cache,'',undefined,undefined,redraw,'major-D').advise(),/開始練習後/);
 a.match(setup(cache,'',undefined,undefined,{...old,replay:true}).advise(),/上次保留的建議/);
 // Fresh advice on the redrawn key still has normal lifecycle and reloads.
 const again=setup(cache,'',undefined,undefined,redraw);
 await again.press();again.ready();again.play(again.target[0],26);await again.press();
 a.match(again.advise(),/這次觀察/);
 a.match(setup(cache,'',undefined,undefined,redraw).advise(),/上次保留的建議/);
 a.match(setup(cache,'',undefined,undefined,{...old,replay:true}).advise(),/上次保留的建議/);
});
test('actual card shows only measured ascent and once-only shared drill when matching descending evidence arrives',async()=>{
 const sections=f=>f.panel.find('scale-practice-coach-tip').children.filter(n=>n.className==='scale-practice-coach-phase');
 const ascent=setup({});
 await ascent.press();ascent.ready();for(const n of ascent.target.slice(0,8))ascent.play(n,n.midi===43?-27:0);
 await ascent.press();
 a.deepEqual(sections(ascent).map(n=>n.dataset.direction),['上行']);
 a.match(flatText(sections(ascent)[0]),/上行.*G 空弦.*調音器/);
 const cache={},both=setup(cache);
 await both.press();both.ready();for(const n of both.target)both.play(n,n.midi===43?-27:0);
 await both.press();
 const result=sections(both);
 a.deepEqual(result.map(n=>n.dataset.direction),['上行','下行','shared']);
 a.match(flatText(result[0]),/上行.*G 空弦/);
 a.match(flatText(result[1]),/下行.*G 空弦/);
 a.equal(result[2].children.find(n=>n.tag==='ol').children.length,1);
 a.match(flatText(result[2]),/調音器/);
 a.deepEqual(sections(setup(cache)).map(n=>n.dataset.direction),['上行','下行','shared']);
});
test('an empty measured take keeps generic copy without inventing phase sections',async()=>{
 const f=setup({});await f.press();f.ready();await f.press();
 a.equal(f.panel.find('scale-practice-coach-phase'),undefined);
 a.doesNotMatch(f.advise(),/上行|下行/);
});


test('actual reviewed hand groups distinguish a shared offset, isolated finger, and interval drift, both directions',()=>{
 const f=setup({}), plan=f.startPlan;
 const report=marks=>f.practiceAdviceReport({...plan,reference:442,detector:'SwiftF0',rounds:[{id:1,values:plan.slots.map((_,i)=>marks[i]??null)}]});
 const all=report({9:-21,10:-22,11:-26,17:20,18:21,19:24});
 a.match(all.issues.join(' '),/上行：D 弦同一把位.*整組一起偏低.*下行：D 弦同一把位.*整組一起偏高/);
 a.match(all.drills.join(' '),/保持指距不變，讓整手往琴橋.*保持指距不變，讓整手往琴枕/);
 const single=report({9:1,10:27,11:-4});
 a.match(single.issues.join(' '),/只有 F 偏高/);
 a.match(single.drills.join(' '),/不移整手.*F 的 2 指往琴枕/);
 const drift=report({9:0,10:-11,11:-27,17:28,18:14,19:0});
 a.ok(drift.issues.some(x=>/^上行：.*偏窄/.test(x)));
 a.ok(drift.issues.some(x=>/^下行：.*偏寬/.test(x)));
 a.ok(drift.drills.some(x=>/^上行：.*指距放寬/.test(x)));
 a.ok(drift.drills.some(x=>/^下行：.*指距收窄/.test(x)));
 const partial=report({9:-25,10:-22,17:24});
 a.doesNotMatch(partial.issues.join(' '),/整組|手形/);
});
test('complete pitch list includes both signs, one-off large errors, and mild reminders but not unplayed slots',()=>{
 const f=setup({}),p=f.startPlan;
 const values=Object.assign(Array(p.slots.length).fill(null),{0:-28,5:19,6:-32,7:9,17:-23,19:35});
 const next=Object.assign(Array(p.slots.length).fill(null),{5:-18});
 const r=f.practiceAdviceReport({...p,reference:442,detector:'SwiftF0',rounds:[{id:1,values},{id:2,values:next}]});
 const text=r.issues.join(' ');
 a.match(text,/C 空弦的 C.*偏低最多 28¢/);
 a.match(text,/上行：G 弦上的 A，偏高最多 19¢、偏低最多 18¢/);
 a.match(text,/上行：G 弦上的 B，偏低最多 32¢/);
 a.match(text,/稍留意 G 弦上的 C（略高）/);
 a.match(text,/下行：D 弦上的 G，偏低最多 23¢/);
 a.match(text,/下行：D 弦上的 E，偏高最多 35¢/);
 a.doesNotMatch(text,/下行：D 弦上的 F/);
 a.match(r.drills[0],/先用調音器.*C 空弦/);a.ok(r.drills.length<=3);
});

test('the practice panel labels automatically generated advice as experimental before the result',()=>{
 const f=setup({}); const note=f.panel.find('practice-advice-caution');
 a.match(flatText(note),/實驗功能・僅供參考.*由測量到的音準自動整理，可能有誤。請以老師的指導和自己的聆聽為準/);
 a.ok(f.panel.children.indexOf(note)<f.panel.children.indexOf(f.panel.find('scale-practice-coach-tip')));
});

test('same hand can span reviewed strings only when the captured shape is unchanged and both strings have reliable evidence',()=>{
 const f=setup({}); const slots=[
  {name:'D',midi:38,direction:'up',plan:{string:'C',finger:1}},
  {name:'F',midi:41,direction:'up',plan:{string:'C',finger:4}},
  {name:'A',midi:45,direction:'up',plan:{string:'G',finger:1}},
  {name:'B',midi:47,direction:'up',plan:{string:'G',finger:3}},
 ].map(s=>({...s,plan:{...s.plan,anchor:2,shape:'normal',reviewed:true,fingersReviewed:true}}));
 const report=(values,use=slots)=>f.practiceAdviceReport({source:'confirmed/visible plan',slots:use,reference:442,detector:'SwiftF0',rounds:[{id:1,values}]});
 const all=report([-24,-22,-22,-23]);
 a.match(all.issues.join(' '),/C、G 弦同一把位.*整組一起偏低/);
 a.match(all.drills.join(' '),/先用調音器確認 C、G 各弦.*保持指距不變/);
 for (const values of [[-24,-22,1,2],[-24,-22,-22,null],[-24,-20,-8,2]]) {
  a.doesNotMatch(report(values).issues.join(' '),/C、G 弦同一把位/);
 }
 const split=slots.map((n,i)=>i<2?n:{...n,plan:{...n.plan,shape:'extended'}});
 a.doesNotMatch(report([-24,-22,-22,-23],split).issues.join(' '),/C、G 弦同一把位/);
});
test('real melodic E minor has the same anchor but not the same shape at its reviewed cross-string boundary',()=>{
 const f=setup({}), key=['E',1,'E F♯ G A B C♯ D♯','E F♯ G A B C D'];
 const plan=f.fb.visiblePlan('minor',key);
 const a0=plan.slots[5].plan,b0=plan.slots[6].plan;
 a.equal(a0.anchor,b0.anchor);a.notEqual(a0.string,b0.string);a.notEqual(a0.shape,b0.shape);
 const marks=Object.assign(Array(plan.slots.length).fill(null),{3:-22,4:-23,5:-20,6:-29,7:-25});
 const r=f.practiceAdviceReport({...plan,rounds:[{id:1,values:marks}]});
 a.doesNotMatch(r.issues.join(' '),/G、D 弦同一把位/);
});

test('real C minor shape-change keeps audible interval fact without widening or narrowing a hand frame',()=>{
 const f=setup({}),p=f.fb.visiblePlan('minor',['C',-3,'C D E♭ F G A B','C D E♭ F G A♭ B♭'],{},false);
 const i=p.slots.findIndex((n,j)=>j>0&&n.name==='F'&&n.direction==='up'&&n.plan?.string==='D'&&
   p.slots[j-1].plan?.string==='D'&&p.slots[j-1].plan?.shape==='backwardExtended'&&n.plan?.shape==='normal');
 a.ok(i>0);
 const values=p.slots.map((_,j)=>j===i-1?0:j===i?-28:null);
 const packet={...p,rounds:[{id:1,values},{id:2,values}]};
 const report=f.practiceAdviceReport(packet);
 a.match(report.issues.join(' '),/D 弦上的 E♭ → F.*音程偏窄.*反覆偏低|反覆偏低.*D 弦上的 E♭ → F.*音程偏窄/);
 a.match(report.drills[0],/先聽準 E♭.*F.*指.*一音一弓/);
 a.doesNotMatch(report.drills.join(' '),/往琴橋|往琴枕|距離留寬|距離收窄|試伸指/);
 const restored=f.planSuggestion({restored:true,slots:p.slots,currentPlan:p,values});
 a.match(restored.action,/照目前指板.*先聽準 E♭/);a.doesNotMatch(restored.action,/往琴橋|往琴枕|距離留寬|距離收窄/);
});

test('unknown shape does not prescribe a distance; reviewed extension retains its distinct drill',()=>{
 const f=setup({}),p=f.startPlan,i=11;
 const values=p.slots.map((_,j)=>j===i-1?0:j===i?-28:null);
 const packet={...p,rounds:[{id:1,values},{id:2,values}]};
 const shapeOff=p.slots.map((n,j)=>j===i?{...n,plan:{...n.plan,shape:undefined}}:n);
 const v=f.practiceAdviceReport({...packet,slots:shapeOff});
 a.match(v.issues.join(' '),/音程偏窄/);
 a.doesNotMatch(v.drills.join(' '),/往琴橋|手指的距離|距離留寬/);
 const explicit=p.slots.map((n,j)=>j===i?{...n,edge:{reviewed:true,from:i-1,extension:true}}:n);
 a.match(f.practiceAdviceReport({...packet,slots:explicit}).drills[0],/照指板提示.*不要硬撐/);
 a.match(f.practiceAdviceReport(packet).drills[0],/往琴橋.*留寬一點/);
});
