const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const launch=html.split('// SESSION_LAUNCH_START')[1].split('// SESSION_LAUNCH_END')[0];
const progress=html.slice(html.indexOf('    function historyProgress(record)'),html.indexOf('    function formatHistoryTime'));
function scope(){
  const nodes={'#session-launch':{dataset:{}},'#resume-practice':{},'#draw-button':{disabled:false},'#session-launch-note':{}};
  const calls=[], dialogs=[];
  const env={q:key=>nodes[key],state:{personalHistory:[]},sharedRoom:null,replaySession:null,session:null,
    currentDate:'2026-11-23',currentSession:()=>env.session,selectedId:(kind,n)=>kind+'-'+n,
    visiblePreferences:()=>({majorCount:2,minorCount:2}),refreshDate(){},
    jumpOrder:()=>['major-1','minor-3'],jumpToPractice(id){calls.push(id);},
    cardInstances:new Map(),requestCardAction(fn){fn();},
    unsavedPracticeIn:()=>['pending'],withPracticeSaveChoice(item,proceed){dialogs.push({item,proceed});},
    expandedOverride:undefined,persist(){},renderResults(){env.session=env.state.continuedSession;},showToast(){}};
  vm.runInNewContext(launch+progress,env);
  return {env,nodes,calls,dialogs};
}
test('resume chooses validated unfinished work, otherwise reuse prior draw options',()=>{
  const {env,nodes,calls}=scope();
  env.updateSessionLaunch();
  assert.equal(nodes['#resume-practice'].hidden,true);
  assert.match(nodes['#session-launch-note'].textContent,/2 個大調、2 個小調/);
  nodes['#draw-button'].disabled=true;
  env.updateSessionLaunch();
  assert.match(nodes['#session-launch-note'].textContent,/選擇調性/);
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
test('advanced disclosures retain isolated controls and joined classroom exit is reachable collapsed',()=>{
  for(const id of ['appearance-settings','draw-settings','key-pool-settings','sequential-settings','classroom-settings','history-settings','accumulated-settings']){
    assert.match(html,new RegExp('<details[^>]+id="'+id+'"[^>]*>\\s*<summary>'));
  }
  assert.match(html,/<\/details>\s*<button[^>]+id="room-leave"/);
  assert.match(html,/<details[^>]+id="practice-coach-opt-in" hidden>/);
});
