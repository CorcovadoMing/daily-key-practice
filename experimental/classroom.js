// Classroom sync for cello lessons. Each new room has a 6-digit code valid for 24 hours.
// Existing 128-bit legacy room links (#room=<32 hex characters>) remain supported.
// Six digits are convenient, NOT a secret: only store non-sensitive practice selections.
'use strict';

const practice = window.DailyKeyPractice;
const el = id => document.getElementById(id);
const status = el('room-status');
const createButton = el('room-create');
const joinForm = el('room-join-form');
const joinInput = el('room-code-input');
const joinButton = el('room-join');
const copyButton = el('room-copy');
const leaveButton = el('room-leave');
const roomCodeDisplay = el('room-code-display');
const roomCodeNumber = el('room-code-number');
const onlineCount=el('online-count');
const onlineNumber=el('online-number');
const copyCodeButton = el('room-copy-code');
const shortCodePattern = /^[0-9]{6}$/;
const legacyRoomPattern = /^[a-f0-9]{32}$/;
const validRoom = id => shortCodePattern.test(id) || legacyRoomPattern.test(id);
const DAY_MS = 24 * 60 * 60 * 1000;
const config = window.DAILY_KEY_FIREBASE_CONFIG;
const configured = Boolean(config && ['apiKey','authDomain','projectId','databaseURL','appId']
  .every(key => typeof config[key] === 'string' && config[key].length > 0 && !config[key].includes('YOUR_')));

let firebase = null;
let database = null;
let ready = false;
let connected = false;
let activeId = null;
let roomRef = null;
let roomExpiresAt = null;
let unsubscribeRoom = null;
let unsubscribeConnection = null;
let unsubscribePresence=null;
let presenceConnectionRef=null;
let joining = false;

function setStatus(message) { status.textContent = message; }
function updateButtons() {
  const inRoom = Boolean(activeId);
  // Keep this button in the SAME position. Replacing it with "copy link" was confusing.
  createButton.hidden = false;
  createButton.textContent = inRoom ? '建立另一間房間' : '建立同步房間';
  copyButton.hidden = !inRoom;
  leaveButton.hidden = !inRoom;
  joinForm.hidden = inRoom;
  roomCodeDisplay.hidden = !ready || !shortCodePattern.test(activeId || '');
  if(!roomCodeDisplay.hidden) roomCodeNumber.textContent = activeId;
  createButton.disabled = !configured || joining;
  joinButton.disabled = !configured || joining;
  joinInput.disabled = joining;
  copyButton.disabled = !ready;
  onlineCount.hidden = !activeId || !ready;
}
function revealCreatedRoomCode(id) {
  if(!shortCodePattern.test(id)) return;
  roomCodeNumber.textContent = id;
  roomCodeDisplay.hidden = false;
  if(typeof roomCodeDisplay.scrollIntoView === 'function'){
    roomCodeDisplay.scrollIntoView({behavior:'smooth',block:'nearest'});
  }
}
async function copyRoomCode() {
  if(!activeId || !shortCodePattern.test(activeId)) return;
  try {
    await navigator.clipboard.writeText(activeId);
    practice.showToast('六位數房號已複製');
  } catch (_) {
    window.prompt('這是六位數房號，請告訴對方：', activeId);
  }
}
function roomURL(id) {
  const url = new URL(window.location.href);
  url.hash = 'room=' + id;
  return url.href;
}
function replaceHash(id) {
  const url = new URL(window.location.href);
  url.hash = id ? 'room=' + id : '';
  history.replaceState(null, '', url.href);
}
function hashRoom() {
  const match = window.location.hash.match(/^#room=([0-9]{6}|[a-f0-9]{32})$/);
  return match ? match[1] : null;
}
function stopPresence(){
 if(unsubscribePresence)unsubscribePresence();
 unsubscribePresence=null;
 const old=presenceConnectionRef;
 presenceConnectionRef=null;
 onlineCount.hidden=true;
 onlineNumber.textContent='—';
 if(old && firebase){
   firebase.remove(old).then(()=>firebase.onDisconnect(old).cancel()).catch(error=>console.debug('Presence cleanup pending server disconnect:',error));
 }
}

function watchPresence(id){
 const ref=firebase.ref(database,'roomPresence/'+id);
 onlineNumber.textContent='…';
 unsubscribePresence=firebase.onValue(ref,snapshot=>{
   if(activeId!==id)return;
   const connections=snapshot.val();
   onlineNumber.textContent=String(connections?Object.keys(connections).length:0);
 },error=>{
   if(activeId!==id)return;
   onlineNumber.textContent='未啟用';
   console.warn('Realtime presence unavailable: update Firebase Rules.',error);
 });
}

async function markPresent(id){
 if(!ready||!connected||activeId!==id||presenceConnectionRef)return;
 const presenceRef=firebase.push(firebase.ref(database,'roomPresence/'+id));
 presenceConnectionRef=presenceRef;
 try{
   await firebase.onDisconnect(presenceRef).remove();
   if(activeId!==id||!connected){
     await firebase.onDisconnect(presenceRef).cancel();
     presenceConnectionRef=null;
     return;
   }
   await firebase.set(presenceRef,true);
 }catch(error){
   if(presenceConnectionRef===presenceRef)presenceConnectionRef=null;
   console.warn('Could not register classroom presence:',error);
 }
}
function cleanupListeners() {
  if(unsubscribeRoom) unsubscribeRoom();
  if(unsubscribeConnection) unsubscribeConnection();
  stopPresence();
  unsubscribeRoom = null;
  unsubscribeConnection = null;
}
function leaveRoom() {
  cleanupListeners();
  activeId = null;
  roomRef = null;
  roomExpiresAt = null;
  ready = false;
  connected = false;
  joining = false;
  replaceHash(null);
  practice.setClassroomRoom(null, null);
  setStatus(configured ? '個人模式 · 可建立房間或輸入六位數房號' : '課堂同步尚未啟用：請檢查 Firebase 設定');
  updateButtons();
}

async function loadFirebase() {
  if(firebase) return;
  if(!configured) throw Error('Firebase 設定不完整');
  const [appSdk, authSdk, dbSdk] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js')
  ]);
  const app = appSdk.initializeApp(config);
  const auth = authSdk.getAuth(app);
  await auth.authStateReady();
  if(!auth.currentUser) await authSdk.signInAnonymously(auth);
  database = dbSdk.getDatabase(app);
  firebase = dbSdk;
}

function updateConnectionState() {
  if(!activeId || !ready) return;
  if(roomExpiresAt && roomExpiresAt <= Date.now()) {
    setStatus('此房間已超過 24 小時，請建立新房間');
    return;
  }
  setStatus(connected ? '已連線 · 抽籤與完成狀態即時同步中' : '等待網路連線 · 暫時無法同步');
}

async function joinRoom(id) {
  if(!validRoom(id)) { practice.showToast('請輸入正確的六位數房號'); return false; }
  if(activeId === id && ready) return true;
  if(joining) return false;
  joining = true;
  ready = false;
  connected = false;
  setStatus('正在加入課堂房間…');
  updateButtons();
  try {
    await loadFirebase();
    const nextRef = firebase.ref(database, 'rooms/' + id);
    // A wrong code must NOT automatically create a new room.
    const existing = await firebase.get(nextRef);
    const roomData = existing.val();
    if(!roomData) throw Error('找不到這個房號，請再次確認');
    if(roomData.expiresAt && roomData.expiresAt <= Date.now()) throw Error('房間已過期，請建立新房間');

    cleanupListeners();
    activeId = id;
    roomRef = nextRef;
    roomExpiresAt = roomData.expiresAt || null;
    replaceHash(id);
    practice.setClassroomRoom(id, roomData);
    unsubscribeRoom = firebase.onValue(roomRef, snapshot => {
      if(activeId !== id) return;
      const data = snapshot.val();
      if(!data) {
        setStatus('房間已關閉或不存在');
        return;
      }
      roomExpiresAt = data.expiresAt || null;
      practice.setClassroomRoom(id, data);
      updateConnectionState();
    }, error => {
      if(activeId !== id) return;
      ready = false;
      setStatus('課堂連線失敗，請檢查 Firebase Rules');
      practice.showToast(error.message || '無法讀取房間');
      updateButtons();
    });
    unsubscribeConnection = firebase.onValue(firebase.ref(database, '.info/connected'), snapshot => {
      const wasConnected=connected;
      connected = snapshot.val() === true;
      if(!connected){presenceConnectionRef=null;onlineNumber.textContent='離線';}
      else if(ready && !wasConnected)void markPresent(id);
      updateConnectionState();
    });
    watchPresence(id);
    ready = true;
    if(connected)void markPresent(id);
    updateConnectionState();
    return true;
  } catch(error) {
    console.error('Classroom join failed:', error);
    if(!activeId) setStatus('加入失敗：' + (error.message || '請檢查 Firebase 設定'));
    practice.showToast(error.message || '無法加入課堂房間');
    return false;
  } finally {
    joining = false;
    updateButtons();
  }
}

function randomSixDigits() {
  // Rejection sampling avoids modulo bias and preserves leading zeros.
  const random = new Uint32Array(1);
  const limit = 0x100000000 - (0x100000000 % 1000000);
  do { crypto.getRandomValues(random); } while(random[0] >= limit);
  return String(random[0] % 1000000).padStart(6, '0');
}
async function createRoom() {
  if(!configured) { practice.showToast('請先完成 Firebase 設定'); return; }
  if(joining) return;
  if(activeId) {
    if(!window.confirm('確定要建立新房間嗎？目前的房間仍存在，但你會離開原房間。')) return;
    leaveRoom();
  }
  if(!window.crypto?.getRandomValues) { practice.showToast('需要 HTTPS 才能安全產生房號'); return; }
  joining = true;
  setStatus('正在產生六位數房號…');
  updateButtons();
  try {
    await loadFirebase();
    const prefs = practice.getPreferences();
    for(let attempt = 0; attempt < 12; attempt++) {
      const id = randomSixDigits();
      const ref = firebase.ref(database, 'rooms/' + id);
      const result = await firebase.runTransaction(ref, current => {
        if(current !== null) return; // Atomic collision protection; never overwrite a room.
        const createdAt = Date.now();
        return {
          majorCount: prefs.majorCount,
          minorCount: prefs.minorCount,
          excludedKeys: Array.isArray(prefs.excludedKeys)?prefs.excludedKeys:[],
          showScale: Boolean(prefs.showScale),
          updatedAt: createdAt,
          createdAt,
          expiresAt: createdAt + DAY_MS
        };
      }, { applyLocally: false });
      if(!result.committed) continue;
      joining = false;
      const joined = await joinRoom(id);
      if(joined) {
        revealCreatedRoomCode(id);
        practice.showToast('已建立六位數房間，直接將號碼告訴老師或學生');
      }
      return;
    }
    throw Error('暫時無法取得空房號，請再試一次');
  } catch(error) {
    console.error('Classroom creation failed:', error);
    setStatus('建立失敗：請確認 Firebase Rules 已發布，且匿名登入已啟用');
    practice.showToast(error.message || '建立課堂房間失敗');
  } finally {
    joining = false;
    updateButtons();
  }
}

async function changeRoom(update) {
  if(!ready || !connected || !roomRef) {
    practice.showToast('課堂目前無法同步，請確認網路連線');
    return;
  }
  if(roomExpiresAt && roomExpiresAt <= Date.now()) {
    updateConnectionState();
    practice.showToast('房間已過期，請建立新房間');
    return;
  }
  try {
    const result = await firebase.runTransaction(roomRef, current => {
      if(!current || (current.expiresAt && current.expiresAt <= Date.now())) return;
      return update(current);
    }, { applyLocally: false });
    if(!result.committed) practice.showToast('操作未完成，請再試一次');
  } catch(error) {
    practice.showToast('同步失敗，請稍後再試');
    console.error('Classroom update failed:', error);
  }
}
window.classroomSync = {
  setCounts(major, minor) {
    return changeRoom(current => ({...current, majorCount:major, minorCount:minor, updatedAt:Date.now()}));
  },
  setExcludedKeys(excludedKeys) {
    const valid=Array.isArray(excludedKeys)?[...new Set(excludedKeys)].filter(id=>/^(major|minor)-(?:[0-9]|10|11)$/.test(id)):[];
    return changeRoom(current => ({...current,excludedKeys:valid,updatedAt:Date.now()}));
  },
  draw(session) {
    return changeRoom(current => ({...current, session, updatedAt:Date.now()}));
  },
  toggleComplete(id) {
    return changeRoom(current => {
      const session = current.session;
      if(!session) return;
      const validIds = [
        ...(Array.isArray(session.majorIds) ? session.majorIds : []).map(i => 'major-' + i),
        ...(Array.isArray(session.minorIds) ? session.minorIds : []).map(i => 'minor-' + i)
      ];
      if(!validIds.includes(id)) return;
      const done = Array.isArray(session.doneIds) ? session.doneIds : [];
      const doneIds = done.includes(id) ? done.filter(value => value !== id) : [...done, id];
      return {...current, session:{...session, doneIds}, updatedAt:Date.now()};
    });
  },
  setShowScale(showScale) {
    return changeRoom(current => ({...current, showScale:Boolean(showScale), updatedAt:Date.now()}));
  },
  setFingering(id, note, direction=null) {
    if(!/^(major|minor)-(?:[0-9]|10|11)$/.test(id)) return;
    return changeRoom(current => {
      const fingerings={...(current.fingerings||{})};
      // Update only the requested direction against the newest room state;
      // another participant's edits to the opposite direction are untouched.
      const fields=direction==='up'||direction==='down'?
        [direction,direction+'Map']:['up','down','upMap','downMap'];
      const next=direction?{...(fingerings[id]||{})}:{};
      for(const field of fields){
        const max=field.endsWith('Map')?1800:300;
        const value=typeof note?.[field]==='string'?note[field].slice(0,max):'';
        if(value)next[field]=value;
        else delete next[field];
      }
      if(Object.keys(next).length)fingerings[id]=next;
      else delete fingerings[id];
      if(!Object.keys(fingerings).length) {
        const {...rest}=current;
        delete rest.fingerings;
        return {...rest,updatedAt:Date.now()};
      }
      return {...current,fingerings,updatedAt:Date.now()};
    });
  }
};
createButton.addEventListener('click', createRoom);
copyCodeButton.addEventListener('click', copyRoomCode);
joinInput.addEventListener('input', () => { joinInput.value = joinInput.value.replace(/[^0-9]/g, '').slice(0, 6); });
joinForm.addEventListener('submit', async event => {
  event.preventDefault();
  const code = joinInput.value.trim();
  if(!shortCodePattern.test(code)) { practice.showToast('請輸入六位數字'); return; }
  const joined = await joinRoom(code);
  if(joined) joinInput.value = '';
});
copyButton.addEventListener('click', async () => {
  if(!activeId || !ready) return;
  const url = roomURL(activeId);
  try {
    await navigator.clipboard.writeText(url);
    practice.showToast('已複製課堂邀請連結');
  } catch(_) {
    window.prompt('複製邀請連結：', url);
  }
});
leaveButton.addEventListener('click', leaveRoom);
window.addEventListener('hashchange', () => {
  const id = hashRoom();
  if(id && id !== activeId) joinRoom(id);
  else if(!id && activeId) leaveRoom();
});
window.addEventListener('focus', updateConnectionState);
updateButtons();
const room = hashRoom();
if(room) joinRoom(room);
else setStatus(configured ? '個人模式 · 建立房間或輸入六位數房號即可同步' : 'Firebase 設定尚未完成');
