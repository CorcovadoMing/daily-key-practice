const test=require('node:test'),a=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('classroom.js','utf8'),html=fs.readFileSync('index.html','utf8');
const copy=v=>JSON.parse(JSON.stringify(v));
function pair(){
 const now=Date.now(),data={rooms:{'123456':{majorCount:2,minorCount:2,showScale:true,createdAt:now,expiresAt:now+3600000,updatedAt:now,fingerings:{'major-0':{upMap:'{"40":{"s":0,"f":4}}'}}}}};
 let serial=0;const listeners=new Map();
 const read=path=>path.split('/').reduce((v,k)=>v?.[k],data);
 const write=(path,value)=>{const keys=path.split('/');let p=data;for(const k of keys.slice(0,-1))p=p[k]??={};if(value===null)delete p[keys.at(-1)];else p[keys.at(-1)]=copy(value);
 for(const [path,callbacks]of listeners)for(const cb of callbacks)cb({val:()=>copy(read(path)||{})});};
 const sdk={
  ref:(_,path)=>({path,key:path.split('/').at(-1)}),
  push:ref=>({path:ref.path+'/'+String(++serial).padStart(20,'x'),key:String(serial).padStart(20,'x')}),
  onValue(ref,cb){if(!listeners.has(ref.path))listeners.set(ref.path,new Set());listeners.get(ref.path).add(cb);cb({val:()=>copy(read(ref.path)||{})});return()=>listeners.get(ref.path).delete(cb);},
  set:async(ref,value)=>write(ref.path,value),remove:async ref=>write(ref.path,null),
  onDisconnect:()=>({remove:async()=>{},cancel:async()=>{}}),
  runTransaction:async(ref,update)=>{const next=update(copy(read(ref.path)));if(next===undefined)return {committed:false};write(ref.path,next);return {committed:true};}
 };
 function client(uid){
  const c={window:{},console,Date,Promise,JSON,database:{},firebase:sdk,ready:true,connected:true,activeId:'123456',roomExpiresAt:now+3600000,roomRef:sdk.ref(null,'rooms/123456'),editorUserId:uid,
   ownDraftRefArpeggio:null,latestOwnDraftArpeggio:null,draftDisconnectRefArpeggio:null,unsubscribeEditsArpeggio:null,draftErrorReportedArpeggio:false,draftWriteQueueArpeggio:Promise.resolve(),remotes:{},
   practice:{showToast(){},setClassroomArpeggioDrafts:(_,v)=>c.remotes=copy(v)},updateConnectionState(){}};
  vm.createContext(c);
  vm.runInContext(source.slice(source.indexOf('function clearOwnDraftArpeggio'),source.indexOf('function cleanupListeners()')),c);
  vm.runInContext(source.slice(source.indexOf('async function changeRoom('),source.indexOf("createButton.addEventListener")),c);
  c.watchEditsArpeggio('123456');
  return {...c,ctx:c,api:c.window.classroomSync,flush:()=>c.draftWriteQueueArpeggio};
 }
 return {data,read,write,A:client('teacher'),B:client('student')};
}
const draft=(midi,f)=>({direction:'up',selectedMidi:midi,previewMap:JSON.stringify({[midi]:{s:0,f}}),changed:[midi]});
test('two isolated clients: draft/cancel never confirm, namespaces never cross, delta races preserve both',async()=>{
 const {A,B,data,read}=pair(),original=copy(data.rooms['123456'].fingerings);
 A.api.setArpeggioDraft('major-0',draft(40,1));await A.flush();
 a.equal(Object.values(B.ctx.remotes)[0].selectedMidi,40);a.equal(Object.keys(A.ctx.remotes).length,0);
 a.equal(read('roomEdits/123456'),undefined);a.equal(data.rooms['123456'].arpeggioFingerings,undefined);
 A.api.setArpeggioDraft('major-0',null);await A.flush();a.equal(Object.keys(B.ctx.remotes).length,0);
 await Promise.all([
  A.api.setArpeggioFingering('major-0',{upMap:'{"40":{"s":0,"f":1}}'},'up','{}'),
  B.api.setArpeggioFingering('major-0',{upMap:'{"48":{"s":1,"f":2}}'},'up','{}')
 ]);
 a.deepEqual(JSON.parse(data.rooms['123456'].arpeggioFingerings['major-0'].upMap),{40:{s:0,f:1},48:{s:1,f:2}});
 a.deepEqual(data.rooms['123456'].fingerings,original);
 // Reset only what this editor saw. A later unrelated pitch survives.
 await A.api.setArpeggioFingering('major-0',{upMap:''},'up','{"40":{"s":0,"f":1}}');
 a.deepEqual(JSON.parse(data.rooms['123456'].arpeggioFingerings['major-0'].upMap),{48:{s:1,f:2}});
 await A.api.setFingering('major-0',{upMap:''},'up',null,true);
 a.ok(data.rooms['123456'].arpeggioFingerings['major-0'],'legacy scale reset preserves arpeggio');
 await B.api.setArpeggioFingering('major-0',{upMap:''},'up',null,true);
 a.equal(data.rooms['123456'].arpeggioFingerings,undefined);
});
test('queued draft leave, offline/reconnect, stale callback and wrong directions are bounded',async()=>{
 const {A,B,read}=pair();
 A.api.setArpeggioDraft('major-0',draft(40,1));
 A.ctx.clearOwnDraftArpeggio();A.ctx.activeId=null;
 await A.flush();a.deepEqual(read('roomArpeggioEdits/123456')||{},{});
 A.ctx.activeId='123456';A.ctx.connected=false;
 A.api.setArpeggioDraft('major-0',draft(40,2));await A.flush();
 a.deepEqual(read('roomArpeggioEdits/123456')||{},{});
 A.ctx.connected=true;A.ctx.registerDraftPresenceArpeggio('123456');await A.flush();
 a.equal(Object.values(B.ctx.remotes)[0].selectedMidi,40);
 A.ctx.clearOwnDraftArpeggio();await A.flush();a.equal(Object.keys(B.ctx.remotes).length,0);
 A.api.setArpeggioDraft('major-0',{...draft(40,1),direction:'down'});await A.flush();a.equal(Object.keys(B.ctx.remotes).length,0);
 B.ctx.activeId='654321';A.api.setArpeggioDraft('major-0',draft(40,1));await A.flush();
 a.equal(Object.keys(B.ctx.remotes).length,0,'old room listener ignored after navigation');
});
test('received confirmed arpeggio maps inherit locally without migrating or deleting old local scale edits',()=>{
 const state={fingerings:{'major-0':{upMap:'legacy-scale'}},arpeggioFingerings:{'major-0':{upMap:'{"48":{"s":1,"f":4}}'}}};
 const c={state,persist(){},window:{CelloFingerboard:{decodeMap:raw=>{try{return JSON.parse(raw)||{};}catch{return {};}}}}};
 vm.createContext(c);
 vm.runInContext(html.slice(html.indexOf('function mergeFingeringMap('),html.indexOf('// Arpeggio and scale records')),c);
 vm.runInContext(html.slice(html.indexOf('    function inheritConfirmedArpeggioFingerings('),html.indexOf('    function roomLayoutSignature(')),c);
 const input={createdAt:123,arpeggioFingerings:{'major-0':{upMap:'{"40":{"s":0,"f":1}}'}}};
 c.inheritConfirmedArpeggioFingerings('123456',input);
 a.deepEqual(JSON.parse(state.arpeggioFingerings['major-0'].upMap),{40:{s:0,f:1},48:{s:1,f:4}});
 c.inheritConfirmedArpeggioFingerings('123456',{createdAt:123});
 a.deepEqual(JSON.parse(state.arpeggioFingerings['major-0'].upMap),{48:{s:1,f:4}});
 a.equal(state.fingerings['major-0'].upMap,'legacy-scale');
 a.equal(state.roomFingeringSnapshots,undefined);
});
test('offline, expired and denied arpeggio saves report failure without changing confirmed room state',async()=>{
 const {A,data}=pair(),original=copy(data.rooms['123456']);
 const save=()=>A.api.setArpeggioFingering('major-0',{upMap:'{"40":{"s":0,"f":1}}'},'up','{}');
 A.ctx.connected=false;a.equal(await save(),false);
 A.ctx.connected=true;A.ctx.roomExpiresAt=Date.now()-1;a.equal(await save(),false);
 A.ctx.roomExpiresAt=Date.now()+10000;
 A.ctx.console={...console,error(){}};
 A.ctx.firebase={...A.ctx.firebase,runTransaction:async()=>{throw Error('PERMISSION_DENIED')}};
 a.equal(await save(),false);a.deepEqual(data.rooms['123456'],original);
});
