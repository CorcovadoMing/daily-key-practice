const test=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(new URL('../index.html','file://'+__filename),'utf8');
test('only the bottom-right shortcut is available on viable desktop viewports; narrow fallback stays inline',()=>{
 a.match(html,/\.practice-float\{position:fixed;right:[^;]+;bottom:var\(--practice-float-bottom,76px\)/);
 a.doesNotMatch(html,/\.container\{width:calc\(100% - 155px\)/);
 a.match(html,/@media\(min-width:1120px\) and \(min-height:321px\)\{\s*body:has\(#floating-practice-nav:not\(\[hidden\]\)\) \.result-bottom\{display:none\}/);
 a.match(html,/@media\(max-width:1119px\),\(max-height:320px\)\{\.practice-float\{display:none!important\}/);
});
test('the dock width transition is based on button size, not on its changing width',()=>{
 let top=737;
 const css=new Map(),styles={setProperty:(k,v)=>css.set(k,v)};
 let right=220;const rail={style:styles},tools={style:styles,querySelector:()=>({offsetWidth:182,scrollWidth:182}),getBoundingClientRect:()=>({top,left:12,right})};
 const els={'.audio-tools':tools};
 const tuner={hidden:true,offsetHeight:76};
 const ctx={document:{querySelector:k=>els[k]},$:id=>id==='floating-practice-nav'?rail:['tuner-preferences','metronome-panel'].includes(id)?{hidden:true}:tuner,
  innerWidth:1200,innerHeight:800,getComputedStyle:()=>({paddingLeft:'12px',paddingRight:'12px',borderLeftWidth:'1px',borderRightWidth:'1px',getPropertyValue:()=> '8px'})};
 const start=html.indexOf('  function alignTunerSettings('),end=html.indexOf('  const toolResize',start);
 vm.runInNewContext(html.slice(start,end)+';this.resize=sizeTools;',ctx);
 ctx.resize();
 a.equal(css.get('--practice-float-bottom'),'73px');
 tuner.hidden=false;right=1188;ctx.resize();
 a.equal(css.get('--tools-width'),undefined);
 a.equal(css.get('--practice-float-bottom'),'73px');
 a.equal(css.get('--dock-compact-width'),'208px');
 a.equal(css.get('--dock-readout-start'),'202px');
 tuner.hidden=true;ctx.resize();
 a.equal(css.get('--practice-float-bottom'),'73px');
 a.match(html,/toolResize.observe\(document.querySelector\('\.audio-buttons'\)\)/);
});
test('selection summary has labeled heading and separate grid rows',()=>{
 const html=fs.readFileSync('index.html','utf8');
 a.match(html,/class="filter-status sr-only" role="group" aria-labelledby="key-filter-title"/);
 a.match(html,/id="key-filter-title">已選調性<\/h3>/);
 a.match(html,/\.filter-status\{[^}]*display:grid;gap:6px;margin-top:26px/);
 a.match(html,/<span>大調 <b id="major-eligible">12 \/ 12<\/b><\/span><span>古典旋律小調 <b id="minor-eligible">12 \/ 12<\/b><\/span>/);
});
