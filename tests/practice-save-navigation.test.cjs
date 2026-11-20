const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

function setup() {
  let proceed=0, open=0;
  const controls = new Map([
    ['#practice-save-dialog',{open:false,showModal(){this.open=true;open++;},close(){this.open=false;}}],
    ['#practice-save-description',{}],['#practice-save-error',{hidden:true}],
    ['#practice-save-cancel',{}],['#practice-save-skip',{}],['#practice-save-continue',{}]
  ]);
  const windowEvents=new Map(),docEvents=new Map(),nodes=[];
  const context={q:id=>controls.get(id),document:{querySelectorAll:()=>nodes,addEventListener:(name,fn)=>docEvents.set(name,fn)},
    window:{addEventListener:(name,fn)=>windowEvents.set(name,fn),removeEventListener:name=>windowEvents.delete(name)}};
  vm.runInNewContext(html.split('// PRACTICE_SAVE_NAV_START')[1].split('// PRACTICE_SAVE_NAV_END')[0],context);
  function attempt({fail=false,durable=false}={}) {
    let dirty=true,writes=0;
    const api={hasUnsaved:()=>dirty,needsExitWarning:()=>dirty&&!durable,save(){if(dirty&&fail)return false;if(dirty)writes++;dirty=false;change();return true;},
      discard(){dirty=false;change();}};
    function change(){docEvents.get('practice-history-change')();}
    const node={practiceHistory:api,writes:()=>writes,fix(){fail=false;},change};
    nodes.push(node);return node;
  }
  const item={card:{querySelectorAll:()=>nodes},title:{textContent:'C 大調'}};
  return {controls,windowEvents,attempt,item,open:()=>open,proceed:()=>proceed,
    ask:()=>context.withPracticeSaveChoice(item,()=>proceed++)};
}

test('practice finish only arms generic leave warning; switching/marking is the explicit modal entry',()=>{
  const f=setup(),a=f.attempt();
  a.change();
  assert.equal(f.open(),0);
  const native=f.windowEvents.get('beforeunload');
  let interrupted=false;
  const event={preventDefault(){interrupted=true;}};
  native(event);
  assert.ok(interrupted);
  assert.equal(event.returnValue,'');
  f.ask();
  assert.match(f.controls.get('#practice-save-description').textContent,/C 大調/);
  f.controls.get('#practice-save-cancel').onclick();
  assert.equal(f.proceed(),0);
  assert.equal(a.writes(),0);
  assert.ok(a.practiceHistory.hasUnsaved());
  f.ask();
  f.controls.get('#practice-save-continue').onclick();
  assert.equal(f.proceed(),1);
  assert.equal(a.writes(),1);
  assert.equal(f.windowEvents.has('beforeunload'),false);
});

test('a failed merge stays on the old card; retry does not duplicate successful scopes',()=>{
  const f=setup(),a=f.attempt(),b=f.attempt({fail:true});
  a.change();
  f.ask();
  f.controls.get('#practice-save-continue').onclick();
  assert.equal(f.proceed(),0);
  assert.equal(f.controls.get('#practice-save-dialog').open,true);
  assert.equal(f.controls.get('#practice-save-error').hidden,false);
  assert.equal(a.writes(),1);
  assert.equal(b.writes(),0);
  assert.ok(f.windowEvents.has('beforeunload'));
  b.fix();
  f.controls.get('#practice-save-continue').onclick();
  assert.equal(f.proceed(),1);
  assert.equal(a.writes(),1);
  assert.equal(b.writes(),1);
});

test('do not save discards and continues; no pending result bypasses prompt',()=>{
  const f=setup();
  f.ask();assert.equal(f.proceed(),1);assert.equal(f.open(),0);
  const a=f.attempt();a.change();f.ask();
  f.controls.get('#practice-save-skip').onclick();
  assert.equal(f.proceed(),2);
  assert.equal(a.writes(),0);
  assert.equal(a.practiceHistory.hasUnsaved(),false);
  assert.equal(f.windowEvents.has('beforeunload'),false);
  assert.match(html,/function toggleComplete\(id,historyHandled=false\)/);
  assert.match(html,/function toggleCardExpansion\(id,historyHandled=false\)/);
  assert.match(html,/function jumpToPractice\(id,historyHandled=false\)/);
});

test('a locally persisted draft remains eligible for the app prompt without warning on close',()=>{
  const f=setup(),a=f.attempt({durable:true});
  a.change();
  assert.equal(f.open(),0);
  assert.equal(f.windowEvents.has('beforeunload'),false);
  f.ask();
  assert.equal(f.open(),1);
  assert.equal(a.writes(),0);
});
