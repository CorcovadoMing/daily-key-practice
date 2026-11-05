// Classroom mode: one shared room is synchronized using Firebase Realtime Database.
// Anonymous Firebase Authentication and a cryptographically random room ID are required.
// Do not use a short, guessable room ID: possession of a room link grants edit access.
'use strict';

const practice = window.DailyKeyPractice;
const el = id => document.getElementById(id);
const status = el('room-status');
const createButton = el('room-create');
const copyButton = el('room-copy');
const leaveButton = el('room-leave');
const roomPattern = /^[a-f0-9]{32}$/;
const config = window.DAILY_KEY_FIREBASE_CONFIG;
const configured = Boolean(config && ['apiKey', 'authDomain', 'projectId', 'databaseURL', 'appId'].every(key => typeof config[key] === 'string' && config[key] && !config[key].includes('YOUR_')));

let firebase = null;
let database = null;
let ready = false;
let connected = false;
let activeId = null;
let roomRef = null;
let unsubscribeRoom = null;
let unsubscribeConnection = null;
let joining = false;

function setStatus(message) { status.textContent = message; }
function updateButtons() {
  createButton.hidden = Boolean(activeId);
  copyButton.hidden = !activeId;
  leaveButton.hidden = !activeId;
  createButton.disabled = !configured || joining;
  copyButton.disabled = !ready;
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
  const match = window.location.hash.match(/^#room=([a-f0-9]{32})$/);
  return match ? match[1] : null;
}
function cleanupListener() {
  if(unsubscribeRoom) unsubscribeRoom();
  if(unsubscribeConnection) unsubscribeConnection();
  unsubscribeRoom = null;
  unsubscribeConnection = null;
}
function leaveRoom() {
  cleanupListener();
  activeId = null;
  roomRef = null;
  ready = false;
  connected = false;
  joining = false;
  replaceHash(null);
  practice.setClassroomRoom(null, null);
  setStatus(configured ? '個人模式 · 尚未加入課堂房間' : '課堂同步尚未啟用：請先設定 Firebase（參考 README）。');
  updateButtons();
}

async function loadFirebase() {
  if(firebase) return;
  if(!configured) throw Error('尚未填寫 firebase-config.js');
  const [appSdk, authSdk, dbSdk] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js')
  ]);
  const app = appSdk.initializeApp(config);
  const auth = authSdk.getAuth(app);
  // Each browser signs in anonymously; nobody needs a Firebase account to join.
  if(!auth.currentUser) await authSdk.signInAnonymously(auth);
  database = dbSdk.getDatabase(app);
  firebase = dbSdk;
}

async function joinRoom(id) {
  if(!roomPattern.test(id)) { practice.showToast('房間連結無效'); return; }
  if(activeId === id && ready) return;
  if(joining) return;
  if(!configured) {
    replaceHash(id);
    setStatus('已開啟課堂連結，但尚未啟用 Firebase。請依 README 完成設定。');
    return;
  }
  joining = true;
  cleanupListener();
  activeId = id;
  ready = false;
  connected = false;
  replaceHash(id);
  practice.setClassroomRoom(id, { ...practice.getPreferences(), session:null });
  setStatus('正在加入課堂房間…');
  updateButtons();
  try {
    await loadFirebase();
    if(activeId !== id) return;
    roomRef = firebase.ref(database, 'rooms/' + id);
    unsubscribeConnection = firebase.onValue(firebase.ref(database, '.info/connected'), snapshot => {
      connected = snapshot.val() === true;
      if(activeId === id && ready) setStatus(connected ? '已連線 · 課堂內容即時同步中' : '連線中斷 · 請確認網路，暫時無法更改');
    });
    unsubscribeRoom = firebase.onValue(roomRef, snapshot => {
      if(activeId !== id) return;
      const data = snapshot.val();
      if(data) practice.setClassroomRoom(id, data);
    }, error => {
      if(activeId === id) {
        ready = false;
        setStatus('無法讀取課堂資料：請檢查 Firebase 規則。');
        practice.showToast('課堂連線失敗：' + error.message);
        updateButtons();
      }
    });
    const prefs = practice.getPreferences();
    await firebase.runTransaction(roomRef, current => current || {
      majorCount: prefs.majorCount,
      minorCount: prefs.minorCount,
      showScale: Boolean(prefs.showScale),
      updatedAt: Date.now()
    }, { applyLocally: false });
    if(activeId !== id) return;
    ready = true;
    setStatus(connected ? '已連線 · 課堂內容即時同步中' : '正在等待網路連線…');
  } catch(error) {
    if(activeId === id) {
      ready = false;
      setStatus('課堂連線失敗：請檢查 Firebase 設定與權限。');
      practice.showToast(error.message || '連線失敗');
    }
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
  try {
    const result = await firebase.runTransaction(roomRef, current => {
      if(!current) return; // Never overwrite a missing/inaccessible room.
      return update(current);
    }, { applyLocally: false });
    if(!result.committed) practice.showToast('操作未完成，請再試一次');
  } catch(error) {
    practice.showToast('同步失敗，請稍後重試');
    console.error('Classroom update failed:', error);
  }
}

window.classroomSync = {
  setCounts(major, minor) {
    return changeRoom(current => ({...current, majorCount:major, minorCount:minor, updatedAt:Date.now()}));
  },
  draw(session) {
    return changeRoom(current => ({...current, session, updatedAt:Date.now()}));
  },
  toggleComplete(id) {
    return changeRoom(current => {
      const session = current.session;
      if(!session) return; // No selection yet.
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
  }
};

createButton.addEventListener('click', async () => {
  if(!configured) { practice.showToast('請先完成 Firebase 設定'); return; }
  if(!window.crypto?.getRandomValues) { practice.showToast('目前瀏覽器不支援安全產生房間'); return; }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const id = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  await joinRoom(id);
  if(ready) practice.showToast('房間已建立！可以複製邀請連結給老師');
});
copyButton.addEventListener('click', async () => {
  if(!activeId || !ready) return;
  const url = roomURL(activeId);
  try {
    await navigator.clipboard.writeText(url);
    practice.showToast('已複製課堂邀請連結');
  } catch(_) {
    window.prompt('複製此連結分享給老師：', url);
  }
});
leaveButton.addEventListener('click', leaveRoom);
window.addEventListener('hashchange', () => {
  const id = hashRoom();
  if(id && id !== activeId) joinRoom(id);
  else if(!id && activeId) leaveRoom();
});

updateButtons();
const room = hashRoom();
if(room) joinRoom(room);
else setStatus(configured ? '個人模式 · 按「建立同步房間」即可與老師共享練習' : '課堂同步尚未啟用：請先設定 Firebase（參考 README）。');
