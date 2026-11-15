const{JSDOM}=require(process.env.JSDOM_MODULE||'jsdom'),fs=require('fs'),vm=require('vm'),a=require('node:assert/strict');const dom=new JSDOM('',{runScripts:'outside-only'}),w=dom.window;for(const f of['fingerboard.js','fingering-presets.js','fingerboard-editor.js'])w.eval(fs.readFileSync(f,'utf8'));const F=w.CelloFingerboard,h=fs.readFileSync('index.html','utf8'),lists=[['major','MAJOR_KEYS'],['minor','MINOR_KEYS']].map(([m,n])=>[m,vm.runInNewContext(h.match(new RegExp('const '+n+' = (\\[[\\s\\S]*?\\n    \\]);'))[1])]);
function legendMatches(section){const points=[...section.querySelectorAll('[data-position-group]')],expected=new Set(points.map(p=>p.getAttribute('data-position-group')));if(points.some(p=>p.getAttribute('data-position-extended')==='true'))expected.add('extension-example');const actual=[...section.querySelectorAll('.cello-legend-dot')].map(p=>p.className.split(' ').at(-1));a.deepEqual(actual.sort(),[...expected].sort());}
let cases=0;for(const[m,ks]of lists)for(const k of ks){const board=F.create(m,k,{});for(const oct of[2,1]){if(oct===1)[...board.querySelectorAll('button')].find(b=>b.textContent==='1 八度').click();for(const section of board.querySelectorAll('.cello-fb-direction')){legendMatches(section);cases++;}}}
for(const name of['E','B']){const k=lists[1][1].find(k=>k[0]===name);for(const oct of[1,2]){const svg=F.chartSVG('minor',k,'up',oct),cue=svg.querySelector('.cello-shift-cue');a.equal(cue.textContent,'↓');a.equal(cue.parentElement.querySelector('text').textContent,'1');a.equal(cue.getAttribute('fill'),'#ffffff');const point=cue.parentElement;const next=point.nextElementSibling;a.equal(next.getAttribute('data-position-extended'),'false');a.equal(next.querySelector('circle').getAttribute('stroke-dasharray'),'none');a.notEqual(next.querySelector('circle').getAttribute('stroke-width'),'1.5');
 for(const e of svg.querySelectorAll('[data-position-extended="true"] > circle:first-of-type')){a.equal(e.getAttribute('stroke-width'),'1.5');a.equal(e.getAttribute('stroke-dasharray'),'none');}
}const editor=F.createEditor('minor',k).element;legendMatches(editor);a.equal(editor.querySelector('.cello-shift-cue').textContent,'↓');
 const midi=name==='E'?51:58,board=F.create('minor',k,{upMap:JSON.stringify({[midi]:{s:name==='E'?2:3,f:2}})});for(const section of board.querySelectorAll('.cello-fb-direction'))legendMatches(section);a.equal(board.querySelector('.cello-fb-direction').querySelectorAll('.cello-shift-cue[data-shift-to="'+(midi+1)+'"]').length,0);
}
for(const name of['A','E']){
 const k=lists[0][1].find(k=>k[0]===name),board=F.create('major',k,{up:'保留我的筆記'},()=>{}),sections=[...board.querySelectorAll('.cello-fb-direction')].slice(0,2);
 for(const label of['1 八度','2 八度']){[...board.querySelectorAll('button')].find(b=>b.textContent===label).click();a.equal(sections[0].hidden,false);a.equal(sections[1].hidden,true);a.match(sections[0].querySelector('h4').textContent.trim(),/^上下行相同/);}
 a.equal(board.querySelector('.fingering-note').textContent,'保留我的筆記');
 const shared={upMap:JSON.stringify({64:{s:3,f:3}}),downMap:JSON.stringify({64:{s:3,f:4}})};
 for(const d of['up','down']){const svg=F.chartSVG('major',k,d,2,shared),notes=F.scaleNotes('major',k,d,2),points=[...svg.querySelectorAll('[data-position-group]')],point=points[notes.findIndex(n=>n.midi===64)];a.equal(point.querySelector('text').textContent,'3');a.equal(point.getAttribute('data-position-group'),'custom');}
 const teacher=F.createEditor('major',k,shared,'down');a.equal(teacher.getValue().downMap,shared.downMap);
}

{
 const k=lists[0][1].find(k=>k[0]==='A'),saved=[],board=F.create('major',k,{},(...args)=>saved.push(args));
 [...board.querySelectorAll('button')].find(b=>b.textContent==='2 八度').click();
 board.querySelector('.cello-fb-note').dispatchEvent(new w.Event('click'));
 const editor=board.querySelector('.cello-inline-editor:not([hidden])');a.ok(editor);
 [...editor.querySelectorAll('.cello-inline-finger')].find(b=>b.textContent==='2').click();
 editor.querySelector('.cello-inline-save').click();a.equal(saved.length,1);a.equal(saved[0][0],'up');
 a.ok([...board.querySelectorAll('.cello-fb-direction')][1].querySelector('[data-position-group="custom"]'));
}
console.log('PASS '+cases+' route-specific legends across octave changes, teacher/custom legends, four down-arrow closures and thin solid borders');dom.window.close();
