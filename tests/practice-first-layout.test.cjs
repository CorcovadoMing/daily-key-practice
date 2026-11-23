const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const launch=html.split('// SESSION_LAUNCH_START')[1].split('// SESSION_LAUNCH_END')[0];
const progress=html.slice(html.indexOf('    function historyProgress(record)'),html.indexOf('    function formatHistoryTime'));
function scope(){
  const nodes={'#session-launch':{dataset:{}},'#resume-practice':{},'#draw-button':{disabled:false},'#session-launch-note':{},'#resume-practice-note':{}};
  const calls=[], dialogs=[];
  let pool=[1,2,3];
  const setPool=list=>{pool=list;};
  const env={q:key=>nodes[key],state:{personalHistory:[]},sharedRoom:null,replaySession:null,session:null,
    currentDate:'2026-11-23',currentSession:()=>env.session,selectedId:(kind,n)=>kind+'-'+n,
    visiblePreferences:()=>({majorCount:2,minorCount:2}),refreshDate(){},
    orderedSelections:()=>pool,eligible:()=>pool,
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
  assert.equal(nodes['#resume-practice'].hidden,true);
  assert.match(nodes['#session-launch-note'].textContent,/2 個大調、2 個小調/);
  setPool([0]);
  env.updateSessionLaunch();
  assert.equal(nodes['#draw-button'].disabled,true);
  assert.match(nodes['#session-launch-note'].textContent,/齒輪.*調性/);
  env.setLaunchMode('sequential');
  assert.equal(nodes['#draw-button'].disabled,false);
  assert.match(nodes['#session-launch-note'].textContent,/已選調性 · 1 個/);
  assert.deepEqual(calls,[],'choosing a mode is never a start');
  env.startPractice();
  assert.deepEqual(calls,['sequential']);
  env.setLaunchMode('random');setPool([1,2,3]);
  env.startPractice();
  assert.deepEqual(calls,['sequential','random']);
  calls.length=0;
  env.session={majorIds:[1],minorIds:[3],doneIds:['major-1']};
  env.updateSessionLaunch();env.resumePractice();
  assert.equal(nodes['#resume-practice'].hidden,false);
  assert.deepEqual(calls,['minor-3']);
  env.sharedRoom={id:'123456'};env.updateSessionLaunch();
  assert.equal(nodes['#resume-practice'].hidden,true);
});
test('prior resume preserves draft choice before replacing cards and starts first unfinished',()=>{
  const {env,calls,dialogs}=scope();
  env.session={majorIds:[0],minorIds:[],doneIds:['major-0']};
  env.cardInstances.set('major-0',{opened:true,card:{}});
  env.state.personalHistory=[
    {id:'valid',majorIds:[1],minorIds:[3],doneIds:['major-1'],drawnAt:10},
    {id:'malformed',majorIds:[1,1],minorIds:[],drawnAt:60},
    {id:'complete',majorIds:[1],minorIds:[],doneIds:['major-1'],drawnAt:50}
  ];
  env.resumePractice();
  assert.equal(dialogs.length,1);
  assert.deepEqual(calls,[]);
  assert.equal(env.state.continuedSession,undefined);
  dialogs[0].proceed();
  assert.equal(env.state.continuedSession.historyId,'valid');
  assert.deepEqual(calls,['minor-3']);
});
test('classroom actions are directly available and other advanced controls retain their layouts',()=>{
  assert.match(html,/<section[^>]+id="classroom-settings"[^>]*>[\s\S]*id="room-open-join"[\s\S]*id="room-create"[\s\S]*id="room-leave" hidden/);
  assert.match(html,/<details[^>]+id="history-settings"[^>]*>\s*<summary>/);
  assert.match(html,/<button[^>]+id="launch-options-toggle"[^>]+aria-controls="draw-settings"/);
  assert.match(html,/<section[^>]+id="draw-settings"[^>]+hidden>[\s\S]+id="signature-filters"[\s\S]+id="presets"/);
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
