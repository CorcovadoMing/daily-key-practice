const {JSDOM}=require(process.env.JSDOM_MODULE||'jsdom'),fs=require('fs'),vm=require('vm'),a=require('assert/strict');
const dom=new JSDOM('',{runScripts:'outside-only'}),w=dom.window;
for(const file of ['fingerboard.js','fingering-presets.js'])w.eval(fs.readFileSync(file,'utf8'));
const F=w.CelloFingerboard,html=fs.readFileSync('index.html','utf8');
for(const [mode,name] of [['major','MAJOR_KEYS'],['minor','MINOR_KEYS']]){
 const keys=vm.runInNewContext(html.match(new RegExp('const '+name+' = (\\[[\\s\\S]*?\\n    \\]);'))[1]);
 for(const key of keys){
  const board=F.create(mode,key);w.document.body.append(board);
  const arp=board.querySelector('.arpeggio-section'),score=arp.querySelector('.cello-scale-score');
  a.equal(score.tabIndex,0);a.equal(score.querySelectorAll('[data-midi]').length,13);
  a.equal(arp.querySelectorAll('.cello-fb-svg').length,1);
  a.equal(score.querySelectorAll('.scale-beam').length,0);
  a.equal(score.querySelectorAll('.scale-stem').length,13);
  a.ok([...score.querySelectorAll('[data-duration]')].every(n=>n.dataset.duration==='4'));
  a.equal(board.querySelector('.score-section .scale-beam')!==null,true);
  a.equal(arp.querySelector('h4').textContent,'上下行相同');
  a.equal(arp.querySelectorAll('button').length,0);
  const mids=[...score.querySelectorAll('[data-midi]')].map(n=>Number(n.dataset.midi));
  a.equal(Math.max(...mids)-Math.min(...mids),24);
  const notes=F.arpeggioNotes(mode,key,'up'),n=notes[1],p=F.positionFor(n.midi);
  const annotation={upMap:JSON.stringify({[n.midi]:{s:p.string,f:4}})};
  board.updateAnnotations(annotation);
  // Contradictory saved down fingering must not affect arpeggio symmetry.
  const source={...annotation,downMap:JSON.stringify({[n.midi]:{s:p.string,f:1}})};
  const upChart=F.chartSVG(mode,key,'up',2,source,null,[],false,true);
  const downChart=F.chartSVG(mode,key,'down',2,source,null,[],false,true);
  const labels=svg=>[...svg.querySelectorAll('g>title')].map(t=>t.textContent.replace(/^第\d+音 /,''));
  a.deepEqual(labels(downChart),labels(upChart).reverse());
  const actual=arp.querySelector('.cello-fb-viewport').innerHTML;
  const expectedSVG=F.chartSVG(mode,key,'up',2,annotation,null,[],false,true);
  expectedSVG.setAttribute('aria-label',key[0]+(mode==='major'?'大調':'小調')+'琶音，兩個八度上下行相同指法，下行反向演奏');
  const expected=expectedSVG.outerHTML;
  a.equal(actual,expected);
  // Scale octave picker never truncates the fixed two-octave arpeggio.
  [...board.querySelectorAll('button')].find(b=>b.textContent==='1 八度').click();
  a.equal(score.querySelectorAll('[data-midi]').length,13);
  a.equal(arp.querySelector('.cello-fb-viewport').innerHTML,expected);
  board.remove();
 }
}
const c=['C',0,'C D E F G A B C'];
a.deepEqual([...F.makeScore('major',c,true).querySelectorAll('[data-note]')].map(n=>n.dataset.note),'C E G C E G C G E C G E C'.split(' '));
console.log('PASS 24 modes: 13-note rendered arpeggios, custom finger updates, fixed octave, no new controls; exact C major sequence');dom.window.close();
