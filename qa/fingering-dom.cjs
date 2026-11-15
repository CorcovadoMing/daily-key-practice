const {JSDOM}=require(process.env.JSDOM_MODULE||'jsdom'),fs=require('fs'),vm=require('vm'),a=require('assert/strict');
const dom=new JSDOM('',{runScripts:'outside-only'}),w=dom.window;
for(const f of ['fingerboard.js','fingering-presets.js','fingerboard-editor.js'])w.eval(fs.readFileSync(f,'utf8'));
const F=w.CelloFingerboard,O=w.CelloFingeringOptimizer,html=fs.readFileSync('index.html','utf8');
const labels=svg=>[...svg.querySelectorAll('g>title')].map(t=>t.textContent.replace(/^第\d+音 /,''));
let cases=0;
for(const [mode,name] of [['major','MAJOR_KEYS'],['minor','MINOR_KEYS']]){
 const keys=vm.runInNewContext(html.match(new RegExp('const '+name+' = (\\[[\\s\\S]*?\\n    \\]);'))[1]);
 for(const key of keys){
  for(const oct of [1,2])for(const reverse of [false,true])for(const arp of [false,true]){
   const up=F.chartSVG(mode,key,'up',oct,{},null,[],reverse,arp);
   const notes=arp?F.arpeggioNotes(mode,key,'up'):F.scaleNotes(mode,key,'up',oct);
   const expected=O.route(mode,key,'up',arp?2:oct,arp);
   a.equal(labels(up).length,notes.length);expected.forEach((p,i)=>a.ok(labels(up)[i].includes(p.positionLabel)));
   const n=notes[1],p=expected[1],annotations={upMap:JSON.stringify({[n.midi]:{s:p.s,f:4}}),downMap:JSON.stringify({[n.midi]:{s:p.s,f:1}})};
   if(mode==='major'||arp){
    a.deepEqual(labels(F.chartSVG(mode,key,'down',oct,annotations,null,[],reverse,arp)),
      labels(F.chartSVG(mode,key,'up',oct,annotations,null,[],reverse,arp)).reverse());
   }
   cases++;
  }
  const n=F.scaleNotes(mode,key,'up',2)[1],p=O.route(mode,key,'up')[1],original={upMap:JSON.stringify({[n.midi]:{s:p.s,f:4}}),downMap:JSON.stringify({[n.midi]:{s:p.s,f:1}})};
  const editor=F.createEditor(mode,key,original,'down');
  if(mode==='major'){
   a.equal(editor.element.querySelector('.teacher-tools .cello-fb-group')?.textContent.includes('下行'),false);
   a.equal(editor.getValue().downMap,original.downMap);
   // A reset affects the visible canonical up route only, not old down data.
   editor.element.querySelector('.teacher-reset').click();a.equal(editor.getValue().upMap,'');a.equal(editor.getValue().downMap,original.downMap);
  }
 }
}
// Legacy fallback retains symmetric arpeggios too, without optimizer loaded.
const optimizer=w.CelloFingeringOptimizer;delete w.CelloFingeringOptimizer;
const minor=['E',1,'E F♯ G A B C♯ D♯ E','E F♯ G A B C D E'];
a.deepEqual(labels(F.chartSVG('minor',minor,'down',2,{},null,[],false,true)),labels(F.chartSVG('minor',minor,'up',2,{},null,[],false,true)).reverse());
w.CelloFingeringOptimizer=optimizer;
console.log(`PASS ${cases} rendered scale/arp/octave/string-order cases, custom symmetry, safe teacher major editing and fallback.`);dom.window.close();
