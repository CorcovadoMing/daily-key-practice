const test=require('node:test'),a=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const html=fs.readFileSync('index.html','utf8');
function setup(reduced=false){let focused=false,animations=[];const panel={hidden:false,inert:false,contains:()=>true,setAttribute(){},getBoundingClientRect:()=>({height:200}),animate(frames,options){const animation={cancel(){this.cancelled=true},frames,options};animations.push(animation);return animation}};const item={panel,title:{focus(){focused=true}}};const env={window:{matchMedia:()=>({matches:reduced})},document:{activeElement:{}},getComputedStyle:()=>({opacity:'1',paddingTop:'16px',paddingBottom:'16px',borderTopWidth:'1px'})};vm.createContext(env);vm.runInContext(html.slice(html.indexOf('    function disclosureMotion('),html.indexOf('    function syncPracticeCards(')),env);return {item,animations,run:open=>env.setCardPanelOpen(item,open),focused:()=>focused}}
test('no copy control or dead copy handler',()=>{a.ok(!html.includes('copy-button'));a.ok(!html.includes('function copyList'));a.ok(!html.includes('result-controls'))});
test('initial and reduced-motion state is instant and collapses focus safely',()=>{const s=setup(true);s.run(true);s.run(false);a.equal(s.animations.length,0);a.equal(s.item.panel.hidden,true);a.equal(s.item.panel.inert,true);a.equal(s.focused(),true)});
test('rapid reversal cancels old animation and stale completion cannot hide open panel',()=>{const s=setup();s.run(true);s.run(false);const old=s.animations[0];a.equal(s.item.panel.inert,true);s.run(true);a.equal(old.cancelled,true);old.onfinish();a.equal(s.item.panel.hidden,false);s.animations[1].onfinish();a.equal(s.item.panel.hidden,false);a.equal(s.item.panel.inert,false);a.equal(s.item.panelAnimation,null);a.equal(old.options.duration,440);a.equal(old.options.easing,'cubic-bezier(.4,0,.6,1)')});

test('cumulative heading is concise and animated panels do not chase scroll anchors',()=>{a.match(html,/>累積練習<\/h3>/);a.ok(!html.includes('累積練習 · 24 調'));a.match(html,/\.fingering-section\{overflow-anchor:none;/);});

test('both folded directions use the same full duration, and interrupted changes retain proportion',()=>{
 const s=setup();s.run(true);s.run(false);s.animations[0].onfinish();s.run(true);
 a.deepEqual(JSON.stringify(s.animations[0].options),JSON.stringify(s.animations[1].options));
 a.match(html,/disclosureMotion\(launchBody,from,to,full\)/);
});

function nativeDetailsSetup(reduced=false){
  const animations=[],child={inert:false},summary={expanded:null,setAttribute(_,v){this.expanded=v;},removeAttribute(){this.expanded=null;},focus(){}};
  const detail={open:false,children:[summary,child],animationHeight:null,active:false,contains:()=>true,
    hasAttribute:key=>key==='data-active'&&detail.active,
    getBoundingClientRect:()=>({height:detail.animationHeight??(detail.open?244:44)}),
    animate(frames,options){
      const n={frames,options,cancel(){detail.animationHeight=null;}};animations.push(n);return n;
    }};
  const env={window:{matchMedia:()=>({matches:reduced})},document:{querySelector(){},activeElement:null,
    addEventListener(){}},disclosureMotion:(_,from,to,scale)=>({duration:Math.round(440*Math.abs(to-from)/scale)})};
  vm.runInNewContext(html.slice(html.indexOf('    const motionDetailsSelector='),html.indexOf("    window.addEventListener('beforeprint'")),env);
  return {animations,child,summary,detail,show(open){env.changeMotionDetails(detail,summary,open);}};
}
test('native disclosure uses actual endpoints and the same time both ways',()=>{
 const s=nativeDetailsSetup();s.show(true);
 a.equal(s.animations[0].options.duration,440);a.deepEqual(Array.from(s.animations[0].frames,k=>k.height),['44px','244px']);
 a.equal(s.child.inert,false);s.animations[0].onfinish();
 s.show(false);a.equal(s.child.inert,true);a.equal(s.summary.expanded,'false');
 a.equal(s.animations[1].options.duration,440);a.deepEqual(Array.from(s.animations[1].frames,k=>k.height),['244px','44px']);
 s.animations[1].onfinish();a.equal(s.child.inert,false);a.equal(s.detail.open,false);
});
test('interrupting a native close cannot hide its reopened body; reduced mode imposes no animation',()=>{
 const s=nativeDetailsSetup();s.show(true);s.animations[0].onfinish();s.show(false);s.detail.animationHeight=150;s.show(true);
 a.equal(s.child.inert,false);a.equal(s.animations[2].frames[0].height,'150px');
 s.animations[1].onfinish();a.equal(s.detail.open,true);s.animations[2].onfinish();
 a.equal(s.detail.open,true);a.equal(s.summary.expanded,null);
 const n=nativeDetailsSetup(true);n.show(true);n.show(false);a.equal(n.animations.length,0);a.equal(n.detail.open,false);
});
test('touch removes only flash signals and keeps pressed state styling and keyboard outline',()=>{
 a.match(html,/html\{scroll-behavior:smooth;-webkit-tap-highlight-color:transparent\}/);
 a.doesNotMatch(html,/:active:not\(:disabled\)\{box-shadow:inset 0 0 0 2px currentColor/);
 a.match(html,/button:not\(:disabled\):active\{scale:/);
 a.match(html,/\.fifths-circle \.filter-key\[aria-pressed=true\]\{\s*background:var\(--tonality-major\)/);
 a.match(html,/summary,input,select,textarea,\[tabindex\]\):focus-visible\{outline:/);
});
