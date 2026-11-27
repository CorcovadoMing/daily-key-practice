const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
test('each record groups both actions on the header row and retains all key chips',()=>{
 const element=tag=>({tag,dataset:{},children:[],attrs:{},listeners:{},append(...n){this.children.push(...n)},prepend(...n){this.children.unshift(...n)},replaceChildren(){this.children=[]},setAttribute(k,v){this.attrs[k]=v},addEventListener(k,f){this.listeners[k]=f}});
 const lists={'#personal-history-list':element('div'),'#classroom-history-list':element('div')};
 const all=Array.from({length:12},(_,i)=>i),date='2026-11-27',replays=[];
 const fresh={id:'fresh',date,majorIds:[0],minorIds:[0],doneIds:['major-0']},complete={id:'old',date,majorIds:all,minorIds:all,doneIds:[...all.map(i=>'major-'+i),...all.map(i=>'minor-'+i)]};
 const state={personalHistory:[fresh],classroomHistory:[complete]};
 const ctx={state,document:{createElement:element},currentDate:date,q:s=>lists[s],renderPracticeStats(){},renderPracticeHeat(){},formatDate:()=>date,
  keyName:(mode,i)=>mode+'-'+i,selectedId:(mode,i)=>mode+'-'+i,replayHistoricalScale:(...args)=>replays.push(args),
  window:{confirm(){return false}}};
 vm.runInNewContext(html.slice(html.indexOf('function createDialogNode('),html.indexOf('function createNoteActions('))+
  html.slice(html.indexOf('    function historyProgress('),html.indexOf('    function replayHistoricalScale('))+
  html.slice(html.indexOf('    function formatHistoryTime('),html.indexOf('    function render(){'))+';renderHistory()',ctx);
 for(const [kind,record,n,label] of [['personal',fresh,2,'繼續'],['classroom',complete,24,'重練']]){
  const [date,actions,chips]=lists['#'+kind+'-history-list'].children[0].children;
  assert.equal(actions.className,'history-actions');assert.equal(chips.children.length,n);
  const [replay,remove]=actions.children;
  assert.ok(replay.attrs['aria-label'].startsWith(label+'這次練習'));
  if(kind==='personal'){
   assert.equal(replay.textContent,undefined);
   assert.equal(replay.title,'繼續這次練習');
   assert.match(replay.innerHTML,/<svg class="ui-icon history-resume-icon"[^>]+aria-hidden="true"/);
  }else{
   assert.equal(replay.textContent,'重練');
   assert.equal(replay.innerHTML,undefined);
  }
  assert.match(remove.attrs['aria-label'],/刪除.+練習紀錄/);
  assert.match(remove.innerHTML,/<svg[^>]+aria-hidden="true"/);
  assert.match(remove.innerHTML,/class="history-delete-lid"/);
  assert.match(date.children[0].children[2].textContent,/已完成 \d+ 調，共 \d+ 調/);
  replay.listeners.click();assert.deepEqual(replays.at(-1),[record,kind]);
  remove.listeners.click();assert.equal(state[kind==='personal'?'personalHistory':'classroomHistory'][0],record);
 }
});

test('history presets use local civil dates; range and key filters intersect',()=>{
 const fn=html.slice(html.indexOf('    function validHistoryRecord('),html.indexOf('    function syncHistoryFilterKeys('));
 const ctx={selectedId:(mode,i)=>mode+'-'+i};vm.runInNewContext(fn,ctx);
 const record=date=>({date,majorIds:[0,1],minorIds:[0]});
 const check=(date,today,preset='3',key='')=>ctx.validHistoryRecord(record(date))&&ctx.historyRecordVisible(record(date),today,ctx.historyRangeStart(today,preset),key);
 for(const date of ['2025-12-30','2025-12-31','2026-01-01'])assert.equal(check(date,'2026-01-01'),true);
 for(const date of ['2025-12-29','2026-01-02'])assert.equal(check(date,'2026-01-01'),false);
 assert.equal(check('2024-02-29','2024-03-02'),true);
 assert.equal(check('2024-02-28','2024-03-02'),false);
 assert.equal(check('2024-02-30','2024-03-02','all'),false);
 assert.equal(check('2026-01-02','2026-01-01','all'),false);
 assert.equal(check('2024-02-29','2026-01-01','30'),false);
 assert.equal(check('2024-02-29','2026-01-01','all','minor-0'),true);
 assert.equal(check('2024-02-29','2026-01-01','all','minor-1'),false);
 assert.equal(check('2026-03-01','2026-03-07','7','major-1'),true);
 assert.equal(check('2026-02-28','2026-03-07','7','major-1'),false);
});

test('resetting history filters retains an accessible focus target with no record mutation',()=>{
 const tag=html.match(/<button[^>]*id="history-filter-reset"[^>]*>/)[0];
 assert.match(html,/<span class="sr-only" id="history-filter-status" role="status"><\/span>/);
 assert.match(tag,/aria-label="重置篩選"/);
 assert.match(tag,/aria-disabled="true"/);
 assert.doesNotMatch(tag,/\sdisabled(?:[\s=>])/);
 const body=html.slice(html.indexOf("    const historyDate=q("),html.indexOf("    q('#major-minus').addEventListener"));
 let calls=[],click;
 const date={value:'30',addEventListener(){},focus(){assert.fail('date picker should not receive focus');}};
 const key={value:'major-6',addEventListener(){},focus(){assert.fail('key picker should not receive focus');}};
 const reset={inactive:'false',getAttribute(){return this.inactive;},focus(o){assert.equal(o.preventScroll,true);calls.push('focus');},addEventListener(k,f){click=f;}};
 const ctx={q:id=>({'#history-filter-date':date,'#history-filter-key':key,'#history-filter-reset':reset})[id],renderHistoryLists(){calls.push('render');reset.inactive='true';},playHistoryIcon(button,selector,frames,duration){assert.equal(button,reset);assert.equal(selector,'svg');assert.equal(frames[1].transform,'rotate(-360deg)');assert.equal(duration,420);calls.push('animate');}};
 vm.runInNewContext(body,ctx);
 click();assert.deepEqual(calls,['focus','render','animate']);assert.equal(date.value,'3');assert.equal(key.value,'');
 click();assert.deepEqual(calls,['focus','render','animate']);
});

test('redrawing a classroom session always uses the new-record route, even twice in one clock tick',()=>{
 const day='2026-11-27',previous={date:day,createdAt:1000,majorIds:[0],minorIds:[0],doneIds:['major-0']};
 const state={sessions:{},classroomHistory:[],personalHistory:[],deletedClassroomHistoryIds:[]};
 const room={session:previous,majorCount:1,minorCount:1},calls=[];
 const context={sharedRoom:room,currentSession:()=>room.session,currentDate:day,state,persist(){},showToast(){},
  Date:{now:()=>1000},refreshDate(){},visiblePreferences:()=>room,eligible:()=>[0,1],chooseDistinct:()=>[1],
  orderedSelections:()=>[{mode:'major',index:0},{mode:'minor',index:1}],
  window:{classroomSync:{draw(session,type){calls.push([session,type]);room.session=session;}}}};
 vm.runInNewContext(html.slice(html.indexOf('    function recordSnapshot('),html.indexOf('    function storeNewPersonalSession('))+
   html.slice(html.indexOf('    function startNewSession('),html.indexOf('// Student notes stay')),context);
 for(const start of ['drawToday','practiceInSignatureOrder']){
   context.archiveClassroomSession('123456',{session:room.session,updatedAt:room.session.createdAt});
   context[start]();
 }
 context.archiveClassroomSession('123456',{session:room.session,updatedAt:room.session.createdAt});
 assert.deepEqual(calls.map(x=>x[1]),['new','new']);
 assert.deepEqual(state.classroomHistory.map(r=>r.createdAt),[1000,1001,1002]);
 assert.deepEqual([...state.classroomHistory[0].doneIds],['major-0']);
 assert.equal(state.personalHistory.length,0);
 assert.doesNotMatch(html,/draw-choice-dialog|data-history-choice=/);
});
