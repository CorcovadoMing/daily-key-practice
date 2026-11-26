const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
const y=color=>rgb(color).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4)
  .reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>(Math.max(y(a),y(b))+.05)/(Math.min(y(a),y(b))+.05);
test('dark overlay keeps the narrower chart rule above the broad theme background, also when selected',()=>{
 const mask=html.match(/\[data-appearance=dark\] :is\(\.room-action,[^{}]*\.scale-practice button[^{}]*\)\{background:var\(--theme-high\);/);
 const reset=html.match(/\[data-appearance=dark\] \.scale-pitch-chart \.scale-pitch-select\{background:transparent;border-color:transparent}/);
 assert.ok(mask&&reset);
 // The broad rule's most-specific selector is ancestor + 2 classes and one
 // element [0,2,1]. Reset has ancestor + 2 classes [0,3,0], regardless of order.
 assert.ok(mask.index<reset.index);
 assert.match(html,/\.scale-pitch-select\{position:absolute;inset:0;z-index:4/);
 assert.match(html,/\.scale-pitch-select\[aria-pressed=true\]\{box-shadow:inset[^}]*#9bd0f5/);
 assert.match(html,/\.scale-pitch-chart \.scale-pitch-select:focus-visible\{outline-color:var\(--ui-focus/);
 assert.doesNotMatch(html,/\.scale-pitch-select[^{}]*\[aria-pressed=true\][^{}]*\{[^}]*background:(?!transparent)/);
});
test('dark grid, datum, paths and text preserve separate high contrast, history remains less opaque',()=>{
 const color=name=>html.match(new RegExp('--'+name+':(#[\\da-f]{6})(?:;|})','gi')).at(-1).match(/#[\da-f]{6}/i)[0];
 const panel=color('paper'),track=color('soft'),ink=color('ink'),path='#9bd0f5';
 assert.ok(contrast(ink,panel)>10);
 assert.ok(contrast(path,panel)>8);
 assert.ok(contrast('#73859a',track)>3);
 for(const tone of ['practice-green','practice-yellow','practice-red'])
   assert.ok(contrast(color(tone),track)>6,tone);
 assert.match(html,/\.scale-pitch-slot \.scale-pitch-history-dot::before\{opacity:max\(\.48,var\(--past-opacity,\.48\)\)}/);
 assert.match(html,/\.scale-pitch-dot\{[^}]*background:var\(--practice-tone\);z-index:2}/);
 assert.match(html,/\.scale-pitch-trend .trend-line\{stroke-width:2\.2}/);
 assert.match(html,/\.scale-pitch-trend :is\(\.scale-pitch-time-info,text\)\{color:var\(--ink\);fill:var\(--ink\)}/);
});
test('faded solid history fill is separate from its thin high-contrast same-hue edge',()=>{
 assert.match(html,/\.scale-pitch-history-dot\{border:1px solid var\(--practice-ink\);background:transparent}/);
 assert.match(html,/\.scale-pitch-history-dot::before\{[^}]*background:var\(--practice-tone\);opacity:var\(--past-opacity,\.36\)}/);
 assert.doesNotMatch(html,/\.scale-pitch-history-dot\{[^}]*opacity:/);
 assert.doesNotMatch(html,/\.scale-pitch-history-dot\{[^}]*dashed/);
 for(const [theme,lanes,edges] of [
  ['light',['#f2f6f0','#f8faf7'],['#327052','#81580c','#9a3321']],
  ['dark',['#292e36','#21252b'],['#b5e6bd','#ffe0a3','#f29a96']]
 ])for(const lane of lanes)for(const edge of edges)
    assert.ok(contrast(edge,lane)>=4.5,theme+' '+edge+' on '+lane+' ratio '+contrast(edge,lane).toFixed(2));
 assert.match(html,/\.scale-pitch-dot\{[^}]*background:var\(--practice-tone\);z-index:2}/);
});
class Node{
 constructor(tag){this.tag=tag;this.children=[];this.attrs={};this.dataset={};this.style={setProperty:(k,v)=>this.style[k]=v};this.scrollLeft=0;this.clientWidth=300;}
 append(...items){this.children.push(...items);}
 insertBefore(node,other){this.children.splice(this.children.indexOf(other),0,node);}
 setAttribute(k,v){this.attrs[k]=String(v);}
 addEventListener(){}
 set textContent(v){this.text=v;this.children=[];}
 get textContent(){return this.text||'';}
 find(fn){return fn(this)?this:this.children.map(c=>c.find(fn)).find(Boolean);}
}
const document={createElement:t=>new Node(t),createElementNS:(_,t)=>new Node(t),documentElement:new Node('html')};
const box={module:{exports:{}},document};
vm.runInNewContext(html.split('// SCALE_PRACTICE_START')[1].split('// SCALE_PRACTICE_END')[0],box);
const core=box.module.exports;
const pts=(key,value)=>[{ms:720,slot:0,lap:1,segment:1,[key]:value},{ms:768,slot:0,lap:1,segment:1,[key]:value+1}];
test('actual practice view keeps the same measured active, partial, restored and muted datum when appearance changes',()=>{
 const notes=[{midi:36,name:'C',octave:2},{midi:38,name:'D',octave:2},{midi:36,name:'C',octave:2}];
 const view=core.card({querySelectorAll:()=>notes.map(()=>new Node('g'))},notes,()=>{});
 view.element.showPracticeCharts(true);
 const pitch=()=>view.element.find(n=>n.dataset.chartTime==='pitch');
 const volume=()=>view.element.find(n=>n.dataset.chartTime==='volume');
 const dots=()=>view.element.find(n=>n.className==='scale-pitch-dot'&&n.hidden===false);
 const line=node=>node.find(n=>n.attrs.class==='trend-line').attrs.d;
 assert.equal(dots(),undefined);assert.equal(line(pitch()),'');assert.equal(line(volume()),'');
 const final={
   values:[6,null,null],history:[new Map([[-10,2],[-42,1]]),new Map([[46,1]]),new Map()],mode:'loop',final:true,
   trend:{data:pts('cents',6),reference:442},loudness:{points:pts('db',1)}
 };
 // With no RAF in the test realm the live view renders on its actual update.
 view.update('listening',null,null,1,442,{...final,listening:true,final:false,
   live:{slot:0,cents:7},chartClock:{elapsed:()=>1100,read:()=>final}});
 assert.equal(pitch().dataset.live,'true');assert.match(line(pitch()),/^M/);assert.match(line(volume()),/^M/);
 for(const appearance of ['light','dark']){
   document.documentElement.dataset.appearance=appearance;
   view.update('idle',null,null,0,442,final);
   assert.equal(dots().dataset.band,'center');
   assert.equal(view.element.find(n=>n.className==='scale-pitch-history-dot').dataset.band,'center');
   const grid=view.element.find(n=>n.className==='scale-pitch-columns');
   for(const i of [0,1]){
     const red=grid.children[i].find(n=>n.className==='scale-pitch-history-dot'&&n.dataset.band==='outside');
     assert.ok(red,'real single historic red point present on alternating lane '+i);
     assert.equal(red.style['--past-opacity'],.34);
   }
   assert.match(view.element.find(n=>n.className==='scale-pitch-legend').textContent,/實色：本次 · 淡色：累積/);
   assert.match(line(pitch()),/^M/);assert.match(line(volume()),/^M/);
 }
 // The restored old note graph is valid, while a muted/unavailable volume must
 // stay blank, not be rendered as 0 dB; normalized draft provenance is checked elsewhere.
 view.update('idle',null,null,0,442,{values:[6,null,null],final:true,restored:true});
 assert.equal(dots().dataset.band,'center');
 assert.equal(line(pitch()),'');assert.equal(line(volume()),'');
});
test('expanded dark card reins in the decorative seam without changing chart guides',()=>{
 assert.match(html,/\.fingering-section\{[^}]*border-top:1px solid #e9ece7/);
 assert.match(html,/\[data-appearance=dark\] \.key-card\.is-expanded\{--expanded-card-divider:#39424d}/);
 assert.match(html,/\[data-appearance=dark\] \.key-card\.is-expanded>\.fingering-section,\s*\[data-appearance=dark\] \.key-card\.is-expanded \.cello-fb-sequence\{border-top-color:var\(--expanded-card-divider\)}/);
 assert.ok(contrast('#39424d','#21252b')<1.7);
 assert.match(html,/\.scale-pitch-trend \.trend-guide\{stroke:#73859a}/);
});
