const{JSDOM}=require(process.env.JSDOM_MODULE||'jsdom'),fs=require('fs'),vm=require('vm'),a=require('node:assert/strict');
const dom=new JSDOM('',{runScripts:'outside-only'}),w=dom.window;for(const f of['fingerboard.js','fingering-presets.js','fingerboard-editor.js'])w.eval(fs.readFileSync(f,'utf8'));
const F=w.CelloFingerboard,h=fs.readFileSync('index.html','utf8'),lists=[['major','MAJOR_KEYS'],['minor','MINOR_KEYS']].map(([m,n])=>[m,vm.runInNewContext(h.match(new RegExp('const '+n+' = (\\[[\\s\\S]*?\\n    \\]);'))[1])]);let count=0;
for(const[m,keys]of lists)for(const k of keys)for(const[o,arp]of[[1,false],[2,false],[2,true]])for(const d of['up','down'])for(const reverse of[false,true]){
 const chart=F.chartSVG(m,k,d,o,{},null,[],reverse,arp),marks=chart.querySelectorAll('.cello-harmonic-mark'),expected=k[0]==='A'&&o===2;
 a.equal(marks.length,expected?1:0);if(expected){const marker=marks[0],point=marker.parentElement,label=[...point.querySelectorAll('text')].find(t=>t.textContent==='A');a.ok(label);a.ok(+marker.getAttribute('cy')<+label.getAttribute('y'));a.match(point.querySelector('title').textContent,/自然泛音.*第3指/);a.doesNotMatch(point.querySelector('title').textContent,/把位/);a.equal(marker.getAttribute('fill'),'none');
  const changed=F.chartSVG(m,k,d,o,{upMap:JSON.stringify({69:{s:3,f:2}}),downMap:JSON.stringify({69:{s:3,f:2}})},null,[],reverse,arp);a.equal(changed.querySelectorAll('.cello-harmonic-mark').length,0);
 }count++;
}
for(const[m,keys]of lists){const k=keys.find(k=>k[0]==='A'),editor=F.createEditor(m,k).element;a.equal(editor.querySelectorAll('.cello-harmonic-mark').length,1);const board=F.create(m,k,{});for(const score of board.querySelectorAll('.cello-scale-score'))a.equal(score.querySelectorAll('.cello-harmonic-mark').length,0);}
const cm=lists[1][1].find(k=>k[0]==='C'),chart=F.chartSVG('minor',cm,'down',2),cue=chart.querySelector('.cello-shift-cue'),circle=cue.parentElement.querySelector('circle'),finger=cue.parentElement.querySelector('text');
a.equal(finger.textContent,'4');a.equal(cue.textContent,'↑');a.ok(+cue.getAttribute('x')>+finger.getAttribute('x'));a.ok(+cue.getAttribute('x')<+circle.getAttribute('cx')+ +circle.getAttribute('r'));a.equal(cue.getAttribute('fill'),'#ffffff');
const editor=F.createEditor('minor',cm,{},'down').element,teacherCue=editor.querySelector('.cello-shift-cue');a.equal(teacherCue.parentElement.querySelector('text').textContent,'4');a.equal(teacherCue.textContent,'↑');
console.log('PASS '+count+' harmonic scope/string-order DOM cases, custom suppression, teacher marks, no staff marks, and inside4↑');dom.window.close();
