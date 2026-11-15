const {JSDOM}=require(process.env.JSDOM_MODULE||'jsdom'),fs=require('fs'),vm=require('vm'),a=require('assert/strict');
const dom=new JSDOM('',{runScripts:'outside-only'}),w=dom.window;
for(const f of ['fingerboard.js','fingering-presets.js','fingerboard-editor.js'])w.eval(fs.readFileSync(f,'utf8'));
const F=w.CelloFingerboard,O=w.CelloFingeringOptimizer,html=fs.readFileSync('index.html','utf8');
const labels=svg=>[...svg.querySelectorAll('g>title')].map(t=>t.textContent.split('；')[0].replace(/^第\d+音 /,''));
let cases=0;
for(const [mode,name] of [['major','MAJOR_KEYS'],['minor','MINOR_KEYS']]){
 const keys=vm.runInNewContext(html.match(new RegExp('const '+name+' = (\\[[\\s\\S]*?\\n    \\]);'))[1]);
 for(const key of keys){
  for(const oct of [1,2])for(const reverse of [false,true])for(const arp of [false,true]){
   const up=F.chartSVG(mode,key,'up',oct,{},null,[],reverse,arp);
   const notes=arp?F.arpeggioNotes(mode,key,'up'):F.scaleNotes(mode,key,'up',oct);
   const expected=O.route(mode,key,'up',arp?2:oct,arp);
   a.equal(labels(up).length,notes.length);expected.forEach((p,i)=>a.ok(labels(up)[i].includes(F.pointStyling(F.notePlacement(p.midi,{},Object.fromEntries(expected.map(q=>[q.midi,q])))).label)));
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
const diagram=F.chartSVG('minor',cm,'up',2),points=markers(diagram),firstColor=F.POSITION_COLORS['position-2'];
a.equal(points[8].querySelector('circle').getAttribute('stroke'),'#34483a');
a.equal(points[8].querySelector('circle').getAttribute('fill'),'#f7f9f6');
a.doesNotMatch(points[8].querySelector('title').textContent,/把位/);
a.equal(points[8].querySelector('text').textContent,'0');
for(const i of [9,10,11]){a.equal(points[i].querySelector('circle').getAttribute('fill'),firstColor);a.equal(points[i].querySelector('circle').getAttribute('stroke-dasharray'),'3 2');}
for(const i of [1,5,7,13,14]){a.equal(points[i].querySelector('circle').getAttribute('fill'),firstColor);a.equal(points[i].querySelector('circle').getAttribute('stroke-dasharray'),'none');}
a.equal(points[12].querySelector('circle').getAttribute('stroke-dasharray'),'none');
a.match(F.makeLegend().textContent,/擴增：沿用基準把位色/);
const customPoints=markers(F.chartSVG('minor',cm,'up',2,{upMap:JSON.stringify({53:{s:2,f:3}})}));
a.equal(customPoints[10].querySelector('circle').getAttribute('fill'),F.POSITION_COLORS.custom);
a.doesNotMatch(customPoints[10].querySelector('title').textContent,/擴增把位/);
const teacher=F.createEditor('minor',cm).element.querySelectorAll('.teacher-note-marker');
a.equal(teacher[8].querySelector('circle').getAttribute('stroke'),'#34483a');
a.equal(teacher[8].querySelector('text').textContent,'0');
a.equal(teacher[10].querySelector('circle').getAttribute('fill'),firstColor);a.equal(teacher[10].querySelector('circle').getAttribute('stroke-dasharray'),'3 2');
const descent=F.chartSVG('minor',cm,'down',2),descending=markers(descent);
a.equal(descent.querySelectorAll('.cello-shift-cue').length,1);
a.equal(descending[2].querySelector('text').textContent,'4');
a.equal(descending[2].querySelector('.cello-shift-cue').textContent,'↑');
a.match(descending[2].querySelector('.cello-shift-cue').getAttribute('aria-label'),/弦枕.*半音.*音高.*降/);
a.equal(descending[3].querySelector('text').textContent,'4');
a.equal(descending[2].querySelector('circle').getAttribute('stroke-dasharray'),'none');
for(const i of [3,4,5]){a.equal(descending[i].querySelector('circle').getAttribute('fill'),firstColor);a.equal(descending[i].querySelector('circle').getAttribute('stroke-dasharray'),'3 2');}
a.equal(descending[6].querySelector('circle').getAttribute('stroke'),'#34483a');
for(const map of [{56:{s:2,f:3}},{55:{s:2,f:3}}]){
 const changed=F.chartSVG('minor',cm,'down',2,{downMap:JSON.stringify(map)});
 a.equal(changed.querySelectorAll('.cello-shift-cue').length,0);
}
for(const [dir,oct,arp] of [['up',2,false],['down',1,false],['down',2,true]])
 a.equal(F.chartSVG('minor',cm,dir,oct,{},null,[],false,arp).querySelectorAll('.cello-shift-cue').length,0);
const fsharp=['F♯',3,'F♯ G♯ A B C♯ D♯ E♯ F♯','F♯ G♯ A B C♯ D E F♯'];
for(const dir of ['up','down']){
 const chart=F.chartSVG('minor',fsharp,dir,2,{},null,[],false,true),cue=chart.querySelector('.cello-shift-cue');
 a.equal(chart.querySelectorAll('.cello-shift-cue').length,1);a.equal(cue.textContent,'換把半音');
 a.match(cue.getAttribute('aria-label'),dir==='up'?/向琴橋/:/向弦枕/);
 a.match(cue.getAttribute('aria-label'),/五半音.*不是同一固定擴增/);
 const changed=F.chartSVG('minor',fsharp,dir,2,{upMap:JSON.stringify({66:{s:3,f:3}})},null,[],false,true);
 a.equal(changed.querySelectorAll('.cello-shift-cue').length,0);
}
// Legacy fallback retains symmetric arpeggios too, without optimizer loaded.
const optimizer=w.CelloFingeringOptimizer;delete w.CelloFingeringOptimizer;
const minor=['E',1,'E F♯ G A B C♯ D♯ E','E F♯ G A B C D E'];
a.deepEqual(labels(F.chartSVG('minor',minor,'down',2,{},null,[],false,true)),labels(F.chartSVG('minor',minor,'up',2,{},null,[],false,true)).reverse());
w.CelloFingeringOptimizer=optimizer;
console.log(`PASS ${cases} rendered scale/arp/octave/string-order cases, custom symmetry, extension segment/open coloring, safe teacher major editing and fallback.`);
// Reviewed12124: only the preceding D-sharp/E-sharp segment retains extension border.
const fsUp=markers(F.chartSVG('minor',fsharp,'up',2)),fsDown=markers(F.chartSVG('minor',fsharp,'down',2));
for(const i of[12,13])a.equal(fsUp[i].querySelector('circle').getAttribute('stroke-dasharray'),'3 2');
for(const p of[fsUp[14],fsDown[0],fsDown[1]]){
 a.equal(p.querySelector('circle').getAttribute('stroke-dasharray'),'none');a.doesNotMatch(p.querySelector('title').textContent,/擴增/);
}
const fsTeacher=F.createEditor('minor',fsharp).element.querySelectorAll('.teacher-note-marker');
a.equal(fsTeacher[14].querySelector('circle').getAttribute('stroke-dasharray'),'none');

dom.window.close();
