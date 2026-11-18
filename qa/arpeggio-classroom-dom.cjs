// Two isolated DOM/localStorage clients with a deterministic mock room bridge.
// This is NOT a Firebase emulator or a physical Safari test.
const {JSDOM}=require(process.env.JSDOM_MODULE||'jsdom'),fs=require('fs'),a=require('node:assert/strict');
(async()=>{
const html=fs.readFileSync('index.html','utf8'),storeKey='daily-key-practice:experimental:v1';
function client(){
 const dom=new JSDOM(html,{url:'http://localhost',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,d=w.document;
 w.matchMedia=()=>({matches:true,addEventListener(){}});w.ResizeObserver=class{observe(){}disconnect(){}};w.scrollBy=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 for(const script of d.querySelectorAll('script')){
  if(script.type==='module')continue;
  if(script.src){if(script.src.includes('firebase'))continue;w.eval(fs.readFileSync(new URL(script.src).pathname.slice(1),'utf8'));}
  else w.eval(script.textContent);
 }
 return {w,d,store:()=>JSON.parse(w.localStorage.getItem(storeKey)),arp:()=>d.querySelector('.arpeggio-section'),scale:()=>d.querySelector('.fingerboard-section:not(.arpeggio-section)')};
}
const clients=[client(),client()];
let room={createdAt:1,majorCount:1,minorCount:0,showScale:true,session:{date:'2026-11-18',createdAt:1,majorIds:[0],minorIds:[],doneIds:[]},
 fingerings:{'major-0':{upMap:'{"40":{"s":0,"f":4}}'}}};
const sync=()=>clients.forEach(c=>c.w.DailyKeyPractice.setClassroomRoom('123456',JSON.parse(JSON.stringify(room))));
clients.forEach((c,i)=>c.w.classroomSync={
 setDraft:(id,draft)=>clients[1-i].w.DailyKeyPractice.setClassroomDrafts('123456',draft?{other:{...draft,keyId:id}}:{}),
 setArpeggioDraft:(id,draft)=>clients[1-i].w.DailyKeyPractice.setClassroomArpeggioDrafts('123456',draft?{other:{...draft,keyId:id}}:{}),
 setArpeggioFingering:(id,note,dir,original)=>{
  const before=JSON.parse(original||'{}'),after=JSON.parse(note.upMap||'{}'),saved=JSON.parse(room.arpeggioFingerings?.[id]?.upMap||'{}');
  for(const pitch of new Set([...Object.keys(before),...Object.keys(after)])){
   if(JSON.stringify(before[pitch])===JSON.stringify(after[pitch]))continue;
   if(after[pitch])saved[pitch]=after[pitch];else delete saved[pitch];
  }
  room.arpeggioFingerings??={};if(Object.keys(saved).length)room.arpeggioFingerings[id]={upMap:JSON.stringify(saved)};else delete room.arpeggioFingerings[id];sync();
 }
});
sync();
const [A,B]=clients,clickNote=(c,pitch)=>c.arp().querySelector('.cello-fb-note[data-midi="'+pitch+'"]').dispatchEvent(new c.w.MouseEvent('click',{bubbles:true})),
finger=(c,n)=>[...c.arp().querySelectorAll('.cello-inline-finger')].find(b=>b.textContent===String(n)).click(),
press=(c,action)=>c.arp().querySelector('.cello-inline-'+action).click();
clickNote(A,40);finger(A,1);
a.ok(B.arp().querySelector('.cello-fb-remote-label'));
a.equal(B.scale().querySelector('.cello-fb-remote-label'),null);
a.equal(room.arpeggioFingerings,undefined);
a.deepEqual(B.store().arpeggioFingerings,{});
// Second client starts a different-note transaction before first confirmation.
clickNote(B,48);finger(B,1);press(A,'save');
a.equal(B.arp().querySelector('.cello-inline-editor').hidden,false,'remote confirmation keeps active edit');
press(B,'save');
a.deepEqual(JSON.parse(room.arpeggioFingerings['major-0'].upMap),{40:{s:0,f:1},48:{s:1,f:1}});
for(const c of clients){
 a.deepEqual(JSON.parse(c.store().arpeggioFingerings['major-0'].upMap),{40:{s:0,f:1},48:{s:1,f:1}});
 a.equal(c.store().fingerings['major-0'].upMap,'{"40":{"s":0,"f":4}}');
}
// Reset/cancel don't publish until confirmation; undo restores staged content.
clickNote(A,40);press(A,'reset');a.ok(room.arpeggioFingerings['major-0']);
press(A,'undo');a.equal(A.arp().querySelector('.cello-inline-save').disabled,true);
finger(A,2);A.d.querySelector('.key-title').click();
a.equal(A.d.querySelector('.cello-leave-dialog').open,true);
A.d.querySelector('.cello-leave-discard').click();
a.equal(JSON.parse(room.arpeggioFingerings['major-0'].upMap)[40].f,1);
a.equal(B.arp().querySelector('.cello-fb-remote-label'),null);
clickNote(A,40);press(A,'reset');press(A,'save');
a.equal(room.arpeggioFingerings['major-0'],undefined);
for(const c of clients)a.equal(c.store().arpeggioFingerings['major-0'],undefined);
// Failed/offline confirmation restores authoritative room view, not a fake save.
A.w.classroomSync.setArpeggioFingering=async()=>false;
clickNote(A,40);finger(A,1);press(A,'save');
await Promise.resolve();await Promise.resolve();
a.equal(A.arp().querySelector('.cello-fb-changed'),null);
a.equal(A.store().arpeggioFingerings['major-0'],undefined);
// Exit clears remote preview bookkeeping and keeps personal scale data.
clients.forEach(c=>c.w.DailyKeyPractice.setClassroomRoom(null,null));
for(const c of clients){a.equal(c.store().fingerings['major-0'].upMap,'{"40":{"s":0,"f":4}}');c.w.close();}
console.log('PASS two isolated DOM clients: preview/confirm/cancel/undo/reset, draft-preserving receive, both-device persistence, failed-save rollback, no scale contamination, leave');

})().catch(e=>{console.error(e);process.exit(1)});
