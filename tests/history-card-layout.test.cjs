const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
test('each record groups both actions on the header row and retains all key chips',()=>{
 const element=tag=>({tag,dataset:{},children:[],attrs:{},listeners:{},append(...n){this.children.push(...n)},replaceChildren(){this.children=[]},setAttribute(k,v){this.attrs[k]=v},addEventListener(k,f){this.listeners[k]=f}});
 const lists={'#personal-history-list':element('div'),'#classroom-history-list':element('div')};
 const all=Array.from({length:12},(_,i)=>i),date='2026-11-27',replays=[];
 const fresh={id:'fresh',date,majorIds:[0],minorIds:[0],doneIds:['major-0']},complete={id:'old',date,majorIds:all,minorIds:all,doneIds:[...all.map(i=>'major-'+i),...all.map(i=>'minor-'+i)]};
 const state={personalHistory:[fresh],classroomHistory:[complete]};
 const ctx={state,document:{createElement:element},currentDate:date,q:s=>lists[s],renderPracticeStats(){},renderPracticeHeat(){},formatDate:()=>date,
  keyName:(mode,i)=>mode+'-'+i,selectedId:(mode,i)=>mode+'-'+i,replayHistoricalScale:(...args)=>replays.push(args),
  window:{confirm(){return false}}};
 vm.runInNewContext(html.slice(html.indexOf('    function historyProgress('),html.indexOf('    function replayHistoricalScale('))+
  html.slice(html.indexOf('    function formatHistoryTime('),html.indexOf('    function render(){'))+';renderHistory()',ctx);
 for(const [kind,record,n,label] of [['personal',fresh,2,'繼續'],['classroom',complete,24,'重練']]){
  const [date,actions,chips]=lists['#'+kind+'-history-list'].children[0].children;
  assert.equal(actions.className,'history-actions');assert.equal(chips.children.length,n);
  const [replay,remove]=actions.children;
  assert.equal(replay.textContent,label);assert.match(replay.attrs['aria-label'],/這次練習/);
  assert.match(remove.attrs['aria-label'],/刪除.+練習紀錄/);
  assert.match(remove.innerHTML,/<svg[^>]+aria-hidden="true"/);
  assert.match(date.children[0].children[2].textContent,/已完成 \d+ 調，共 \d+ 調/);
  replay.listeners.click();assert.deepEqual(replays.at(-1),[record,kind]);
  remove.listeners.click();assert.equal(state[kind==='personal'?'personalHistory':'classroomHistory'][0],record);
 }
});

test('history presents three local civil dates by default and searches original older records',()=>{
 const fn=html.slice(html.indexOf('    function historyRecordVisible('),html.indexOf('    function renderHistory(){'));
 const ctx={MAJOR_KEYS:[['F♯'],['D♭']],MINOR_KEYS:[['C♯']]};vm.runInNewContext(fn,ctx);
 const record=(date)=>({date,majorIds:[0,1],minorIds:[0]}), check=(date,today,query='')=>ctx.historyRecordVisible(record(date),today,query);
 for(const date of ['2025-12-30','2025-12-31','2026-01-01'])assert.equal(check(date,'2026-01-01'),true);
 for(const date of ['2025-12-29','2026-01-02'])assert.equal(check(date,'2026-01-01'),false);
 assert.equal(check('2024-02-29','2024-03-02'),true);
 assert.equal(check('2024-02-28','2024-03-02'),false);
 for(const query of ['2024-02-29','2024/2/29','2月29日','2024年2月29日','2/29','2024-2','F#','升 F 大調','Db','降D','C♯ 小調','小調']){
  assert.equal(check('2024-02-29','2026-01-01',query),true,query);
 }
 for(const query of ['2024-02-28','2025-02','D 大調','F# 小調','C♯ 大調','xyz'])assert.equal(check('2024-02-29','2026-01-01',query),false,query);
});
