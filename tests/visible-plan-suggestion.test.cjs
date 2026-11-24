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
function setup(data,search='',reject=()=>false){
 let now=0,reference=443,listener,network=0;
 const localStorage={getItem:k=>data[k]??null,setItem:(k,v)=>{if(reject(k,v))throw Error('QuotaExceededError');data[k]=v;}};
 const document={createElement:tag=>new Node(tag),querySelectorAll:()=>[],addEventListener(){}};
 const box=vm.createContext({document,window:{},performance,localStorage,URLSearchParams,location:{pathname:'/experimental/',hostname:'corcovadoming.github.io',search},
   fetch(){network++;throw Error('no network');},Worker:class{constructor(){network++;throw Error('no worker');}}});
 for(const file of ['fingering-presets.js','fingerboard.js'])vm.runInContext(fs.readFileSync(file,'utf8'),box);
 vm.runInContext(code('PRACTICE_COACH'),box);vm.runInContext(code('SCALE_PRACTICE'),box);
 box.CelloPracticeCoach.service=()=>{network++;throw Error('no model');};
 const {manager,card,planSuggestion}=box.CelloScalePractice,fb=box.window.CelloFingerboard;
 const target=fb.scoreNotes('major',key).map(n=>({...n,octave:Math.floor(fb.staffStep(n)/7)}));
 const startPlan=fb.visiblePlan('major',key);
 let plan=startPlan;
 const capture={subscribe(x){listener=x;return ()=>{};}};
 const m=manager({performance:{now:()=>now}},{capture,swiftCapture:capture,reference:()=>reference,
   pitchName:f=>String(f.midi),pitchReading:f=>f});
 const view=card({querySelectorAll:()=>target.map(()=>new Node('g'))},target,v=>m.toggle(v),'scale','major-C',()=>plan);
 const panel=view.element.find('scale-practice-local-coach');
 const press=()=>view.element.find('scale-practice-button').events.click();
 const advise=()=>{panel.find('scale-practice-coach-action').events.click();return flatText(panel.find('scale-practice-coach-tip'));};
 return {target,view,planSuggestion,fb,startPlan,panel,press,advise,ready(){listener.ready();},
   play(n,cents=0){for(let i=0;i<5;i++){now+=25;listener.frame({now,frequency:{midi:n.midi,cents}});}},
   setPlan(x){plan=x;},setA4(x){reference=x;},get network(){return network;}};
}
test('actual start and stop deliver a repeatable static crossing suggestion without initializing the model',async()=>{
 const cache={};const f=setup(cache);a.equal(f.panel.hidden,true);
 await f.press();
 f.setPlan(f.fb.visiblePlan('major',key,{upMap:'{"43":{"s":0,"f":4}}'})); // newer board not this take
 f.ready();f.setA4(445);
 for(const n of f.target)f.play(n,n.midi===43?-24:0);
 for(const n of f.target.slice(1))f.play(n,n.midi===43?-23:0);
 await f.press();
 a.equal(f.panel.hidden,false);
 const message=f.advise();
 a.match(message,/照這次指板.*換弦 C→G.*2／2.*第二音偏低.*可以這樣練.*再拉一次.*零線.*443 Hz/);
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
 a.match(plain,/G2.*2／2.*偏低/);a.doesNotMatch(plain,/照這次指板|換弦/);
 a.equal(f.network,0);
});
test('missing, partial and restored takes are honest and cannot reuse board or model',async()=>{
 const cache={};const f=setup(cache);
 await f.press();f.ready();f.play(f.target[0],4);await f.press();
 a.match(f.advise(),/沒有足夠資料/);
 const g=setup(cache);
 a.equal(g.advise().replace('上次保留的建議 ',''),f.advise());
 await g.press();g.ready();await g.press();
 a.match(g.advise(),/沒有辨識到可用音符/);
 a.doesNotMatch(g.advise(),/上次/);
 a.equal(g.network,0);
});
test('relative interval requires both accepted notes in each round and works on reverse',()=>{
 const {planSuggestion}=setup({});
 const p=(midi,finger)=>({midi,direction:'down',plan:{reviewed:true,string:'A',finger,fingersReviewed:true}});
 const base={slots:[p(70,3),p(69,2)],source:'confirmed/visible plan',reference:442,detector:'SwiftF0'};
 const rounds=[{id:1,values:[-20,0]},{id:2,values:[-25,0]},{id:3,values:[null,25]}];
 a.match(planSuggestion({...base,rounds}).observation,/同弦 3→2.*2／2.*偏窄/);
 a.equal(planSuggestion({...base,rounds:rounds.slice(0,1)}).kind,'insufficient');
 a.equal(planSuggestion({...base,rounds:[{id:1,values:[-20,null]},{id:2,values:[null,20]}]}).kind,'insufficient');
});

test('old URL query cannot activate model on public Pages; opened string gets its own objective check',async()=>{
 const f=setup({},'?aiCoach=1');a.ok(f.panel);
 await f.press();f.ready();for(const n of f.target)f.play(n,n.midi===43?-23:0);
 for(const n of f.target.slice(1))f.play(n,n.midi===43?-22:0);
 await f.press();
 a.match(f.advise(),/先單獨拉目標空弦.*確認它的音準.*分弓/);
 a.equal(f.network,0);
});

const latestKey=cache=>Object.keys(cache).find(k=>k.endsWith('latest-local'));
test('legacy and corrupted optional payloads use only signed saved downward note; replacing singleton invalidates prior advice',async()=>{
 const cache={},f=setup(cache);
 await f.press();f.ready();f.play(f.target[0],20);await f.press();
 const k=latestKey(cache), old=JSON.parse(cache[k]);
 const slot=f.target.length-2;
 old.values=old.values.map((_,i)=>i===slot?-24:null);
 // A mismatched take payload stays optional; the dot chart is still valid.
 old.advice={v:1,draftId:'different-take',mode:old.mode,kind:'insufficient',observation:'無關資料'};
 cache[k]=JSON.stringify(old);
 const g=setup(cache);
 a.match(g.advise(),new RegExp('下行第 '+(slot+1)+' 音，−24¢'));
 a.doesNotMatch(g.advise(),/無關資料|換弦|反覆|[0-9]／[0-9]/);
 delete old.advice;cache[k]=JSON.stringify(old);
 a.match(setup(cache).advise(),/一次音準讀數/);
 cache[k]=JSON.stringify({...old,id:'replacement'});
 a.equal(g.advise().trim(),'');a.equal(g.panel.hidden,true);
 delete cache[k];
 a.equal(setup(cache).panel.hidden,true);
});
test('stale mounted view clears previously rendered advice when notified',async()=>{
 const cache={}, f=setup(cache);
 await f.press();f.ready();f.play(f.target[0],24);await f.press();
 a.match(f.advise(),/沒有足夠資料/);
 delete cache[latestKey(cache)];
 a.equal(f.advise().trim(),'');a.equal(f.panel.hidden,true);
});

test('quota fallback keeps measured chart if optional advice does not fit',async()=>{
 const cache={}; const f=setup(cache,'',(k,v)=>k.endsWith('latest-local')&&Boolean(JSON.parse(v).advice));
 await f.press();f.ready();f.play(f.target[0],-21);await f.press();
 const snapshot=JSON.parse(cache[latestKey(cache)]);
 a.equal(snapshot.advice,undefined);a.equal(snapshot.values[0],-21);
 const g=setup(cache);
 a.match(g.advise(),/上次量到.*−21¢.*一次音準讀數/);
});
test('reload at a completed loop checkpoint restores its same-lap advice without restarting the microphone',async()=>{
 const cache={},f=setup(cache);
 await f.press();f.ready();
 for(const n of f.target)f.play(n,n.midi===43?-25:0);
 for(const n of f.target.slice(1))f.play(n,n.midi===43?-24:0);
 const g=setup(cache);
 a.match(g.advise(),/換弦 C→G.*2／2.*第二音偏低/);
 a.equal(g.network,0);
});

test('actual partial C major take connects F3→G3, then restores its whole D-string run in the printed order',async()=>{
 const f=setup({});
 await f.press();f.ready();
 for(const n of f.target.slice(0,12))f.play(n,n.midi===55?-27:0);
 await f.press();
 const tip=f.advise();
 a.match(tip,/F3.*G3.*只有這一輪.*音程偏窄.*先對準 F3.*G3 的 4 指落點往琴橋.*留寬一點.*慢拉 F3 → G3.*D3、E3、F3、G3/);
 a.doesNotMatch(tip,/A3|反覆|你手.*太/);
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
 a.match(down.observation,/G3.*F3.*音程偏寬/);
 a.match(down.action,/F3 的 2 指落點往琴橋.*收窄.*G3、F3、E3、D3/);
 const sharedApex=advice({14:0,15:-25});
 a.notEqual(sharedApex.kind,'fingers');a.doesNotMatch(sharedApex.action,/C4/);
});

test('actual saved edit changes advice from fingers to bow; unknown/harmonic plans do not infer finger motion',()=>{
 const f=setup({});
 const plan=f.fb.visiblePlan('major',key,{upMap:'{"55":{"s":1,"f":3}}'});
 const values=f.startPlan.slots.map((_,i)=>i===10?0:i===11?-27:null);
 const measured={rounds:[{id:1,values},{id:2,values}]};
 const c=f.planSuggestion({...plan,...measured});
 a.match(c.observation,/換弦 D→G/);
 a.match(c.action,/兩條空弦.*高度.*準備 3 指.*F3 → G3/);
 a.doesNotMatch(c.action,/距離|硬撐|琴橋/);
 const unknown=f.startPlan.slots.map((slot,i)=>i===11?{...slot,plan:null}:slot);
 a.equal(f.planSuggestion({...f.startPlan,slots:unknown,...measured}).kind,'note');
 const same=f.startPlan.slots.map((slot,i)=>i===11?{...slot,plan:{...slot.plan,finger:2}}:slot);
 a.match(f.planSuggestion({...f.startPlan,slots:same,...measured}).action,/手移到下一個落點.*不要硬拉開/);
});

test('explicit extension is never inferred and an open-string landing never receives a finger correction',()=>{
 const f=setup({});
 const make=(a,b)=>f.startPlan.slots.map((_,i)=>i===a?0:i===b?-21:null);
 const rounds=values=>[{id:1,values},{id:2,values}];
 const marked=f.startPlan.slots.map((s,i)=>i===11?{...s,edge:{from:10,reviewed:true,extension:true}}:s);
 const extension=f.planSuggestion({...f.startPlan,slots:marked,rounds:rounds(make(10,11))});
 a.equal(extension.kind,'extension');a.match(extension.action,/照指板提示.*不要硬撐/);
 const open=f.planSuggestion({...f.startPlan,rounds:rounds(make(3,4))});
 a.equal(open.kind,'crossing');a.match(open.action,/單獨拉目標空弦/);a.doesNotMatch(open.action,/0 指|琴橋/);
 const split=f.planSuggestion({...f.startPlan,rounds:[{id:1,values:make(9,11)},{id:2,values:make(10,12)}]});
 a.notEqual(split.kind,'fingers');
});
