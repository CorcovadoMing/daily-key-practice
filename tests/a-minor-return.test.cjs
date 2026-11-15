const test=require('node:test'),a=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),c={window:{}};vm.createContext(c);for(const f of['fingerboard.js','fingering-presets.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c);const current=c.window.CelloFingeringOptimizer,O={...current,route:(m,k,d,o=2,arp=false,policy='reviewed-053')=>current.route(m,k,d,o,arp,policy)},F=c.window.CelloFingerboard,h=fs.readFileSync('index.html','utf8'),lists=[['major','MAJOR_KEYS'],['minor','MINOR_KEYS']].map(([m,n])=>[m,vm.runInNewContext(h.match(new RegExp('const '+n+' = (\\[[\\s\\S]*?\\n    \\]);'))[1])]),key=lists[1][1].find(k=>k[0]==='A'),plain=x=>JSON.parse(JSON.stringify(x));
test('053 changes exactly three placements in one scale route plus two symmetric arpeggios; 131 untouched full objects plus two F-sharp cue-only changes',()=>{
 const archive=[];let changed=0;
 for(const[m,keys]of lists)for(const k of keys)for(const[o,arp]of[[1,false],[2,false],[2,true]])for(const d of['up','down']){
  const old=O.route(m,k,d,o,arp,'reviewed-052'),r=O.route(m,k,d,o,arp);archive.push([[m,k[0],o,arp,d].join('|'),old]);
  a.deepEqual(Array.from(r,p=>p.midi),Array.from(old,p=>p.midi));
  if(m==='minor'&&k[0]==='A'&&o===2&&!arp&&d==='down'){
   r.forEach((p,i)=>{if([67,65,64].includes(p.midi)){changed++;a.equal(p.s,3);a.equal(p.anchor,7);a.equal(p.shape,'normal');a.ok(!p.displayExtended);}else a.deepEqual(plain(p),plain(old[i]));});
  }else if(m==='minor'&&k[0]==='F♯'&&arp){const strip=xs=>plain(xs).map(({shiftCue,...p})=>p);a.deepEqual(strip(r),strip(old));for(const p of r.filter(p=>p.shiftCue)){a.equal(p.shiftCue.symbol,'換把');a.doesNotMatch(JSON.stringify(p.shiftCue),/半音/);a.match(p.shiftCue.description,d==='up'?/琴橋/:/弦枕/);}}else if(!(k[0]==='A'&&arp)&&!(m==='major'&&k[0]==='B♭'&&o===2&&!arp)&&!(m==='minor'&&k[0]==='E'&&!arp))a.deepEqual(plain(r),plain(old));
 }
 a.equal(changed,3);a.equal(require('crypto').createHash('sha256').update(JSON.stringify(archive)).digest('hex'),'0e5af7cefc3ce805e1a6ecf50c8aa09ffeca55ff75aafe4ecba727eaac047449');
});
test('natural descent exactly reverses ascending strings/fingers but not raised sixth/seventh pitches',()=>{
 const up=O.route('minor',key,'up',2),down=O.route('minor',key,'down',2);
 a.deepEqual(Array.from(down,p=>[p.s,p.f]),Array.from(up,p=>[p.s,p.f]).reverse());
 a.equal(down.filter(p=>p.s===3).map(p=>p.f).join(''),'34214210');
 a.deepEqual(Array.from(down,p=>p.midi),[69,67,65,64,62,60,59,57,55,53,52,50,48,47,45]);
 for(const p of down.slice(1,4)){a.deepEqual(Array.from(O.SHAPES[p.shape],n=>n+p.anchor),[7,8,9,10]);a.equal(p.midi-57,p.anchor+O.SHAPES[p.shape][p.f-1]);}
 a.deepEqual(plain(down[0]),plain(up.at(-1)));a.equal(down[0].technique,'naturalHarmonic');
 const refs=Object.fromEntries(down.map(p=>[p.midi,p]));for(const p of down.slice(1,4)){const pos=F.notePlacement(p.midi,{},refs),style=F.pointStyling(pos);a.equal(style.group,'position-7');a.equal(style.extended,false);a.match(style.label,/第四把位/);}
 for(const midi of[69,57,50])a.equal(F.notePlacement(midi,{},refs).anchor,undefined);
 const custom=F.notePlacement(67,{67:{s:3,f:1}},refs);a.equal(custom.finger,1);a.equal(custom.anchor,undefined);
 const m=O.movementMetrics(down),old=O.movementMetrics(O.route('minor',key,'down',2,false,'reviewed-052'));a.deepEqual([m.events,m.anchorShifts,m.travel],[old.events,old.anchorShifts,old.travel]);
});

test('A-major/minor arpeggios inherit exact ascending scale degrees and reverse, including harmonic',()=>{
 for(const[m,keys]of lists){const k=keys.find(k=>k[0]==='A'),scale=O.route(m,k,'up',2),up=O.route(m,k,'up',2,true),down=O.route(m,k,'down',2,true);
  a.equal(up.map(p=>p.f).join(''),m==='major'?'1410313':'1410213');
  const fields=['midi','s','f','anchor','shape','technique','harmonic'],physical=p=>Object.fromEntries(fields.map(f=>[f,p[f]]));
  for(const p of up)a.deepEqual(plain(physical(p)),plain(physical(scale.find(q=>q.midi===p.midi))));
  a.deepEqual(plain(down),plain([...up].reverse()));a.equal(up.at(-1).technique,'naturalHarmonic');a.ok(up.every(p=>!p.shiftCue));
  for(const d of['up','down']){const notes=F.arpeggioNotes(m,k,d),refs=O.get(m,k,d,notes,true);for(const p of notes)a.equal(refs[p.midi].f,O.route(m,k,d,2,true).find(q=>q.midi===p.midi).f);}
 }
 const major=lists[0][1].find(k=>k[0]==='A');a.deepEqual(plain(O.route('major',major,'down',2)),plain(O.route('major',major,'down',2,false,'reviewed-052')));
});

test('B-flat upper134 is a narrow normal-sixth-position exception, not a global candidate relaxation',()=>{
 const k=lists[0][1].find(k=>k[0]==='B♭'),up=O.route('major',k,'up',2),down=O.route('major',k,'down',2),old=O.route('major',k,'up',2,false,'reviewed-052');
 a.deepEqual(plain(up.slice(0,-3)),plain(old.slice(0,-3)));a.deepEqual(plain(down),plain([...up].reverse()));a.deepEqual(Array.from(up.slice(-3),p=>p.f),[1,3,4]);
 for(const p of up.slice(-3)){a.equal(p.s,3);a.equal(p.anchor,10);a.equal(p.shape,'normal');a.ok(!p.displayExtended);a.equal(p.midi-57,10+O.SHAPES.normal[p.f-1]);}
 a.equal(O.candidates(70,{s:3,f:4},['normal']).length,0);
 const refs=Object.fromEntries(up.map(p=>[p.midi,p])),pos=F.notePlacement(70,{},refs);a.equal(pos.finger,4);a.match(F.pointStyling(pos).label,/第六把位/);
 const custom=F.notePlacement(70,{70:{s:3,f:4}},refs);a.equal(custom.finger,4);a.equal(custom.string,3);
});

test('E-minor C-string24 uses exact normal upper-first frame in both octaves and directions only',()=>{
 const k=lists[1][1].find(k=>k[0]==='E');for(const o of[1,2])for(const d of['up','down']){
  const r=O.route('minor',k,d,o),old=O.route('minor',k,d,o,false,'reviewed-052');
  a.deepEqual(Array.from(r,p=>[p.midi,p.s,p.f]),Array.from(old,p=>[p.midi,p.s,p.f]));
  for(let i=0;i<r.length;i++){const p=r[i];if(p.s!==0){a.deepEqual(plain(p),plain(old[i]));continue;}a.equal(p.anchor,3);a.equal(p.shape,'normal');a.ok(!p.displayExtended);a.equal(p.midi-36,3+O.SHAPES.normal[p.f-1]);const style=F.pointStyling(F.notePlacement(p.midi,{},Object.fromEntries(r.map(q=>[q.midi,q]))));a.equal(style.group,'position-3');a.equal(style.extended,false);a.match(style.label,/上第一把位／下第二把位/);}
 }
});
