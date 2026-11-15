const test=require('node:test'),a=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),crypto=require('crypto');
const c={window:{}};vm.createContext(c);for(const f of['fingerboard.js','fingering-presets.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c);
const O=c.window.CelloFingeringOptimizer,h=fs.readFileSync('index.html','utf8'),lists=[['major','MAJOR_KEYS'],['minor','MINOR_KEYS']].map(([m,n])=>[m,vm.runInNewContext(h.match(new RegExp('const '+n+' = (\\[[\\s\\S]*?\\n    \\]);'))[1])]);
const key=lists[1][1].find(k=>k[0]==='F♯'),plain=r=>Array.from(r,p=>[p.midi,p.s,p.f,p.anchor,p.shape]);
test('reviewed F-sharp two-octave string layout is3336 including apex and low G-sharp descends on C',()=>{
 const up=O.route('minor',key,'up',2),down=O.route('minor',key,'down',2);
 a.equal(up.length,15);a.equal(Array.from(up,p=>p.s).join(''),'000111222333333');
 a.equal(Array.from(up,p=>p.f).join(''),'134124124012423');
 a.deepEqual(Array.from(up,p=>p.anchor),[6,6,6,4,4,4,3,3,3,2,2,2,2,7,7]);
 a.equal(Array.from(down,p=>p.s).join(''),'333333222211100');
 a.equal(Array.from(down,p=>p.f).join(''),'314310421042142');
 a.deepEqual(Array.from(down,p=>p.anchor),[7,7,2,2,2,2,2,2,2,2,2,2,2,5,5]);
 a.deepEqual(plain(up).at(-1),plain(down)[0]);
 a.equal(down.find(p=>p.midi===44).s,0);a.equal(down.find(p=>p.midi===44).f,4);
 for(const dir of['up','down']){
  const r=O.route('minor',key,dir,2);a.deepEqual(plain(r),plain(O.route('minor',key,dir,2,false,'minimum-movements')));
  a.ok(r.every(p=>p.source==='reviewed-fsharp-3336-v1'&&!p.shiftCue));
  for(let i=1;i<r.length;i++)a.ok(O.movementStep(r[i-1],r[i],dir));
  a.equal(O.movementMetrics(r).mixed134,0);a.equal(O.movementMetrics(r).stretched134,0);
 }
 a.equal(up[0].shape,'normal');a.equal(up[1].shape,'normal');a.equal(up[2].shape,'normal');
});
test('targeted change reports fewer events but honestly more component/longitudinal motions',()=>{
 for(const [d,expected]of[['up',[4,11,4,9]],['down',[4,7,2,8]]]){
  const n=O.movementMetrics(O.route('minor',key,d,2));
  a.deepEqual([n.events,n.components,n.anchorShifts,n.travel],expected);
  a.equal(O.movementMetrics(O.route('minor',key,d,2,false,'reviewed-046')).events,5);
 }
});
test('all140 unrelated physical routes and the complete046/raw comparators remain exact',()=>{
 const previous=[],raw=[];let unchanged=0;
 for(const[m,keys]of lists)for(const k of keys)for(const[oct,arp]of[[1,false],[2,false],[2,true]])for(const d of['up','down']){
  const id=[m,k[0],oct,arp,d].join('|'),ref=O.route(m,k,d,oct,arp,'reviewed-046');
  previous.push([id,plain(ref)]);raw.push([id,plain(O.route(m,k,d,oct,arp,'minimum-movements'))]);
  if(m==='minor'&&k[0]==='F♯'&&oct===2)continue;
  a.deepEqual(plain(O.route(m,k,d,oct,arp)),plain(ref));unchanged++;
 }
 a.equal(unchanged,140);
 const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
 a.equal(hash(previous),'02a4e8f66f1aad9cd50028ae20062c349f640980655647dc05ed48de9e28051d');
 a.equal(hash(raw),'b6785ce28ef1fa8ae6d0c17440923f41953689349bfcf28ac9164fdf2e72b280');
});

test('F-sharp arpeggio preserves lower three and shows the necessary half-step shift',()=>{
 const up=O.route('minor',key,'up',2,true),down=O.route('minor',key,'down',2,true),old=O.route('minor',key,'up',2,true,'reviewed-046');
 a.deepEqual(plain(up).slice(0,3),plain(old).slice(0,3));
 a.equal(Array.from(up,p=>p.s).join(''),'0112233');a.equal(Array.from(up,p=>p.f).join(''),'4141414');
 a.deepEqual(Array.from(up,p=>p.anchor),[2,2,2,4,4,4,5]);
 a.deepEqual(plain(down),plain(up).reverse());
 a.equal(up[4].midi-up[3].midi,3);a.equal(up[3].shape,'normal');a.equal(up[4].shape,'normal');
 a.equal(up[6].midi-up[5].midi,5);a.equal(up[6].anchor-up[5].anchor,1);
 a.equal(up[5].shiftCue.symbol,'換把半音');a.equal(down[0].shiftCue.toMidi,61);
 for(const r of[up,down]){const m=O.movementMetrics(r);a.deepEqual([m.events,m.components,m.anchorShifts,m.travel],[4,7,2,3]);}
 const map=Object.fromEntries(up.map(p=>[p.midi,p]));
 a.equal(c.window.CelloFingerboard.resolvedShiftCue(61,{66:{s:3,f:3}},map),null);
});
