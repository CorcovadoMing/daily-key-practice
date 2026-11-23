const test = require('node:test');
const a = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const html = fs.readFileSync('index.html', 'utf8');
const source = fs.readFileSync('classroom.js', 'utf8');

function fixture(hash = '', useGuard = false) {
  const rooms = new Map([['000123', {}], ['1'.repeat(32), {}]]);
  const writes = [], roomChanges = [], copied = [], reads = [];
  const events = {}, elements = new Map();
  let guarded, timeout;
  let location = new URL('https://example.test/experimental/' + hash), focus, waiting;
  function node() {
    const handlers = {};
    return {
      value:'', attrs:{}, textContent:'', open:false, selectionStart:0,
      addEventListener(name, cb) { handlers[name] = cb; },
      setAttribute(k, v) { this.attrs[k] = v; },
      removeAttribute(k) { delete this.attrs[k]; },
      toggleAttribute(k, enabled) { if(enabled) this.attrs[k] = ''; else delete this.attrs[k]; },
      focus() { focus = this; },
      showModal() { this.open = true; },
      close() { this.open = false; handlers.close?.(); },
      setSelectionRange(index) { this.selectionStart = index; },
      fire(name, event = {}) { return handlers[name]?.({preventDefault(){}, ...event}); }
    };
  }
  const slots = Array.from({length:6}, node);
  for(const [, id] of html.matchAll(/id="(room-[\w-]+)"/g)) {
    a.ok(!elements.has(id), 'unique ' + id);
    elements.set(id, node());
  }
  const get = id => elements.get('room-' + id);
  get('join-dialog').querySelectorAll = () => slots;
  const crypto = {getRandomValues(buffer) { buffer[0] = 271; }};
  const sdk = {
    ref: (_, path) => ({path}),
    push: ref => ({path:ref.path + '/device', key:'device'}),
    get: async ref => {
      reads.push(ref.path);
      if(waiting) await waiting;
      return {val: () => rooms.get(ref.path.slice(6))};
    },
    onValue(ref, cb) { events[ref.path] = cb;cb({val:() => ref.path === '.info/connected' ? true : rooms.get(ref.path.slice(6))});return () => delete events[ref.path]; },
    remove: async () => {}, set: async () => {},
    onDisconnect: () => ({remove:async()=>{},cancel:async()=>{}}),
    runTransaction: async (ref, update) => {
      const id = ref.path.slice(6), next = update(rooms.get(id) ?? null);
      if(!next) return {committed:false};
      writes.push(ref.path);rooms.set(id,next);return {committed:true};
    },
  };
  const sandbox = vm.createContext({
    document:{getElementById:id=>elements.get(id)},
    URL, crypto, sdk, setTimeout(cb) { timeout=cb; }, clearTimeout() { timeout=null; }, console:{error(){},warn(){},debug(){}},
    navigator:{clipboard:{writeText:async url => copied.push(url)}},
    history:{replaceState:(_,__,url)=>{location = new URL(url);}},
    window:{
      crypto,get location(){return location;},
      addEventListener:(name,cb)=>{events[name]=cb;},
      DAILY_KEY_FIREBASE_CONFIG:Object.fromEntries(['apiKey','authDomain','projectId','databaseURL','appId'].map(x=>[x,'test'])),
      DailyKeyPractice:{getPreferences:()=>({majorCount:2,minorCount:2}),setClassroomRoom:(id)=>roomChanges.push(id),setClassroomDrafts(){},setClassroomArpeggioDrafts(){},showToast(){}}
    },
  });
  if(useGuard) sandbox.window.DailyKeyPractice.requestClassroomTransition=(action,beforePrompt)=>{
    beforePrompt?.(); guarded=action;
  };
  // Replace only the remote SDK loading boundary; exercise real event handlers.
  vm.runInContext(source.replace(/async function loadFirebase\(\) \{[\s\S]*?\n\}/, 'async function loadFirebase(){firebase=sdk;database={};editorUserId="device";}'), sandbox);
  return {get,slots,roomChanges,copied,reads,writes,get focus(){return focus;},get hash(){return location.hash;},
    wait(promise){waiting = promise;},
    expire(){timeout?.();}, allow(){return guarded?.();},

    emit(path,value){events[path]?.({val:()=>value});},
    async settle(){for(let i=0;i<12;i++) await Promise.resolve();}
  };
}
test('modal is one real numeric keyboard text field decorated with six hidden visual slots', () => {
  a.match(html, /<dialog id="room-join-dialog"[\s\S]+aria-labelledby="room-join-title"/);
  a.match(html, /<input id="room-code-input" type="text" inputmode="numeric" autocomplete="off"/);
  a.equal((html.match(/<span data-room-digit>/g)||[]).length,6);
});
test('invalid join preserves leading zero and retry, then replaces actions with code and canonical exit', async () => {
  const f = fixture(), {get} = f;
  a.equal(get('status').textContent,'');
  a.ok(!get('open-join').hidden && !get('create').hidden && get('copy').hidden && get('leave').hidden);
  get('open-join').fire('click');
  a.equal(f.focus,get('code-input'));
  await get('join-form').fire('submit');
  a.equal(f.reads.length,0);
  a.equal(get('code-input').attrs['aria-invalid'],'true');
  Object.assign(get('code-input'), {value:' ０００ ９９９ ',selectionStart:10});
  get('code-input').fire('input');
  a.equal(f.slots.map(x=>x.textContent).join(''),'000999');
  await get('join-form').fire('submit');
  a.equal(get('join-dialog').open,true);
  a.match(get('join-status').textContent,/找不到/);
  a.deepEqual(f.writes,[]);
  a.equal(get('code-input').value,'000999');
  get('code-input').value = '000123';
  await get('join-form').fire('submit');
  a.equal(get('join-dialog').open,false);
  a.ok(get('open-join').hidden && get('create').hidden && !get('copy').hidden && !get('leave').hidden);
  a.equal(get('code-number').textContent,'000123');
  a.equal(f.focus,get('copy'));
  a.equal(f.hash,'#room=000123');
  await get('copy').fire('click');
  a.match(f.copied[0],/#room=000123$/);
  f.emit('.info/connected',false);
  a.match(get('status').textContent,/等待網路/);
  a.equal(get('leave').hidden,false);
  f.emit('.info/connected',true);
  a.equal(get('status').textContent,'');
  get('leave').fire('click');
  a.equal(f.hash,'');
  a.equal(f.roomChanges.at(-1),null);
  a.equal(f.focus,get('open-join'));
});
test('only pending join blocks cancellation and input; idle cancel restores focus', async () => {
  const f = fixture(), {get} = f;
  get('open-join').fire('click');
  get('join-cancel').fire('click');
  a.equal(f.focus,get('open-join'));
  get('open-join').fire('click');
  let release, prevented = false;
  f.wait(new Promise(resolve=>{release=resolve;}));
  get('code-input').value='000123';
  const response = get('join-form').fire('submit');
  get('join-dialog').fire('cancel',{preventDefault(){prevented=true;}});
  get('join-cancel').fire('click');
  a.ok(prevented && get('join-dialog').open && get('code-input').readOnly);
  release();await response;
  a.equal(get('join-dialog').open,false);
});
test('auto-join both invite formats and create with leading zero (fake Firebase only)', async () => {
  for(const id of ['000123','1'.repeat(32)]){
    const f = fixture('#room='+id);await f.settle();
    a.equal(f.get('code-number').textContent,id);
    a.equal(f.get('join-dialog').open,false);
    a.equal(f.get('leave').hidden,false);
  }
  const f = fixture();await f.get('create').fire('click');
  a.deepEqual(f.writes,['rooms/000271']);
  a.equal(f.get('code-number').textContent,'000271');
  a.equal(f.get('leave').hidden,false);
});
test('a delayed read after timeout never silently enters the room; retry is available', async () => {
  const f = fixture(), {get} = f;
  get('open-join').fire('click');
  let release;
  f.wait(new Promise(resolve=>{release=resolve;}));
  get('code-input').value='000123';
  const response=get('join-form').fire('submit');
  await f.settle();f.expire();await response;
  a.match(get('join-status').textContent,/連線逾時/);
  a.equal(get('code-input').value,'000123');
  a.equal(get('join-cancel').disabled,false);
  release();await f.settle();
  a.equal(f.hash,'');
  await get('join-form').fire('submit');
  a.equal(f.hash,'#room=000123');
});
test('direct room transitions wait for the same draft decision; merely opening Join does not', async () => {
  const f = fixture('',true), {get}=f;
  get('open-join').fire('click');
  a.ok(get('join-dialog').open);
  get('code-input').value='000123';
  await get('join-form').fire('submit');
  a.equal(get('join-dialog').open,false,'cannot nest the draft prompt under the room dialog');
  a.equal(f.reads.length,0);
  await f.allow();
  a.equal(f.hash,'#room=000123');
  get('leave').fire('click');
  a.equal(f.hash,'#room=000123','cancelling or deferring the guard keeps the active room');
  await f.allow();
  a.equal(f.hash,'');
  get('create').fire('click');
  a.equal(f.writes.length,0);
  await f.allow();
  a.deepEqual(f.writes,['rooms/000271']);
});
test('header date is absent and progress is one compact line while retaining accessible landmarks', () => {
  a.doesNotMatch(html,/id="today-label"|今日完成進度|今日練習清單/);
  a.match(html,/<h2 class="sr-only" id="results-title"/);
  a.match(html,/<div class="summary-top"><span>練習完成進度<\/span><strong id="progress-text">0／4/);
  a.match(html,/<div class="progress-track sr-only" role="progressbar"/);
});
