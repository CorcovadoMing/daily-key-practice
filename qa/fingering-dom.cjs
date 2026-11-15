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
// Whole-segment coloring includes stopped fingers only, never open0 or adjacent
// strings or unvalidated custom finger overrides.
const cm=['C',-3,'C D E♭ F G A B C','C D E♭ F G A♭ B♭ C'];
const markers=svg=>[...svg.querySelectorAll('g')].filter(g=>g.querySelector(':scope > title'));
const diagram=F.chartSVG('minor',cm,'up',2),points=markers(diagram),orange=F.POSITION_COLORS.extended;
a.equal(points[8].querySelector('circle').getAttribute('stroke'),'#34483a');
a.equal(points[8].querySelector('circle').getAttribute('fill'),'#f7f9f6');
a.doesNotMatch(points[8].querySelector('title').textContent,/把位/);
a.equal(points[8].querySelector('text').textContent,'0');
for(const i of [9,10,11])a.equal(points[i].querySelector('circle').getAttribute('fill'),orange);
for(const i of [1,5,7,13,14])a.notEqual(points[i].querySelector('circle').getAttribute('fill'),orange);
a.notEqual(points[12].querySelector('circle').getAttribute('stroke'),orange);
a.match(F.makeLegend().textContent,/擴增把位區段（不含空弦）/);
const customPoints=markers(F.chartSVG('minor',cm,'up',2,{upMap:JSON.stringify({53:{s:2,f:3}})}));
a.equal(customPoints[10].querySelector('circle').getAttribute('fill'),F.POSITION_COLORS.custom);
a.doesNotMatch(customPoints[10].querySelector('title').textContent,/擴增把位/);
const teacher=F.createEditor('minor',cm).element.querySelectorAll('.teacher-note-marker');
a.equal(teacher[8].querySelector('circle').getAttribute('stroke'),'#34483a');
a.equal(teacher[8].querySelector('text').textContent,'0');
a.equal(teacher[10].querySelector('circle').getAttribute('fill'),orange);
const descent=F.chartSVG('minor',cm,'down',2),descending=markers(descent);
a.equal(descent.querySelectorAll('.cello-shift-cue').length,1);
a.equal(descending[2].querySelector('text').textContent,'4');
a.equal(descending[2].querySelector('.cello-shift-cue').textContent,'（↑）');
a.match(descending[2].querySelector('.cello-shift-cue').getAttribute('aria-label'),/弦枕.*半音.*音高.*降/);
a.equal(descending[3].querySelector('text').textContent,'4');
a.notEqual(descending[2].querySelector('circle').getAttribute('fill'),orange);
for(const i of [3,4,5])a.equal(descending[i].querySelector('circle').getAttribute('fill'),orange);
a.equal(descending[6].querySelector('circle').getAttribute('stroke'),'#34483a');
for(const map of [{56:{s:2,f:3}},{55:{s:2,f:3}}]){
 const changed=F.chartSVG('minor',cm,'down',2,{downMap:JSON.stringify(map)});
 a.equal(changed.querySelectorAll('.cello-shift-cue').length,0);
}
for(const [dir,oct,arp] of [['up',2,false],['down',1,false],['down',2,true]])
 a.equal(F.chartSVG('minor',cm,dir,oct,{},null,[],false,arp).querySelectorAll('.cello-shift-cue').length,0);
// Legacy fallback retains symmetric arpeggios too, without optimizer loaded.
const optimizer=w.CelloFingeringOptimizer;delete w.CelloFingeringOptimizer;
const minor=['E',1,'E F♯ G A B C♯ D♯ E','E F♯ G A B C D E'];
a.deepEqual(labels(F.chartSVG('minor',minor,'down',2,{},null,[],false,true)),labels(F.chartSVG('minor',minor,'up',2,{},null,[],false,true)).reverse());
w.CelloFingeringOptimizer=optimizer;
console.log(`PASS ${cases} rendered scale/arp/octave/string-order cases, custom symmetry, extension segment/open coloring, safe teacher major editing and fallback.`);dom.window.close();
