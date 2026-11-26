const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8'),room=fs.readFileSync('classroom.js','utf8');
function harness(inRoom=true) {
 const pending=[], buttons={}, notices=[];
 const state={preferences:{majorCount:1,minorCount:1}};
 const e={window:{},q:id=>(buttons[id]??={addEventListener(_,f){this.click=f;}}),state,
   sharedRoom:inRoom?{id:'sandbox',majorCount:1,minorCount:1}:null,visiblePreferences:()=>e.sharedRoom||state.preferences,
   ready:true,connected:true,roomRef:{},roomExpiresAt:null,
   practice:{showToast:s=>notices.push(s)},clamp:n=>Math.max(0,Math.min(12,n)),persist(){},renderControls(){},
   firebase:{runTransaction(ref,update,opts){assert.equal(opts.applyLocally,false);pending.push(update);return Promise.resolve({committed:true});}}};
 const roomFns=room.slice(room.indexOf('async function changeRoom(update)'),room.indexOf('  setExcludedKeys(excludedKeys) {'))+'};';
 const localFns=html.slice(html.indexOf('    function setCounts(major,minor)'),html.indexOf('    // SESSION_LAUNCH_START'));
 const newer=html.includes('    function changeCount(kind,delta)');
 const local=newer?html.slice(html.indexOf('    function changeCount(kind,delta)'),html.indexOf('    // SESSION_LAUNCH_START')):localFns;
 const clicks=html.slice(html.indexOf("    q('#major-minus').addEventListener"),html.indexOf('    let closedForPrint='));
 vm.runInNewContext(roomFns+local+clicks,e);
 let data={majorCount:1,minorCount:1,marker:'keep'};
 const assertCounts=(a,b)=>assert.deepEqual([data.majorCount,data.minorCount,data.marker],[a,b,'keep']);
 const settle=()=>{const same=data;for(const fn of pending)fn(same);for(const fn of pending.splice(0))data=fn(data)??data;};
 return {buttons,state,assertCounts,settle};
}
test('two quick plus clicks with no readback both count',()=>{const h=harness();h.buttons['#major-plus'].click();h.buttons['#major-plus'].click();h.settle();h.assertCounts(3,1);});
test('before readback, major and minor clicks preserve both changes',()=>{const h=harness();h.buttons['#major-plus'].click();h.buttons['#minor-plus'].click();h.settle();h.assertCounts(2,2);});
test('transaction retries do not multiply the delta and preserve the unrelated field and limits',()=>{const h=harness();for(let i=0;i<20;i++){h.buttons['#major-plus'].click();h.buttons['#minor-minus'].click();}h.settle();h.assertCounts(12,0);});
test('personal counts remain immediately editable without remote state',()=>{const h=harness(false);h.buttons['#major-plus'].click();h.buttons['#major-plus'].click();h.buttons['#minor-minus'].click();assert.deepEqual(h.state.preferences,{majorCount:3,minorCount:0});});
