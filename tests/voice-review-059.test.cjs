const test=require('node:test'),a=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),crypto=require('crypto');
const c={window:{}};vm.createContext(c);for(const f of['fingerboard.js','fingering-presets.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c);
const O=c.window.CelloFingeringOptimizer,h=fs.readFileSync('index.html','utf8'),lists={};for(const[m,n]of[['major','MAJOR_KEYS'],['minor','MINOR_KEYS']])lists[m]=vm.runInNewContext(h.match(new RegExp('const '+n+' = (\\[[\\s\\S]*?\\n    \\]);'))[1]);
const get=(m,k,d='up',arp=false)=>O.route(m,lists[m].find(q=>q[0]===k),d,2,arp);
const digits=(r,s)=>r.filter(p=>p.s===s).sort((a,b)=>a.midi-b.midi).map(p=>p.f).join('');
const plain=x=>JSON.parse(JSON.stringify(x));
test('spoken major string digits, moved B-flat, and arpeggio endpoints match',()=>{
 a.equal(get('major','F','up',true).at(-1).f,2);
 a.equal(digits(get('major','B♭'),3),'012412123');a.equal(digits(get('major','B♭','up',true),3),'1143');
 const eb=get('major','E♭');a.equal(digits(eb,2),'012124');a.equal(digits(eb,3),'134');a.equal(eb.find(p=>p.midi===58).s,2);
 a.equal(get('major','E♭','up',true).at(-1).f,2);
});
test('F-sharp melodic/natural directions are distinct; lower C and arp C-sharp moves are exact',()=>{
 const up=get('minor','F♯'),down=get('minor','F♯','down'),arp=get('minor','F♯','up',true);
 a.equal(digits(up,3),'013134');a.equal(digits(down,3),'013124');a.equal(digits(down,0),'13');
 a.deepEqual(plain([up.at(-1).midi,up.at(-1).s,up.at(-1).f]),plain([down[0].midi,down[0].s,down[0].f]));
 a.equal(digits(arp,2),'214');a.equal(digits(arp,3),'2');a.equal(arp.find(p=>p.midi===61).s,2);
 a.ok(arp.every(p=>!p.shiftCue));a.deepEqual(plain(get('minor','F♯','down',true)),plain([...arp].reverse()));
});
test('all historical058 full routes remain exact and126 untouched current routes unchanged',()=>{
 const hash=r=>crypto.createHash('sha256').update(JSON.stringify(r)).digest('hex');let unchanged=0,changed=0;
 for(const[id,expected]of JSON.parse(fs.readFileSync('tests/fixtures/routes-058.json'))){
  const[m,k,o,arp,d]=id.split('|'),key=lists[m].find(q=>q[0]===k),ar=arp==='true',oct=Number(o);
  a.equal(hash(O.route(m,key,d,oct,ar,'reviewed-058')),expected,id+' historical');
  const target=oct===2&&((m==='major'&&((['F','A'].includes(k)&&ar)||(k==='E'&&!ar)||k==='B♭'||k==='E♭'))||(m==='minor'&&k==='F♯'));
  const now=O.route(m,key,d,oct,ar);
  if(!target){a.equal(hash(now),expected,id+' untouched');unchanged++;}else{a.notEqual(hash(now),expected,id+' requested');changed++;}
  const notes=ar?c.window.CelloFingerboard.arpeggioNotes(m,key,d):c.window.CelloFingerboard.scaleNotes(m,key,d,oct);
  a.deepEqual(Array.from(now,p=>p.midi),Array.from(notes,p=>p.midi));
  for(const p of now){if(p.technique==='naturalHarmonic'||!p.f)continue;const offsets={normal:[0,1,2,3],extended:[0,2,3,4],backwardExtended:[-1,1,2,3]};a.equal(p.midi,[36,43,50,57][p.s]+p.anchor+offsets[p.shape][p.f-1]);}
 }
 a.equal(unchanged,126);a.equal(changed,18);
});

test('A-major arpeggio0143 only; scale, lower strings and A harmonic preserved',()=>{
 const key=lists.major.find(k=>k[0]==='A');
 for(const d of ['up','down']){
  const before=O.route('major',key,d,2,true,'reviewed-058'),after=get('major','A',d,true);
  a.equal(digits(after,3),'0143');
  for(const p of after){
   const old=before.find(q=>q.midi===p.midi);
   if([61,64].includes(p.midi)){a.equal(p.s,3);a.equal(p.f,p.midi===61?1:4);a.equal(p.anchor,4);a.equal(p.shape,'normal');}
   else a.deepEqual(plain(p),plain(old));
  }
  for(const o of [1,2])a.deepEqual(plain(O.route('major',key,d,o,false)),plain(O.route('major',key,d,o,false,'reviewed-058')));
 }
 a.deepEqual(plain(get('major','A','down',true)),plain(get('major','A','up',true).reverse()));
});

test('E-flat arpeggio D-string114 and only top E-flat2 on A; pitch and reverse exact',()=>{
 const up=get('major','E♭','up',true),down=get('major','E♭','down',true);
 a.equal(digits(up,2),'114');a.equal(digits(up,3),'2');
 a.deepEqual(Array.from(up,p=>p.midi),[39,43,46,51,55,58,63]);
 for(const midi of [55,58]){const p=up.find(p=>p.midi===midi);a.equal(p.s,2);a.equal(p.f,midi===55?1:4);a.equal(p.anchor,5);a.equal(p.shape,'normal');}
 const low=up.find(p=>p.midi===51);a.equal(low.s,2);a.equal(low.f,1);
 const open=up.find(p=>p.midi===43);a.equal(open.s,1);a.equal(open.f,0);
 a.equal(up.at(-1).midi,63);a.equal(up.at(-1).f,2);
 a.deepEqual(plain(down),plain([...up].reverse()));
});

test('E-major scale D-string124124 moves A3/B3 and leaves A-string134, arpeggio unchanged',()=>{
 const key=lists.major.find(k=>k[0]==='E'),up=get('major','E'),down=get('major','E','down');
 a.equal(digits(up,2),'124124');a.equal(digits(up,3),'134');
 a.deepEqual(Array.from(up.filter(p=>p.s===2),p=>p.midi),[51,52,54,56,57,59]);
 a.deepEqual(Array.from(up.filter(p=>p.s===3),p=>p.midi),[61,63,64]);
 a.ok(up.every(p=>!p.shiftCue));a.ok(down.every(p=>!p.shiftCue));
 a.deepEqual(plain(down),plain([...up].reverse()));
 for(const d of ['up','down']){
  a.deepEqual(plain(get('major','E',d,true)),plain(O.route('major',key,d,2,true,'reviewed-058')));
  a.deepEqual(plain(O.route('major',key,d,1,false)),plain(O.route('major',key,d,1,false,'reviewed-058')));
 }
});
