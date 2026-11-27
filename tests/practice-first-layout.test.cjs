const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const launch=html.split('// SESSION_LAUNCH_START')[1].split('// SESSION_LAUNCH_END')[0];
const progress=html.slice(html.indexOf('    function historyProgress(record)'),html.indexOf('    function formatHistoryTime'));
function scope(){
  const nodes={'#session-launch':{dataset:{}},'#launch-resume':{},'#draw-text':{},'#draw-button':{disabled:false},'#session-launch-note':{}};
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
  assert.equal(nodes['#launch-resume'].hidden,true);
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
  setPool([]);env.updateSessionLaunch();env.resumePractice();
  assert.equal(nodes['#launch-resume'].hidden,false);
  assert.equal(nodes['#draw-button'].disabled,true);
  assert.equal(nodes['#draw-text'].textContent,'重新抽選');
  assert.deepEqual(calls,['minor-3']);
  setPool([1,2,3]);env.setLaunchMode('sequential');
  assert.equal(nodes['#draw-text'].textContent,'重新抽選');
  env.launchPractice();
  assert.deepEqual(calls,['minor-3','sequential']);
  env.sharedRoom={id:'123456'};env.session=null;env.updateSessionLaunch();
  assert.equal(nodes['#launch-resume'].hidden,true);
  assert.equal(nodes['#draw-text'].textContent,'開始練習');
});
test('prior resume starts first unfinished without a pitch-save prompt',()=>{
  const {env,calls,dialogs}=scope();
  env.cardInstances.set('major-0',{opened:true,card:{}});
  env.state.personalHistory=[
    {id:'valid',majorIds:[1],minorIds:[3],doneIds:['major-1'],drawnAt:10},
    {id:'malformed',majorIds:[1,1],minorIds:[],drawnAt:60}
  ];
  env.resumePractice();
  assert.equal(dialogs.length,0);
  assert.equal(env.state.continuedSession.historyId,'valid');
  assert.deepEqual(calls,['minor-3']);
});
test('classroom actions are behind a closed disclosure and other advanced controls retain their layouts',()=>{
  assert.match(html,/<details id="classroom-disclosure">\s*<summary>課堂同步<\/summary>/);
  assert.match(html,/<section[^>]+id="classroom-settings"[^>]*>[\s\S]*id="room-open-join"[\s\S]*id="room-create"[\s\S]*id="room-leave" hidden/);
  assert.match(html,/<details[^>]+id="history-settings"[^>]*>\s*<summary>/);
  assert.match(html,/<details[^>]+id="draw-settings"[^>]*>\s*<summary[^>]*><span[^>]*>調性設定<\/span>[\s\S]+id="session-launch-note"[\s\S]+?<\/summary>[\s\S]+id="signature-filters"[\s\S]+id="launch-count-settings"/);
});

test('start with a pending chart does not ask whether to save',()=>{
  const {env,calls,dialogs}=scope();env.cardInstances.set('major-0',{opened:true,card:{}});
  env.startPractice('sequential');assert.equal(dialogs.length,0);assert.deepEqual(calls,['sequential']);
});
test('tuning settings are an inline disclosure, not a floating window',()=>{
  assert.doesNotMatch(html,/id="launch-options-toggle"|popovertarget="draw-settings"/);
  assert.match(html,/class="launch-settings-body" inert/);
  assert.match(html,/launchBody.animate\(\[\{height:from/);
  assert.match(html,/max-inline-size:8\.25rem;min-block-size:3\.75rem/);
});

test('classroom, inline key settings, and launch appear in that order',()=>{
  assert.match(html,/id="classroom-settings"[\s\S]*id="room-open-join"[\s\S]*id="session-launch"/);
  assert.match(html,/\.launch-controls #draw-button\{[^}]*min-height:54px/);
  assert.match(html,/<details[^>]*id="mode-settings"[\s\S]+?id="pitch-detector"[\s\S]+?name="launch-mode"[\s\S]+?<details[^>]*id="draw-settings"[\s\S]+?<div class="launch-controls"[\s\S]+?id="draw-button"[\s\S]+?id="launch-resume"/);
  assert.doesNotMatch(html,/id="presets"|大調練幾個|小調練幾個/);
  assert.match(html,/id="key-filter-title">已選調性/);
  assert.doesNotMatch(html,/<nav class="session-shortcuts"|id="resume-practice-note"/);
  const panel=html.slice(html.indexOf('class="launch-count-sentence"'),html.indexOf('class="audio-tools"'));
  assert.match(panel,/大調<\/span>[\s\S]+id="major-minus"[\s\S]+id="major-count"[\s\S]+id="major-plus"[\s\S]+小調<\/span>[\s\S]+id="minor-minus"[\s\S]+id="minor-count"[\s\S]+id="minor-plus"/);
});

test('engaged room resumes only its own pending list; personal history cannot leak into the room',()=>{
 const {env,nodes,calls}=scope();
 env.sharedRoom={id:'123456'};env.state.personalHistory=[{id:'personal',majorIds:[1],minorIds:[],doneIds:[]}];
 env.session={majorIds:[1],minorIds:[3],doneIds:['major-1']};
 env.updateSessionLaunch();env.resumePractice();
 assert.equal(nodes['#draw-text'].textContent,'重新抽選');
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
 assert.equal(nodes['#draw-text'].textContent,'重新抽選');
 env.refreshDate=()=>{env.session=null;};env.resumePractice();
 assert.deepEqual(calls,[]);
 assert.equal(nodes['#draw-text'].textContent,'開始練習');
});
test('editable draw counts are beside the primary button, default to one, and resume is a link',()=>{
 assert.doesNotMatch(html,/launch-fresh/);
 const section=html.slice(html.indexOf('class="launch-controls"'),html.indexOf('<aside class="audio-tools"'));
 assert.match(section,/<a id="launch-resume"[^>]+hidden>繼續上次<\/a>/);
 assert.match(section,/id="draw-button"[\s\S]+id="launch-count-settings"[\s\S]+id="major-count"[^>]*>1<\/output>[\s\S]+id="minor-count"[^>]*>1<\/output>/);
 assert.match(html,/preferences:\{majorCount:1,minorCount:1,showScale:false\}/);
 assert.match(html,/syncPracticeCards\(session\);\s*}\s*updateSessionLaunch\(\);\s*if\(historyChanged\)/);
});

test('a random-only warning keeps the same layout space in sequence mode without entering the controls grid',()=>{
 const start=html.indexOf('class="launch-controls" role="group"');
 const end=html.indexOf('<aside class="audio-tools"',start);
 const section=html.slice(start,end);
 assert.match(section,/<\/section>\s*<\/div>\s*<p id="filter-warning"[^>]*role="status" hidden>/);
 assert.match(html,/\.session-launch\[data-mode=sequential\]>\.filter-warning\{visibility:hidden\}/);
 assert.match(html,/warning\.hidden=!warning\.textContent;/);
 assert.doesNotMatch(html,/warning\.hidden=.*launchMode/);
});
