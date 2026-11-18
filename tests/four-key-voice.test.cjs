const test=require('node:test'),a=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),crypto=require('crypto');
const c={window:{}};vm.createContext(c);for(const f of ['fingerboard.js','fingering-presets.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c);
const O=c.window.CelloFingeringOptimizer,F=c.window.CelloFingerboard,h=fs.readFileSync('index.html','utf8'),lists={};for(const[m,n]of[['major','MAJOR_KEYS'],['minor','MINOR_KEYS']])lists[m]=vm.runInNewContext(h.match(new RegExp('const '+n+' = (\\[[\\s\\S]*?\\n    \\]);'))[1]);
const get=(m,k,d='up',ar=false)=>O.route(m,lists[m].find(q=>q[0]===k),d,2,ar),asc=r=>r.slice().sort((a,b)=>a.midi-b.midi),digits=(r,s)=>asc(r).filter(p=>s===undefined||p.s===s).map(p=>p.f).join(''),midi=(r,s)=>Array.from(asc(r).filter(p=>p.s===s),p=>p.midi),plain=x=>JSON.parse(JSON.stringify(x));
test('C-sharp minor separate scale directions, unused A, B-sharp spelling, arpeggio C14/A2',()=>{
 const up=get('minor','C♯'),down=get('minor','C♯','down'),arp=get('minor','C♯','up',true);
 a.equal(digits(up,0),'134124');a.equal(digits(up,2),'124134');a.equal(digits(up,3),'');a.deepEqual(midi(up,2),[52,54,56,58,60,61]);
 a.equal(digits(down,0),'134134');a.equal(digits(down,1),'124');a.equal(digits(down,2),'124124');a.equal(digits(down,3),'');
 a.deepEqual(midi(down,0),[37,39,40,42,44,45]);a.deepEqual(midi(down,1),[47,49,51]);a.deepEqual(midi(down,2),[52,54,56,57,59,61]);
 a.ok(lists.minor.find(k=>k[0]==='C♯')[2].includes('B♯'));
 a.equal(digits(arp,0),'14');a.equal(digits(arp,3),'2');a.deepEqual(plain(get('minor','C♯','down',true)),plain([...arp].reverse()));
});
test('B-major scale D124124/A124123 moves exactly the first three A notes',()=>{
 for(const d of ['up','down']){const r=get('major','B',d);a.equal(digits(r,2),'124124');a.equal(digits(r,3),'124123');a.deepEqual(midi(r,2),[52,54,56,58,59,61]);a.deepEqual(midi(r,3),[63,64,66,68,70,71]);}
});
test('G-sharp minor low-to-high direction-specific fingers and string transfers',()=>{
 const up=get('minor','G♯'),down=get('minor','G♯','down');
 a.equal(digits(up),'134124124124134');a.deepEqual(midi(up,1),[44,46,47,49,51,53]);a.deepEqual(midi(up,2),[55,56,58,59,61,63]);a.deepEqual(midi(up,3),[65,67,68]);
 a.equal(digits(down),'134134124124124');a.deepEqual(midi(down,1),[44,46,47,49,51,52]);a.deepEqual(midi(down,2),[54,56,58,59,61,63]);a.deepEqual(midi(down,3),[64,66,68]);
});
test('F-sharp major arpeggio4142142 keeps original strings and pitch order',()=>{
 const up=get('major','F♯','up',true);a.equal(digits(up),'4142142');a.deepEqual(Array.from(up,p=>p.s),[0,1,1,2,3,3,3]);a.deepEqual(Array.from(up,p=>p.midi),[42,46,49,54,58,61,66]);a.deepEqual(plain(get('major','F♯','down',true)),plain([...up].reverse()));
});
test('144 routes: targeted changes only, exact pitches, physical contact frames and legal transitions',()=>{
 const hash=r=>crypto.createHash('sha256').update(JSON.stringify(r)).digest('hex');let changed=0;
 for(const[id,expected]of JSON.parse(fs.readFileSync('tests/fixtures/routes-006.json'))){
  const[m,k,oct,ar,d]=id.split('|'),o=Number(oct),arp=ar==='true',key=lists[m].find(q=>q[0]===k),r=O.route(m,key,d,o,arp);
  const target=o===2&&((m==='minor'&&(k==='C♯'||k==='G♯'))||(m==='major'&&(k==='B'||k==='F♯'&&arp)));
  if(target){a.notEqual(hash(r),expected,id);changed++;}else a.equal(hash(r),expected,id+' must not change');
  const notes=arp?F.arpeggioNotes(m,key,d):F.scaleNotes(m,key,d,o);a.deepEqual(Array.from(r,p=>p.midi),Array.from(notes,p=>p.midi));
  for(const[pIndex,p]of r.entries()){if(p.f&&p.technique!=='naturalHarmonic')a.equal(p.midi,[36,43,50,57][p.s]+p.anchor+O.SHAPES[p.shape][p.f-1],id+' pitch');if(pIndex)a.ok(O.movementStep(r[pIndex-1],p,d),id+' transition');}
  a.equal(O.movementMetrics(r).stretched134,0,id);a.equal(O.movementMetrics(r).mixed134,0,id);
 }
 a.equal(changed,14);
});

test('B-major arpeggio4142143 moves only lower B3 to D with the same second finger',()=>{
 const up=get('major','B','up',true),down=get('major','B','down',true);
 a.equal(digits(up),'4142143');a.deepEqual(Array.from(up,p=>p.midi),[47,51,54,59,63,66,71]);
 a.deepEqual(Array.from(up,p=>p.s),[1,2,2,2,3,3,3]);a.equal(digits(up,0),'');
 a.equal(up.find(p=>p.midi===59).f,2);a.equal(up.find(p=>p.midi===59).anchor,8);a.equal(up.find(p=>p.midi===59).shape,'normal');
 a.equal(up.at(-1).midi,71);a.equal(up.at(-1).s,3);a.equal(up.at(-1).f,3);
 a.deepEqual(plain(down),plain([...up].reverse()));
});
test('confirmed G-sharp minor arpeggio1414144 moves B3/D-sharp4 to D, not apex',()=>{
 const up=get('minor','G♯','up',true),down=get('minor','G♯','down',true);
 a.equal(digits(up),'1414144');a.deepEqual(Array.from(up,p=>p.midi),[44,47,51,56,59,63,68]);
 a.deepEqual(midi(up,1),[44,47]);a.deepEqual(midi(up,2),[51,56,59,63]);a.deepEqual(midi(up,3),[68]);
 a.equal(up.at(-1).s,3);a.equal(up.at(-1).f,4);a.deepEqual(plain(down),plain([...up].reverse()));
});
