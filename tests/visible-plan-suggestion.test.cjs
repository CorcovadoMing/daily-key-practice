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
 a.equal(restored.advise(),message);
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
 a.equal(g.advise(),f.advise());
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
