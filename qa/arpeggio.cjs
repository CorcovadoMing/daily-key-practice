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
  a.equal(arp.querySelectorAll('.cello-fb-svg').length,2);
  a.equal(arp.querySelectorAll('button').length,0);
  const mids=[...score.querySelectorAll('[data-midi]')].map(n=>Number(n.dataset.midi));
  a.equal(Math.max(...mids)-Math.min(...mids),24);
  const notes=F.arpeggioNotes(mode,key,'up'),n=notes[1],p=F.positionFor(n.midi);
  const annotation={upMap:JSON.stringify({[n.midi]:{s:p.string,f:4}})};
  board.updateAnnotations(annotation);
  const actual=arp.querySelector('.cello-fb-viewport').innerHTML;
  const expected=F.chartSVG(mode,key,'up',2,annotation,null,[],false,true).outerHTML;
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
