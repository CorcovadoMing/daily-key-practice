// Classroom sync for cello lessons. Each new room has a 6-digit code valid for 24 hours.
// Existing 128-bit legacy room links (#room=<32 hex characters>) remain supported.
// Six digits are convenient, NOT a secret: only store non-sensitive practice selections.
'use strict';

const practice = window.DailyKeyPractice;
const el = id => document.getElementById(id);
const status = el('room-status');
const disclosure = el('classroom-disclosure');
const createButton = el('room-create');
const openJoinButton = el('room-open-join');
const joinDialog = el('room-join-dialog');
const joinCancel = el('room-join-cancel');
const joinStatus = el('room-join-status');
const roomDigits = [...joinDialog.querySelectorAll('[data-room-digit]')];
const joinForm = el('room-join-form');
const joinInput = el('room-code-input');
const joinButton = el('room-join');
const copyButton = el('room-copy');
const leaveButton = el('room-leave');
const roomCodeNumber = el('room-code-number');
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
let presenceConnectionRef=null;
let joining = false;
let joinAttempt = 0;
let editorUserId = null;
let ownDraftRef = null;
let unsubscribeEdits = null;
let latestOwnDraft = null;
let draftWriteQueue = Promise.resolve();
let draftDisconnectRef = null;
let draftErrorReported = false;
let ownDraftRefArpeggio=null,latestOwnDraftArpeggio=null,draftDisconnectRefArpeggio=null;
let unsubscribeEditsArpeggio=null,draftErrorReportedArpeggio=false;
let draftWriteQueueArpeggio=Promise.resolve();

function setStatus(message) { status.textContent = message; }
function updateButtons() {
  const inRoom = Boolean(activeId);
  if(disclosure) {
    disclosure.toggleAttribute('data-active',inRoom);
    if(inRoom) disclosure.open = true;
  }
  createButton.hidden = openJoinButton.hidden = inRoom;
  copyButton.hidden = leaveButton.hidden = !inRoom;
  createButton.disabled = openJoinButton.disabled = !configured || joining;
  joinButton.disabled = joinCancel.disabled = joining;
  joinInput.readOnly = joining;
  // Even if the network drops, a member must still be able to exit or copy.
  if(inRoom) {
    roomCodeNumber.textContent = activeId;
    copyButton.setAttribute('aria-label', '房間號碼 ' + activeId + '，複製課堂邀請連結');
  }
}
function syncDigits() {
  const index = Math.min(joinInput.selectionStart ?? joinInput.value.length, 5);
  roomDigits.forEach((slot, i) => {
    slot.textContent = joinInput.value[i] || '';
    slot.toggleAttribute('data-room-current', index === i);
  });
}
function setJoinStatus(message, invalid = false) {
  joinStatus.textContent = message;
  if(invalid) joinInput.setAttribute('aria-invalid', 'true');
  else joinInput.removeAttribute('aria-invalid');
}
function normalizeCode(value) {
  return value.replace(/[０-９]/g, digit => String(digit.charCodeAt(0) - 0xff10)).replace(/[^0-9]/g, '').slice(0, 6);
}
function reflectCode() {
  const value = joinInput.value;
  const caret = normalizeCode(value.slice(0, joinInput.selectionStart ?? value.length)).length;
  const cleaned = normalizeCode(value);
  if(cleaned !== value) {
    joinInput.value = cleaned;
    joinInput.setSelectionRange(caret, caret);
  }
  setJoinStatus('');
  syncDigits();
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
 const old=presenceConnectionRef;
 presenceConnectionRef=null;
 if(old && firebase){
   firebase.remove(old).then(()=>firebase.onDisconnect(old).cancel()).catch(error=>console.debug('Presence cleanup pending server disconnect:',error));
 }
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
function clearOwnDraft(){
  const old=ownDraftRef;
  ownDraftRef=null;
  latestOwnDraft=null;
  draftDisconnectRef=null;
  if(old&&firebase){
    // Keep queued writes ordered: old sessions cannot reappear after cleanup.
    draftWriteQueue=draftWriteQueue.catch(()=>{}).then(async()=>{
      await firebase.remove(old);
      await firebase.onDisconnect(old).cancel();
    }).catch(error=>console.debug('Editing preview cleanup pending disconnect:',error));
  }
}
function watchEdits(id){
  if(unsubscribeEdits)unsubscribeEdits();
  const ref=firebase.ref(database,'roomEdits/'+id);
  unsubscribeEdits=firebase.onValue(ref,snapshot=>{
    if(activeId!==id)return;
    const entries=snapshot.val()||{},remotes={};
    const now=Date.now();
    for(const [editorKey,draft] of Object.entries(entries)){
      if(!draft||editorKey===ownDraftRef?.key||
        !/^(major|minor)-(?:[0-9]|10|11)$/.test(draft.keyId)||
        !['up','down'].includes(draft.direction)||
        !Number.isInteger(draft.selectedMidi)||
        !Number.isFinite(draft.updatedAt)||now-draft.updatedAt>300000)continue;
      let changed=[];
      try{changed=JSON.parse(draft.changed);}catch{}
      if(!Array.isArray(changed))changed=[];
      remotes[editorKey]={keyId:draft.keyId,direction:draft.direction,
        selectedMidi:draft.selectedMidi,previewMap:draft.previewMap||'{}',
        changed:changed.filter(x=>Number.isInteger(x)&&x>=36&&x<=100).slice(0,30)};
    }
    practice.setClassroomDrafts(id,remotes);
  },error=>console.warn('Live classroom edit preview unavailable; room fingering saves still work.',error));
}
// Allocate a reference without registering onDisconnect on an empty node.
// Room rules require an owned existing record for a delete, so the first
// successful SET must happen before onDisconnect.remove() is registered.
function registerDraftPresence(id){
  if(!ready||!connected||activeId!==id||!firebase)return;
  if(!ownDraftRef)ownDraftRef=firebase.push(firebase.ref(database,'roomEdits/'+id));
  if(latestOwnDraft){
    latestOwnDraft={...latestOwnDraft,updatedAt:Date.now()};
    queueOwnDraftWrite();
  }
}
function queueOwnDraftWrite(){
  if(!ready||!connected||!activeId||!firebase||!editorUserId)return;
  if(!ownDraftRef)ownDraftRef=firebase.push(firebase.ref(database,'roomEdits/'+activeId));
  const ref=ownDraftRef,room=activeId,payload=latestOwnDraft;
  draftWriteQueue=draftWriteQueue.catch(()=>{}).then(async()=>{
    if(activeId!==room||ownDraftRef!==ref||!connected)return;
    if(!payload){
      await firebase.remove(ref);
      return;
    }
    await firebase.set(ref,payload);
    if(draftDisconnectRef!==ref){
      // Registration is now authorized because the owner's record exists.
      await firebase.onDisconnect(ref).remove();
      draftDisconnectRef=ref;
    }
    draftErrorReported=false;
  }).catch(error=>{
    console.warn('Live classroom edit preview could not be synchronized:',error);
    if(!draftErrorReported){
      draftErrorReported=true;
      practice.showToast('即時指法預覽未能同步，請檢查連線或課堂資料權限');
    }
  });
}

// Independent channel prevents older scale-only clients from rendering arpeggio drafts.
function clearOwnDraftArpeggio(){
  const old=ownDraftRefArpeggio;
  ownDraftRefArpeggio=null;
  latestOwnDraftArpeggio=null;
  draftDisconnectRefArpeggio=null;
  if(old&&firebase){
    // Keep queued writes ordered: old sessions cannot reappear after cleanup.
    draftWriteQueueArpeggio=draftWriteQueueArpeggio.catch(()=>{}).then(async()=>{
      await firebase.remove(old);
      await firebase.onDisconnect(old).cancel();
    }).catch(error=>console.debug('Editing preview cleanup pending disconnect:',error));
  }
}
function watchEditsArpeggio(id){
  if(unsubscribeEditsArpeggio)unsubscribeEditsArpeggio();
  const ref=firebase.ref(database,'roomArpeggioEdits/'+id);
  unsubscribeEditsArpeggio=firebase.onValue(ref,snapshot=>{
    if(activeId!==id)return;
    const entries=snapshot.val()||{},remotes={};
    const now=Date.now();
    for(const [editorKey,draft] of Object.entries(entries)){
      if(!draft||editorKey===ownDraftRefArpeggio?.key||
        !/^(major|minor)-(?:[0-9]|10|11)$/.test(draft.keyId)||
        draft.direction!=='up'||
        !Number.isInteger(draft.selectedMidi)||
        !Number.isFinite(draft.updatedAt)||now-draft.updatedAt>300000)continue;
      let changed=[];
      try{changed=JSON.parse(draft.changed);}catch{}
      if(!Array.isArray(changed))changed=[];
      remotes[editorKey]={keyId:draft.keyId,direction:draft.direction,
        selectedMidi:draft.selectedMidi,previewMap:draft.previewMap||'{}',
        changed:changed.filter(x=>Number.isInteger(x)&&x>=36&&x<=100).slice(0,30)};
    }
    practice.setClassroomArpeggioDrafts(id,remotes);
  },error=>console.warn('Live classroom edit preview unavailable; room fingering saves still work.',error));
}
// Allocate a reference without registering onDisconnect on an empty node.
// Room rules require an owned existing record for a delete, so the first
// successful SET must happen before onDisconnect.remove() is registered.
function registerDraftPresenceArpeggio(id){
  if(!ready||!connected||activeId!==id||!firebase)return;
  if(!ownDraftRefArpeggio)ownDraftRefArpeggio=firebase.push(firebase.ref(database,'roomArpeggioEdits/'+id));
  if(latestOwnDraftArpeggio){
    latestOwnDraftArpeggio={...latestOwnDraftArpeggio,updatedAt:Date.now()};
    queueOwnDraftWriteArpeggio();
  }
}
function queueOwnDraftWriteArpeggio(){
  if(!ready||!connected||!activeId||!firebase||!editorUserId)return;
  if(!ownDraftRefArpeggio)ownDraftRefArpeggio=firebase.push(firebase.ref(database,'roomArpeggioEdits/'+activeId));
  const ref=ownDraftRefArpeggio,room=activeId,payload=latestOwnDraftArpeggio;
  draftWriteQueueArpeggio=draftWriteQueueArpeggio.catch(()=>{}).then(async()=>{
    if(activeId!==room||ownDraftRefArpeggio!==ref||!connected)return;
    if(!payload){
      await firebase.remove(ref);
      return;
    }
    await firebase.set(ref,payload);
    if(draftDisconnectRefArpeggio!==ref){
      // Registration is now authorized because the owner's record exists.
      await firebase.onDisconnect(ref).remove();
      draftDisconnectRefArpeggio=ref;
    }
    draftErrorReportedArpeggio=false;
  }).catch(error=>{
    console.warn('Live classroom edit preview could not be synchronized:',error);
    if(!draftErrorReportedArpeggio){
      draftErrorReportedArpeggio=true;
      practice.showToast('即時指法預覽未能同步，請檢查連線或課堂資料權限');
    }
  });
}

function cleanupListeners() {
  if(unsubscribeEditsArpeggio)unsubscribeEditsArpeggio();
  unsubscribeEditsArpeggio=null;
  clearOwnDraftArpeggio();
  if(unsubscribeRoom) unsubscribeRoom();
  if(unsubscribeConnection) unsubscribeConnection();
  if(unsubscribeEdits)unsubscribeEdits();
  unsubscribeEdits=null;
  clearOwnDraft();
  stopPresence();
  unsubscribeRoom = null;
  unsubscribeConnection = null;
}
function leaveRoom() {
  joinAttempt++; // A superseded room read may finish, but must not put us back into a room.
  cleanupListeners();
  activeId = null;
  roomRef = null;
  roomExpiresAt = null;
  ready = false;
  connected = false;
  joining = false;
  replaceHash(null);
  practice.setClassroomDrafts(activeId, {});
  practice.setClassroomRoom(null, null);
  setStatus(configured ? '' : '課堂同步尚未啟用');
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
  editorUserId=auth.currentUser?.uid||null;
  database = dbSdk.getDatabase(app);
  firebase = dbSdk;
}

function updateConnectionState() {
  if(!activeId || !ready) return;
  if(roomExpiresAt && roomExpiresAt <= Date.now()) {
    setStatus('此房間已超過 24 小時，請建立新房間');
    return;
  }
  setStatus(connected ? '' : '等待網路連線，暫時無法同步');
}

function readRoom(id) {
  let timer;
  const reading = (async () => {
    await loadFirebase();
    const ref = firebase.ref(database, 'rooms/' + id);
    // A wrong code must NOT automatically create a new room.
    return {ref, data:(await firebase.get(ref)).val()};
  })();
  return Promise.race([
    reading,
    new Promise((_, reject) => { timer = setTimeout(() => reject(Error('連線逾時，請確認網路後再試一次')), 15000); })
  ]).finally(() => clearTimeout(timer));
}
async function joinRoom(id) {
  if(!validRoom(id)) { practice.showToast('請輸入正確的六位數房號'); return false; }
  if(activeId === id && ready) return true;
  if(joining) return false;
  joining = true;
  const attempt = ++joinAttempt;
  if(joinDialog.open) setJoinStatus('正在加入…');
  else {
    if(disclosure) disclosure.open = true; // Direct invitation links also expose progress and errors.
    setStatus('正在加入課堂房間…');
  }
  updateButtons();
  try {
    const {ref:nextRef, data:roomData} = await readRoom(id);
    if(attempt !== joinAttempt) return false;
    if(!roomData) throw Error('找不到這個房號，請再次確認');
    if(roomData.expiresAt && roomData.expiresAt <= Date.now()) throw Error('房間已過期，請建立新房間');

    cleanupListeners();
    ready = false;
    connected = false;
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
      if(!connected){
        presenceConnectionRef=null;
        ownDraftRef=null;
        ownDraftRefArpeggio=null;draftDisconnectRefArpeggio=null;
        draftDisconnectRef=null; // server removes prior ghost on disconnect
      }
      else if(ready && !wasConnected){
        void markPresent(id);
        void registerDraftPresence(id);void registerDraftPresenceArpeggio(id);
      }
      updateConnectionState();
    });
    watchEdits(id);watchEditsArpeggio(id);
    ready = true;
    if(connected){void markPresent(id);void registerDraftPresence(id);void registerDraftPresenceArpeggio(id);}
    updateConnectionState();
    return true;
  } catch(error) {
    if(attempt !== joinAttempt) return false;
    console.error('Classroom join failed:', error);
    const detail = error.message === '找不到這個房號，請再次確認' || error.message === '房間已過期，請建立新房間' || error.message === '連線逾時，請確認網路後再試一次'
      ? error.message : '無法加入房間，請確認網路後再試一次';
    if(joinDialog.open) setJoinStatus(detail, true);
    else setStatus(detail);
    return false;
  } finally {
    if(attempt === joinAttempt) {
      joining = false;
      updateButtons();
    }
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
  if(activeId) return;
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
        copyButton.focus();
        practice.showToast('房間已建立');
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
    return false;
  }
  if(roomExpiresAt && roomExpiresAt <= Date.now()) {
    updateConnectionState();
    practice.showToast('房間已過期，請建立新房間');
    return false;
  }
  try {
    const result = await firebase.runTransaction(roomRef, current => {
      if(!current || (current.expiresAt && current.expiresAt <= Date.now())) return;
      return update(current);
    }, { applyLocally: false });
    if(!result.committed) practice.showToast('操作未完成，請再試一次');
    return Boolean(result.committed);
  } catch(error) {
    practice.showToast('同步失敗，請稍後再試');
    console.error('Classroom update failed:', error);
    return false;
  }
}
window.classroomSync = {
  changeCount(kind, delta) {
    if((kind!=='major'&&kind!=='minor')||(delta!==1&&delta!==-1)) return Promise.resolve(false);
    const field=kind+'Count';
    return changeRoom(current=>{
      const value=Number(current[field]??2);
      const next=Math.min(12,Math.max(0,(Number.isFinite(value)?Math.trunc(value):2)+delta));
      return {...current,[field]:next,updatedAt:Date.now()};
    });
  },
  setExcludedKeys(excludedKeys) {
    const valid=Array.isArray(excludedKeys)?[...new Set(excludedKeys)].filter(id=>/^(major|minor)-(?:[0-9]|10|11)$/.test(id)):[];
    return changeRoom(current => ({...current,excludedKeys:valid,updatedAt:Date.now()}));
  },
  draw(session, action='new', expectedCreatedAt=null) {
    return changeRoom(current => {
      // Preserve the original session ID only when explicitly overwriting
      // this exact record. Every connected browser uses that stable ID to
      // update the same archived history entry instead of duplicating it.
      if(action==='overwrite'){
        if(!current.session||current.session.createdAt!==expectedCreatedAt)return;
        return {...current,session:{...session,createdAt:current.session.createdAt},
          updatedAt:Date.now()};
      }
      return {...current,session,updatedAt:Date.now()};
    });
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
  setDraft(keyId,draft){
    if(!activeId||!editorUserId)return;
    if(!draft){
      latestOwnDraft=null;
      queueOwnDraftWrite();
      return;
    }
    if(!/^(major|minor)-(?:[0-9]|10|11)$/.test(keyId)||
      !['up','down'].includes(draft.direction)||!Number.isInteger(draft.selectedMidi))return;
    const previewMap=typeof draft.previewMap==='string'?draft.previewMap:'{}';
    if(previewMap.length>1800)return;
    const changed=JSON.stringify(Array.isArray(draft.changed)?draft.changed.slice(0,30):[]);
    if(changed.length>160)return;
    // Keep the latest preview even if the connection has not completed
    // initializing. It will be flushed on connection/reconnection.
    latestOwnDraft={
      owner:editorUserId,keyId,direction:draft.direction,
      selectedMidi:draft.selectedMidi,previewMap,changed,updatedAt:Date.now()
    };
    queueOwnDraftWrite();
  },
  setFingering(id,note,direction=null,originalMap=null,resetAll=false) {
    if(!/^(major|minor)-(?:[0-9]|10|11)$/.test(id)) return;
    const parse=text=>{
      if(typeof text!=='string')return {};
      try{
        const object=JSON.parse(text);
        return object&&typeof object==='object'&&!Array.isArray(object)?object:{};
      }catch{return {};}
    };
    return changeRoom(current=>{
      const fingerings={...(current.fingerings||{})};
      const next={...(fingerings[id]||{})};
      if(direction==='up'||direction==='down'){
        const field=direction+'Map';
        const proposed=parse(note?.[field]),previous=parse(originalMap);
        const saved=resetAll?{}:{...parse(next[field])};
        if(!resetAll){
          const keys=originalMap===null?Object.keys({...saved,...proposed}):
            [...new Set([...Object.keys(previous),...Object.keys(proposed)])];
          for(const pitch of keys){
            if(originalMap!==null&&
              JSON.stringify(previous[pitch])===JSON.stringify(proposed[pitch]))continue;
            if(Object.prototype.hasOwnProperty.call(proposed,pitch))saved[pitch]=proposed[pitch];
            else delete saved[pitch];
          }
        }
        const serialized=Object.keys(saved).length?JSON.stringify(saved):'';
        if(serialized.length>1800)return;
        if(serialized)next[field]=serialized;
        else delete next[field];
        // Keep existing teacher notes and the opposite direction untouched.
      }else{
        for(const field of ['up','down','upMap','downMap']){
          const value=typeof note?.[field]==='string'?note[field].slice(0,field.endsWith('Map')?1800:300):'';
          if(value)next[field]=value;
          else delete next[field];
        }
      }
      if(Object.keys(next).length)fingerings[id]=next;
      else delete fingerings[id];
      const updated={...current,fingerings,updatedAt:Date.now()};
      if(!Object.keys(fingerings).length)delete updated.fingerings;
      return updated;
    });
  },
  setArpeggioDraft(keyId,draft){
    if(!activeId||!editorUserId)return;
    if(!draft){
      latestOwnDraftArpeggio=null;
      queueOwnDraftWriteArpeggio();
      return;
    }
    if(!/^(major|minor)-(?:[0-9]|10|11)$/.test(keyId)||
      draft.direction!=='up'||!Number.isInteger(draft.selectedMidi))return;
    const previewMap=typeof draft.previewMap==='string'?draft.previewMap:'{}';
    if(previewMap.length>1800)return;
    const changed=JSON.stringify(Array.isArray(draft.changed)?draft.changed.slice(0,30):[]);
    if(changed.length>160)return;
    // Keep the latest preview even if the connection has not completed
    // initializing. It will be flushed on connection/reconnection.
    latestOwnDraftArpeggio={
      owner:editorUserId,keyId,direction:draft.direction,
      selectedMidi:draft.selectedMidi,previewMap,changed,updatedAt:Date.now()
    };
    queueOwnDraftWriteArpeggio();
  },
  setArpeggioFingering(id,note,direction='up',originalMap=null,resetAll=false) {
    if(direction!=='up'||!/^(major|minor)-(?:[0-9]|10|11)$/.test(id))return;
    const parse=text=>{
      try{const value=JSON.parse(text);return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch{return {};}
    };
    return changeRoom(current=>{
      const records={...(current.arpeggioFingerings||{})};
      const saved=resetAll?{}:{...parse(records[id]?.upMap)};
      const previous=parse(originalMap),proposed=parse(note?.upMap);
      if(!resetAll){
        const keys=originalMap===null?Object.keys({...saved,...proposed}):
          [...new Set([...Object.keys(previous),...Object.keys(proposed)])];
        for(const pitch of keys){
          if(originalMap!==null&&JSON.stringify(previous[pitch])===JSON.stringify(proposed[pitch]))continue;
          if(Object.prototype.hasOwnProperty.call(proposed,pitch))saved[pitch]=proposed[pitch];
          else delete saved[pitch];
        }
      }
      const value=Object.keys(saved).length?JSON.stringify(saved):'';
      if(value.length>1800)return;
      if(value)records[id]={upMap:value};else delete records[id];
      const next={...current,updatedAt:Date.now()};
      if(Object.keys(records).length)next.arpeggioFingerings=records;else delete next.arpeggioFingerings;
      return next;
    });
  }
};
function requestRoomAction(action, beforePrompt) {
  if(typeof practice.requestClassroomTransition === 'function') return practice.requestClassroomTransition(action, beforePrompt);
  return action();
}
createButton.addEventListener('click', () => requestRoomAction(createRoom));
openJoinButton.addEventListener('click', () => {
  if(joining || activeId || !configured) return;
  setStatus('');
  setJoinStatus('');
  joinDialog.showModal();
  joinInput.focus();
  syncDigits();
});
joinCancel.addEventListener('click', () => { if(!joining) joinDialog.close(); });
joinDialog.addEventListener('cancel', event => { if(joining) event.preventDefault(); });
joinDialog.addEventListener('close', () => {
  if(!document.querySelector?.('dialog[open]')) (activeId ? copyButton : openJoinButton).focus();
});
let composingCode = false;
joinInput.addEventListener('compositionstart', () => { composingCode = true; });
joinInput.addEventListener('compositionend', () => { composingCode = false; reflectCode(); });
joinInput.addEventListener('input', event => { if(!composingCode && !event.isComposing) reflectCode(); });
for(const name of ['click','keyup','select']) joinInput.addEventListener(name, syncDigits);
joinForm.addEventListener('submit', async event => {
  event.preventDefault();
  if(joining || composingCode || activeId) return;
  const code = normalizeCode(joinInput.value);
  if(!shortCodePattern.test(code)) {
    setJoinStatus('請輸入完整的六位數字。', true);
    joinInput.focus();
    return;
  }
  return requestRoomAction(async () => {
    if(joining || activeId) return;
    if(!joinDialog.open) {
      joinDialog.showModal();
      joinInput.focus();
    }
    const joined = await joinRoom(code);
    if(joined) {
      joinInput.value = '';
      setJoinStatus('');
      syncDigits();
      joinDialog.close();
    } else joinInput.focus();
  }, () => joinDialog.close());
});
copyButton.addEventListener('click', async () => {
  if(!activeId) return;
  const url = roomURL(activeId);
  try {
    await navigator.clipboard.writeText(url);
    practice.showToast('已複製課堂邀請連結');
  } catch(_) {
    window.prompt('複製邀請連結：', url);
  }
});
leaveButton.addEventListener('click', () => requestRoomAction(() => {
  leaveRoom();
  openJoinButton.focus();
}));
window.addEventListener('hashchange', () => {
  const id = hashRoom();
  if(id && id !== activeId) {
    if(joinDialog.open && !joining) joinDialog.close();
    joinRoom(id);
  } else if(!id && activeId) leaveRoom();
});
window.addEventListener('focus', updateConnectionState);
updateButtons();
const room = hashRoom();
if(room) joinRoom(room);
else setStatus(configured ? '' : '課堂同步尚未啟用');
