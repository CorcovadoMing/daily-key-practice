const test=require('node:test'),a=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const html=fs.readFileSync('index.html','utf8');
function setup(reduced=false){
 let frames=[],scrolls=[],modal=false,resolve;const finish=new Promise(r=>resolve=r);
 const item={opened:false,title:{isConnected:true,scrollIntoView:o=>scrolls.push(o)},guide:{isEditing:()=>false}};
 const other={panelAnimation:{finished:finish},guide:{isEditing:()=>false}};
 const env={cardInstances:new Map([['x',item],['y',other]]),cardScrollRequest:0,expandedOverride:null,
 currentSession:()=>({}),syncPracticeCards(){item.opened=env.expandedOverride==='x'},document:{querySelector:()=>modal},
 requestAnimationFrame:fn=>frames.push(fn),window:{matchMedia:()=>({matches:reduced})}};
 vm.createContext(env);vm.runInContext(html.slice(html.indexOf('    function scrollExpandedTitleAfterLayout('),html.indexOf('    function renderPracticeNavigation(')),env);
 return{env,item,scrolls,resolve,modal:v=>modal=v,async settle(){resolve();await new Promise(r=>setImmediate(r));while(frames.length)frames.shift()();}};
}
test('opening waits for all animation completion and layout, smooth without moving focus',async()=>{
 const s=setup();s.env.toggleCardExpansion('x');a.equal(s.scrolls.length,0);await s.settle();a.equal(s.scrolls.length,1);a.equal(s.scrolls[0].behavior,'smooth');a.equal(s.scrolls[0].block,'start');
});
test('reduced motion uses auto; collapse never adds a scroll',async()=>{
 const s=setup(true);s.env.toggleCardExpansion('x');await s.settle();a.equal(s.scrolls[0].behavior,'auto');s.env.toggleCardExpansion('x');await s.settle();a.equal(s.scrolls.length,1);
});
for(const reason of['close','superseded','replaced','modal','editing','disconnected'])test('pending title scroll is cancelled: '+reason,async()=>{
 const s=setup();s.env.toggleCardExpansion('x');
 if(reason==='close')s.env.toggleCardExpansion('x');
 if(reason==='superseded')s.env.cardScrollRequest++;
 if(reason==='replaced')s.env.cardInstances.set('x',{});
 if(reason==='modal')s.modal(true);
 if(reason==='editing')s.item.guide.isEditing=()=>true;
 if(reason==='disconnected')s.item.title.isConnected=false;
 await s.settle();a.equal(s.scrolls.length,0);
});
test('title spacing clears mobile top chrome and restored/direct behavior remains separate',()=>{
 a.match(html,/max-width:660px\)\{\.key-title\{scroll-margin-top:calc\(72px \+ env\(safe-area-inset-top,0px\)\)/);
 const jump=html.slice(html.indexOf('    function jumpToPractice('),html.indexOf('    function scrollExpandedTitleAfterLayout('));
 a.match(jump,/cardScrollRequest\+\+/);a.match(jump,/item.title.focus\(\{preventScroll:true\}\)/);a.match(jump,/item.card.scrollIntoView/);
 a.equal((html.match(/if\(opening\)scrollExpandedTitleAfterLayout/g)||[]).length,1);
});
