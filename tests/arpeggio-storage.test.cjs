const test=require('node:test'),a=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const html=fs.readFileSync('index.html','utf8');
function setup(sharedRoom=null){
 const state={fingerings:{'major-0':{up:'legacy memo',upMap:'{"40":{"s":0,"f":4}}',downMap:'legacy-down'}},arpeggioFingerings:{}};
 let persisted,updated,sends=0;
 const c={state,sharedRoom,window:{CelloFingerboard:{decodeMap:raw=>{try{return JSON.parse(raw)||{};}catch{return {};}}},
 classroomSync:{setFingering(){sends++;}}},
 boardInstances:new Map([['major-0',{updateArpeggioAnnotations:n=>updated=n}]]),
 persist:()=>persisted=JSON.stringify(state),showToast(){}};
 vm.createContext(c);
 vm.runInContext(html.slice(html.indexOf('function mergeFingeringMap('),html.indexOf('function saveInlineFingering(')),c);
 return {c,state,get saved(){return JSON.parse(persisted);},get updated(){return updated;},get sends(){return sends;}};
}
for(const classroom of [false])test('arpeggio storage isolated, reloadable and reversible '+(classroom?'in classroom':'in personal mode'),()=>{
 const s=setup(classroom?{fingerings:{'major-0':{upMap:'{"40":{"s":1,"f":2}}'}}}:null);
 const legacy=JSON.stringify(s.state.fingerings);
 s.c.saveArpeggioFingering('major-0','{"40":{"s":0,"f":1}}');
 a.deepEqual(s.saved.arpeggioFingerings['major-0'],{upMap:'{"40":{"s":0,"f":1}}'});
 a.equal(JSON.stringify(s.saved.fingerings),legacy);a.equal(s.sends,0);
 a.equal(s.updated.upMap,s.saved.arpeggioFingerings['major-0'].upMap);
 // Merge one transaction's changed note without losing another newer note.
 s.state.arpeggioFingerings['major-0'].upMap='{"40":{"s":0,"f":1},"48":{"s":1,"f":4}}';
 s.c.saveArpeggioFingering('major-0','{"40":{"s":0,"f":2}}','{"40":{"s":0,"f":1}}');
 a.deepEqual(JSON.parse(s.saved.arpeggioFingerings['major-0'].upMap),{40:{s:0,f:2},48:{s:1,f:4}});
 s.c.saveArpeggioFingering('major-0','','{"40":{"s":0,"f":2},"48":{"s":1,"f":4}}');
 a.equal(s.saved.arpeggioFingerings['major-0'],undefined);
 a.equal(JSON.stringify(s.saved.fingerings),legacy);a.equal(s.sends,0);
});
test('app wires distinct arpeggio namespace, not Firebase scale fields',()=>{
 a.match(html,/annotations:\(sharedRoom\?sharedRoom\.arpeggioFingerings:state\.arpeggioFingerings\)\[id\]\|\|\{\}/);
 a.match(html,/onSave:\(direction,map,original,resetAll\)=>saveArpeggioFingering/);
 a.match(html,/if\(!state\.arpeggioFingerings\|\|typeof state\.arpeggioFingerings!=='object'\)state\.arpeggioFingerings=\{\}/);
});
