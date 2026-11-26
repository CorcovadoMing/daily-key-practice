const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const script = fs.readFileSync(path.join(__dirname, '../fingerboard.js'), 'utf8');
const moduleSource = script.match(/\/\* START practice history module \*\/([\s\S]*?)\/\* END practice history module \*\//)?.[1];
assert.ok(moduleSource, 'browser history module should be packaged in fingerboard.js');
const history = vm.runInThisContext('(function(globalThis){' + moduleSource + '\nreturn globalThis.CelloPracticeHistory;})')({});

const key = history.keyFor('C#-major', 'scale', [{midi: 37}, {midi: 39}, {midi: 37}]);
const storage = () => {
  const data = new Map();
  return {data, getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k)};
};

test('key identity includes original spelling, exercise type and exact ordered MIDI', () => {
  assert.equal(key, history.keyFor('C#-major', 'scale', [37, 39, 37]));
  assert.notEqual(key, history.keyFor('Db-major', 'scale', [37, 39, 37]));
  assert.notEqual(key, history.keyFor('C#-major', 'arpeggio', [37, 39, 37]));
  assert.notEqual(key, history.keyFor('C#-major', 'scale', [37, 37, 39]));
  assert.equal(history.keyFor('', 'scale', [37, 39, 37]), null);
  assert.equal(history.keyFor('C#-major', 'scale', [37, , 37]), null);
});

test('appendPoints preserves exact tuner bands and ignores absent/out-of-chart notes', () => {
  const bins = Array.from({length: 8}, () => new Map());
  const added = history.appendPoints(bins, [10, -10.05, 20, 20.01, -50, 50.01, null, 10 + 1e-8]);
  assert.deepEqual(added.map(m => Array.from(m.keys())), [[10], [-11], [20], [21], [-50], [], [], [10]]);
  assert.ok(bins.every(m => !m.size));
});

test('explicit saves sum complete laps and last incomplete lap in one aggregate with separate score positions', () => {
  const store = storage();
  const empty = history.load(store, key, 3);
  assert.ok(empty.ok && !empty.exists);
  const two = [[[-4, 2]], [[10.2, 2]], [[7, 1], [-7, 1]]].map(entries => new Map(entries));
  const attempt = history.appendPoints(two, [-4, null, null]);
  assert.equal(store.data.size, 0);
  assert.ok(history.save(store, key, attempt).ok);
  assert.ok(history.save(store, key, [new Map([[-4, 1]]), new Map([[11, 1]]), new Map()]).ok);
  assert.deepEqual(history.load(store, key, 3).bins.map(m => Array.from(m)), [[[-4, 4]], [[11, 3]], [[-7, 1], [7, 1]]]);
  assert.equal(store.data.size, 1);
  assert.deepEqual(Object.keys(JSON.parse(store.data.get(key))).sort(), ['slots', 'v']);
  assert.equal(history.load(store, history.keyFor('Db-major', 'scale', [37, 39, 37]), 3).exists, false);
});

test('invalid data, storage denial, mismatched target, quota and empty attempts do not report a save', () => {
  const store = storage();
  const bins = [new Map([[2, 1]]), new Map(), new Map()];
  assert.equal(history.load(store, key, 2).reason, 'invalid-key');
  assert.equal(history.save(null, key, bins).reason, 'unavailable');
  const denied = {getItem() {throw new Error('SecurityError');}};
  assert.equal(history.save(denied, key, bins).reason, 'unavailable');
  assert.equal(history.save(store, key, bins.map(() => new Map())).reason, 'empty-attempt');
  const quota = {...store, setItem() {throw new Error('QuotaExceededError');}};
  assert.equal(history.save(quota, key, bins).reason, 'write-failed');
  assert.equal(store.data.size, 0);
  store.data.set(key, JSON.stringify({v: 1, slots: [[[2, 1], [2, 2]], [], []]}));
  assert.equal(history.save(store, key, bins).reason, 'invalid-data');
  assert.deepEqual(JSON.parse(store.data.get(key)).slots[0], [[2, 1], [2, 2]]);
});

test('aggregation saturates safely instead of overflowing lifetime counts', () => {
  const store = storage();
  const bins = [new Map([[0, Number.MAX_SAFE_INTEGER]]), new Map(), new Map()];
  assert.ok(history.save(store, key, bins).ok);
  assert.ok(history.save(store, key, [new Map([[0, 1]]), new Map(), new Map()]).ok);
  assert.equal(history.load(store, key, 3).bins[0].get(0), Number.MAX_SAFE_INTEGER);
});

function draft(id = history.newDraftId()) {
  return {id, values: [-19.25, null, 0], mode: 'loop', laps: 2, passed: 1, progress: 3, pending: true,
    history: [new Map([[13, 1]]), new Map(), new Map([[0, 1]])],
    attemptHistory: [new Map([[-19, 1], [13, 1]]), new Map(), new Map([[0, 2]])]};
}

test('automatic local draft saves are separate from history, including current values and previous laps', () => {
  const store = storage();
  const first = draft();
  assert.deepEqual(history.loadDraft(store, key, 3), {ok: true, exists: false});
  assert.equal(history.saveDraft(store, key, first).ok, true);
  assert.deepEqual(history.loadDraft(store, key, 3).draft, first);
  assert.equal(history.load(store, key, 3).exists, false);
  assert.equal(store.data.size, 1);
  assert.ok(!store.data.has(key));

  const next = {...first, values: [9, null, null], progress: 1, id: history.newDraftId()};
  assert.notEqual(next.id, first.id);
  assert.equal(history.saveDraft(store, key, next).ok, true);
  assert.deepEqual(history.loadDraft(store, key, 3).draft, next);
  assert.equal(store.data.size, 1);
  assert.equal(history.loadDraft(store, history.keyFor('Db-major', 'scale', [37, 39, 37]), 3).exists, false);
});

test('atomic merge ID suppresses double-merge if page reloads before a draft can be rewritten', () => {
  const store = storage();
  const original = draft('attempt-1');
  assert.ok(history.saveDraft(store, key, original).ok);
  assert.ok(history.save(store, key, original.attemptHistory, original.id).ok);
  assert.equal(history.loadDraft(store, key, 3).draft.pending, false);
  assert.deepEqual(history.loadDraft(store, key, 3).draft.values, original.values);
  assert.equal(history.save(store, key, original.attemptHistory, original.id).duplicate, true);
  assert.deepEqual(history.load(store, key, 3).bins[0], new Map([[-19, 1], [13, 1]]));
  assert.equal(store.data.size, 2);
  assert.ok(history.removeDraft(store, key, 3).ok);
  assert.equal(history.loadDraft(store, key, 3).exists, false);
  assert.equal(history.load(store, key, 3).exists, true);
});

test('bad draft fields, corrupt draft JSON, and quota do not affect the aggregate', () => {
  const store = storage(), original = draft('attempt-1');
  assert.ok(history.saveDraft(store, key, original).ok);
  assert.ok(history.save(store, key, original.attemptHistory, original.id).ok);
  assert.ok(history.removeDraft(store, key, 3).ok);
  assert.equal(history.saveDraft(store, key, {...original, values: [51, null, 0]}).reason, 'invalid-draft');
  assert.equal(history.saveDraft(store, key, {...original, passed: 3}).reason, 'invalid-draft');
  assert.equal(history.saveDraft(store, key, {...original, id: 'invalid space'}).reason, 'invalid-draft');
  assert.equal(history.saveDraft({...store, setItem() { throw new Error('quota'); }}, key, original).reason, 'write-failed');
  assert.equal(store.data.size, 1);
  assert.ok(history.saveDraft(store, key, original).ok);
  const draftKey = [...store.data.keys()].find(k => k !== key);
  store.data.set(draftKey, '{"legacy": true}');
  assert.equal(history.loadDraft(store, key, 3).reason, 'invalid-draft');
  assert.equal(history.load(store, key, 3).lastDraftId, original.id);
  assert.equal(history.loadDraft(null, key, 3).reason, 'unavailable');
});

test('one current draft overall; a different score replaces it without touching either aggregate', () => {
  const store = storage();
  const other = history.keyFor('C#-major', 'arpeggio', [37, 41, 37]);
  const a = draft('attempt-a'), b = draft('attempt-b');
  assert.ok(history.saveDraft(store, key, a).ok);
  assert.ok(history.save(store, key, a.attemptHistory, a.id).ok);
  assert.ok(history.removeDraft(store, other, 3).ok);
  assert.equal(history.loadDraft(store, key, 3).draft.id, a.id);
  assert.ok(history.saveDraft(store, other, b).ok);
  assert.equal(store.data.size, 2); // Only one draft and one explicitly merged aggregate.
  assert.deepEqual(history.loadDraft(store, key, 3), {ok: true, exists: false});
  assert.deepEqual(history.loadDraft(store, other, 3).draft, b);
  assert.equal(history.load(store, key, 3).lastDraftId, a.id);
  assert.equal(history.load(store, other, 3).exists, false);
});

test('a stale draft cannot merge again or replace the current draft even after a newer merge', () => {
  const store = storage();
  const a = draft('a'), b = draft('b');
  assert.equal(history.save(store, key, a.attemptHistory, a.id).reason, 'stale-draft');
  assert.ok(history.saveDraft(store, key, a).ok);
  assert.ok(history.save(store, key, a.attemptHistory, a.id).ok);
  assert.ok(history.saveDraft(store, key, b).ok);
  assert.ok(history.save(store, key, b.attemptHistory, b.id).ok);
  assert.equal(history.save(store, key, a.attemptHistory, a.id).reason, 'stale-draft');
  assert.equal(history.saveDraft(store, key, {...a, pending: false}, {ifCurrent: true}).reason, 'stale-draft');
  assert.equal(history.loadDraft(store, key, 3).draft.id, b.id);
  assert.equal(history.load(store, key, 3).bins[0].get(-19), 2);
  assert.ok(history.saveDraft(store, key, {...b, pending: false}, {ifCurrent: true}).ok);
});

const keyedDraft = (id,bins) => ({id,values:[-5,null,4],mode:'loop',laps:2,passed:1,progress:1,
  pending:true,attemptHistory:bins});
const altKey=history.keyFor('major-D♭','arpeggio',[37,39,37]);
const samples=() => [new Map([[-5,3]]),new Map([[2,2]]),new Map([[4,1]])];
test('separate keyed drafts keep ownership across alternating exercises and enforce matching expected IDs',()=>{
  const s=storage(),bins=samples();
  assert.deepEqual(history.latestDraftId(s,key,3),{ok:true,id:null});
  assert.ok(history.saveKeyDraft(s,key,keyedDraft('scale-one',bins),{expectedId:null}).ok);
  assert.ok(history.saveKeyDraft(s,altKey,keyedDraft('arp-one',bins),{expectedId:null}).ok);
  assert.deepEqual(history.latestDraftId(s,key,3),{ok:true,id:'scale-one'});
  assert.equal(history.saveKeyDraft(s,key,keyedDraft('new-one',bins),{expectedId:'arp-one'}).reason,'stale-draft');
  assert.ok(history.saveKeyDraft(s,key,keyedDraft('new-one',bins),{expectedId:'scale-one'}).ok);
  assert.ok(history.saveKeyDraft(s,altKey,keyedDraft('arp-one',bins),{ifCurrent:true}).ok);
  assert.equal(history.loadKeyDraft(s,altKey,3).draft.id,'arp-one');
});
test('completed loops and final partial merge exactly once, including reload/retry and a superseded ID',()=>{
  const s=storage(),bins=samples();
  assert.ok(history.saveKeyDraft(s,key,keyedDraft('run-one',bins)).ok);
  const saved=history.accumulate(s,key,bins,'run-one');assert.ok(saved.ok);
  assert.equal(saved.bins[0].get(-5),3); // 2 rounds + partial, not just the last graph
  const reopened=history.loadKeyDraft(s,key,3).draft;assert.equal(reopened.pending,false);
  assert.equal(history.accumulate(s,key,reopened.attemptHistory,'run-one').duplicate,true);
  assert.ok(history.saveKeyDraft(s,key,keyedDraft('run-two',bins),{expectedId:'run-one'}).ok);
  assert.equal(history.accumulate(s,key,bins,'run-one').reason,'stale-draft');
  assert.equal(history.accumulate(s,key,bins,'run-two').bins[0].get(-5),6);
  assert.equal(history.load(s,altKey,3).exists,false);
});
test('legacy interrupted draft is recovered only for exact key; clear tombstone blocks resurrection and stale writes',()=>{
  const s=storage(),bins=samples();
  assert.ok(history.saveDraft(s,key,keyedDraft('legacy-one',bins)).ok);
  assert.equal(history.loadKeyDraft(s,altKey,3).exists,false);
  assert.equal(history.loadKeyDraft(s,key,3).draft.id,'legacy-one');
  assert.ok(history.accumulate(s,key,history.loadKeyDraft(s,key,3).draft.attemptHistory,'legacy-one').ok);
  assert.equal(history.accumulate(s,key,bins,'legacy-one').duplicate,true);
  assert.ok(history.saveKeyDraft(s,altKey,keyedDraft('arp-keep',bins)).ok);
  assert.ok(history.accumulate(s,altKey,bins,'arp-keep').ok);
  assert.ok(history.clear(s,key,3,{includeDraft:true}).ok);
  assert.equal(history.loadKeyDraft(s,key,3).exists,false);
  assert.equal(history.load(s,key,3).exists,false);
  assert.equal(history.loadDraft(s,key,3).draft.id,'legacy-one'); // no destructive migration
  const tomb=history.latestDraftId(s,key,3).id;
  assert.notEqual(tomb,'legacy-one');assert.ok(tomb);
  assert.equal(history.saveKeyDraft(s,key,keyedDraft('bad-retry',bins),{expectedId:'legacy-one'}).reason,'stale-draft');
  assert.ok(history.saveKeyDraft(s,key,keyedDraft('following-take',bins),{expectedId:tomb}).ok);
  assert.equal(history.loadKeyDraft(s,altKey,3).draft.id,'arp-keep');
  assert.equal(history.load(s,altKey,3).bins[0].get(-5),3);
});
test('storage failures cannot double count or report a partial clear successful',()=>{
  const s=storage(),bins=samples(),w=s.setItem,r=s.removeItem;
  assert.ok(history.saveKeyDraft(s,key,keyedDraft('a1',bins)).ok);
  s.setItem=(k,v)=>{if(k===key)throw Error();w(k,v);};
  assert.equal(history.accumulate(s,key,bins,'a1').reason,'write-failed');
  s.setItem=w;
  assert.equal(history.accumulate(s,key,bins,'a1').bins[0].get(-5),3);
  s.removeItem=()=>{throw Error();};
  assert.deepEqual(history.clear(s,key,3,{includeDraft:true}),{ok:false,reason:'write-failed',draftCleared:true});
  assert.equal(history.load(s,key,3).exists,true);
  assert.equal(history.loadKeyDraft(s,key,3).exists,false);
  s.removeItem=r;
  assert.ok(history.clear(s,key,3,{includeDraft:true}).ok);
});
test('comparison clear removes only the requested pitch-advice exercise',()=>{
  const ptr=script.split('/* Local-only comparison with the last fresh take used for practice advice. */')[1];
  const root={};vm.runInNewContext(ptr,{globalThis:root});
  const s=storage(),prefix='daily-key-practice:experimental:practice-comparison:v1:';
  for(const k of [prefix+'major-C:scale:one',prefix+'major-C:scale:two',prefix+'major-C:arpeggio:one','daily-key-practice:experimental:v1'])s.setItem(k,'fixture');
  const api=root.CelloPracticeProgress.create({...s,get length(){return s.data.size;},key:i=>[...s.data.keys()][i]});
  assert.equal(api.clear('major-C:scale').ok,true);
  assert.deepEqual([...s.data.keys()],[prefix+'major-C:arpeggio:one','daily-key-practice:experimental:v1']);
  assert.equal(api.clear('major-X:scale').reason,'invalid-key');
});
