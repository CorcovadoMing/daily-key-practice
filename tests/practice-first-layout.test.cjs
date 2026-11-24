const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const launch=html.split('// SESSION_LAUNCH_START')[1].split('// SESSION_LAUNCH_END')[0];
const progress=html.slice(html.indexOf('    function historyProgress(record)'),html.indexOf('    function formatHistoryTime'));
function scope(){
  const nodes={'#session-launch':{dataset:{}},'#launch-fresh':{},'#draw-text':{},'#draw-button':{disabled:false},'#session-launch-note':{}};
  const calls=[], dialogs=[];
  let pool=[1,2,3];
  const setPool=list=>{pool=list;};
  const env={q:key=>nodes[key],state:{personalHistory:[]},sharedRoom:null,replaySession:null,session:null,
    currentDate:'2026-11-23',currentSession:()=>env.session,selectedId:(kind,n)=>kind+'-'+n,
    visiblePreferences:()=>({majorCount:2,minorCount:2}),refreshDate(){},
    orderedSelections:()=>pool,eligible:()=>pool,keyName:(mode,i)=>(mode==='major'?'M':'m')+i,
    drawToday(){calls.push('random');},practiceInSignatureOrder(){calls.push('sequential');},
    jumpOrder:()=>['major-1','minor-3'],jumpToPractice(id){calls.push(id);},
    cardInstances:new Map(),requestCardAction(fn){fn();},
    unsavedPracticeIn:()=>['pending'],withPracticeSaveChoice(item,proceed){dialogs.push({item,proceed});},
    expandedOverride:undefined,persist(){},renderResults(){env.session=env.state.continuedSession;},showToast(){}};
  vm.runInNewContext(launch+progress,env);
  return {env,nodes,calls,dialogs,setPool};
}
test('resume chooses validated unfinished work, otherwise reuse prior draw options',()=>{
  const {env,nodes,calls,setPool}=scope();
  env.updateSessionLaunch();
  assert.equal(nodes['#launch-fresh'].hidden,true);
  assert.equal(nodes['#draw-text'].textContent,'開始練習');
  assert.match(nodes['#session-launch-note'].textContent,/大調：M1、M2、M3\n小調：m1、m2、m3/);
  setPool([0]);
  env.updateSessionLaunch();
  assert.equal(nodes['#draw-button'].disabled,true);
  assert.match(nodes['#session-launch-note'].textContent,/大調：M0\n小調：m0/);
  env.setLaunchMode('sequential');
  assert.equal(nodes['#draw-button'].disabled,false);
  assert.match(nodes['#session-launch-note'].textContent,/大調：M0\n小調：m0/);
  assert.deepEqual(calls,[],'choosing a mode is never a start');
  env.startPractice();
  assert.deepEqual(calls,['sequential']);
  env.setLaunchMode('random');setPool([1,2,3]);
  env.startPractice();
  assert.deepEqual(calls,['sequential','random']);
  calls.length=0;
  env.session={majorIds:[1],minorIds:[3],doneIds:['major-1']};
  setPool([]);env.updateSessionLaunch();env.launchPractice();
  assert.equal(nodes['#launch-fresh'].hidden,false);
  assert.equal(nodes['#launch-fresh'].disabled,true);
  assert.equal(nodes['#draw-button'].disabled,false);
  assert.equal(nodes['#draw-text'].textContent,'繼續上次');
  assert.deepEqual(calls,['minor-3']);
  assert.equal(nodes['#launch-fresh'].textContent,'重新抽選');
  env.setLaunchMode('sequential');
  assert.equal(nodes['#launch-fresh'].textContent,'重新開始');
  assert.deepEqual(calls,['minor-3']);
  env.sharedRoom={id:'123456'};env.session=null;env.updateSessionLaunch();
  assert.equal(nodes['#launch-fresh'].hidden,true);
  assert.equal(nodes['#draw-text'].textContent,'開始練習');
});
test('prior resume preserves draft choice before replacing cards and starts first unfinished',()=>{
  const {env,calls,dialogs}=scope();
  env.cardInstances.set('major-0',{opened:true,card:{}});
  env.state.personalHistory=[
    {id:'valid',majorIds:[1],minorIds:[3],doneIds:['major-1'],drawnAt:10},
    {id:'malformed',majorIds:[1,1],minorIds:[],drawnAt:60}
  ];
  env.launchPractice();
  assert.equal(dialogs.length,1);
  assert.deepEqual(calls,[]);
  assert.equal(env.state.continuedSession,undefined);
  dialogs[0].proceed();
  assert.equal(env.state.continuedSession.historyId,'valid');
  assert.deepEqual(calls,['minor-3']);
});
test('classroom actions are behind a closed disclosure and other advanced controls retain their layouts',()=>{
  assert.match(html,/<details id="classroom-disclosure">\s*<summary>課堂同步<\/summary>/);
  assert.match(html,/<section[^>]+id="classroom-settings"[^>]*>[\s\S]*id="room-open-join"[\s\S]*id="room-create"[\s\S]*id="room-leave" hidden/);
  assert.match(html,/<details[^>]+id="history-settings"[^>]*>\s*<summary>/);
  assert.match(html,/<button[^>]+id="launch-options-toggle"[^>]+aria-controls="draw-settings"/);
  assert.match(html,/<section[^>]+id="draw-settings"[^>]+hidden>[\s\S]+id="signature-filters"[\s\S]+id="launch-count-settings"/);
});

test('start with a pending chart passes through the existing save choice instead of launching twice',()=>{
  const {env,calls,dialogs}=scope();
  env.cardInstances.set('major-0',{opened:true,card:{}});
  env.startPractice('sequential');
  assert.equal(dialogs.length,1);
  assert.deepEqual(calls,[]);
  env.setLaunchMode('random'); // Mode selection does not change the confirmed action already requested.
  dialogs[0].proceed();
  assert.deepEqual(calls,['sequential']);
});

test('popover placement fits a 320px screen by its anchor and prefers above a low or zoomed anchor',()=>{
  const code=html.split('// LAUNCH_POPOVER_START')[1].split('// LAUNCH_POPOVER_END')[0];
  const place=vm.runInNewContext(code+'\nlaunchPlacement');
  const phone=place({right:307,top:75,bottom:119},{width:320,height:550,left:0,top:0});
  assert.equal(phone.width,304);
  assert.equal(phone.left,8);
  assert.equal(phone.top,125);
  assert.equal(phone.side,'below');
  assert.ok(phone.top+phone.height<=542);
  const keyboard=place({right:310,top:245,bottom:289},{width:320,height:260,left:30,top:58});
  assert.equal(keyboard.side,'above');
  assert.ok(keyboard.left>=38 && keyboard.left+keyboard.width<=342);
  assert.ok(keyboard.top-keyboard.height>=66);
  const scrolled=place({right:310,top:-130,bottom:-90},{width:320,height:280,left:0,top:0});
  assert.ok(scrolled.top+scrolled.height<=272);
  assert.match(html,/\.launch-settings\{position:fixed/);
  assert.match(html,/popovertarget="draw-settings"/);
});

test('launch is Start, gear, direct order chooser; gear has one count sentence and no presets',()=>{
  assert.match(html,/id="classroom-settings"[\s\S]*id="room-open-join"[\s\S]*id="session-launch"/);
  assert.match(html,/\.launch-controls #draw-button\{[^}]*min-height:54px/);
  assert.match(html,/<div class="launch-controls"[\s\S]+?id="draw-button"[\s\S]+?id="launch-options-toggle"[\s\S]+?<fieldset class="launch-mode"/);
  assert.doesNotMatch(html,/id="presets"|大調練幾個|小調練幾個/);
  assert.match(html,/id="key-filter-title">已選調性/);
  assert.doesNotMatch(html,/<nav class="session-shortcuts"|id="resume-practice-note"/);
  const panel=html.slice(html.indexOf('class="launch-count-sentence"'),html.indexOf('class="audio-tools"'));
  assert.match(panel,/抽取[\s\S]+id="major-minus"[\s\S]+id="major-count"[\s\S]+id="major-plus"[\s\S]+個大調、[\s\S]+id="minor-minus"[\s\S]+id="minor-count"[\s\S]+id="minor-plus"[\s\S]+個小調/);
});

test('engaged room resumes only its own pending list; personal history cannot leak into the room',()=>{
 const {env,nodes,calls}=scope();
 env.sharedRoom={id:'123456'};env.state.personalHistory=[{id:'personal',majorIds:[1],minorIds:[],doneIds:[]}];
 env.session={majorIds:[1],minorIds:[3],doneIds:['major-1']};
 env.updateSessionLaunch();env.launchPractice();
 assert.equal(nodes['#draw-text'].textContent,'繼續上次');
 assert.deepEqual(calls,['minor-3']);
 env.session=null;env.updateSessionLaunch();env.launchPractice();
 assert.equal(nodes['#draw-text'].textContent,'開始練習');
 assert.deepEqual(calls,['minor-3','random']);
});
test('room visibility follows membership, not pending, preserves copy/exit while joining',()=>{
 const classroom=fs.readFileSync(path.join(__dirname,'../classroom.js'),'utf8');
 const update=classroom.slice(classroom.indexOf('function updateButtons()'),classroom.indexOf('function syncDigits()'));
 const state={activeId:null,configured:true,joining:false,disclosure:{open:false,toggleAttribute(k,v){this[k]=v;}},roomCodeNumber:{}};
 for(const k of ['createButton','openJoinButton','joinButton','joinCancel','joinInput','leaveButton','copyButton'])
   state[k]={setAttribute(name,val){this[name]=val;}};
 vm.runInNewContext(update,state);
 state.updateButtons();
 assert.equal(state.disclosure.open,false);assert.equal(state.disclosure['data-active'],false);
 assert.equal(state.copyButton.hidden,true);assert.equal(state.leaveButton.hidden,true);
 state.disclosure.open=true;state.joining=true;state.updateButtons();
 assert.equal(state.disclosure['data-active'],false);assert.equal(state.openJoinButton.disabled,true);
 state.disclosure.open=false;state.activeId='012345';state.updateButtons();
 assert.equal(state.disclosure.open,true);assert.equal(state.disclosure['data-active'],true);
 assert.equal(state.createButton.hidden,true);assert.equal(state.openJoinButton.hidden,true);
 assert.equal(state.roomCodeNumber.textContent,'012345');
 assert.equal(state.copyButton.hidden,false);assert.equal(state.leaveButton.hidden,false);
 state.activeId=null;state.joining=false;state.updateButtons();
 assert.equal(state.disclosure.open,true);assert.equal(state.disclosure['data-active'],false);
 assert.equal(state.createButton.hidden,false);assert.equal(state.openJoinButton.hidden,false);
 assert.equal(state.copyButton.hidden,true);assert.equal(state.leaveButton.hidden,true);
});

test('completed latest practice does not promote older progress; a stale resume click never redraws',()=>{
 const {env,nodes,calls}=scope();
 env.state.personalHistory=[{id:'old',majorIds:[1],minorIds:[],doneIds:[],drawnAt:10}];
 env.session={majorIds:[1],minorIds:[],doneIds:['major-1']};env.updateSessionLaunch();
 assert.equal(nodes['#draw-text'].textContent,'開始練習');
 env.state.personalHistory.push({id:'recent',majorIds:[1],minorIds:[],doneIds:['major-1'],drawnAt:20});
 env.session=null;env.updateSessionLaunch();
 assert.equal(nodes['#draw-text'].textContent,'開始練習');
 env.session={majorIds:[1],minorIds:[],doneIds:[]};env.replaySession=env.session;env.updateSessionLaunch();
 assert.equal(nodes['#draw-text'].textContent,'開始練習');
 env.replaySession=null;env.updateSessionLaunch();
 assert.equal(nodes['#draw-text'].textContent,'繼續上次');
 env.refreshDate=()=>{env.session=null;};env.launchPractice();
 assert.deepEqual(calls,[]);
 assert.equal(nodes['#draw-text'].textContent,'開始練習');
});
test('redraw sits before the scrollable options and room completion refreshes the primary label',()=>{
 const section=html.slice(html.indexOf('id="draw-settings"'),html.indexOf('class="audio-tools"'));
 assert.ok(section.indexOf('id="launch-fresh"')<section.indexOf('id="signature-filters"'));
 assert.match(html,/syncPracticeCards\(session\);\s*}\s*updateSessionLaunch\(\);\s*if\(historyChanged\)/);
});
