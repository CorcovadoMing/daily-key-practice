const test=require('node:test'),a=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const c={window:{}};vm.createContext(c);for(const f of['fingerboard.js','fingering-presets.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c);
const O=c.window.CelloFingeringOptimizer,F=c.window.CelloFingerboard,h=fs.readFileSync('index.html','utf8'),lists=[['major','MAJOR_KEYS'],['minor','MINOR_KEYS']].map(([m,n])=>[m,vm.runInNewContext(h.match(new RegExp('const '+n+' = (\\[[\\s\\S]*?\\n    \\]);'))[1])]);
const plain=r=>Array.from(r,p=>[p.midi,p.s,p.f,p.anchor,p.shape]);
test('only A-key A4 two-octave scale/arpeggio endpoints are light-touch harmonics',()=>{
 let harmonics=0,physicalChanges=0;
 for(const[m,keys]of lists)for(const k of keys)for(const[o,arp]of[[1,false],[2,false],[2,true]])for(const d of['up','down']){
  const r=O.route(m,k,d,o,arp),old=O.route(m,k,d,o,arp,'reviewed-048');
  if(JSON.stringify(plain(r))!==JSON.stringify(plain(old))){physicalChanges++;a.equal(m,'minor');a.equal(k[0],'A');a.equal(o,2);a.equal(arp,false);a.equal(d,'up');}
  r.forEach((p,i)=>{
   const expected=k[0]==='A'&&o===2&&p.midi===69&&(i===0||i===r.length-1);
   a.equal(p.technique==='naturalHarmonic',expected);
   if(expected){harmonics++;a.equal(p.s,3);a.equal(p.f,3);a.equal(p.harmonic.partial,2);a.equal(p.harmonic.touchSemitones,12);a.equal(p.harmonic.soundingMidi,69);a.equal(p.group,'harmonic');a.match(p.positionLabel,/輕觸/);a.doesNotMatch(p.positionLabel,/把位/);a.ok(!p.displayExtended);}
  });
 }
 a.equal(harmonics,8);a.equal(physicalChanges,1);
});
test('A minor ascending01241243 keeps all lower notes and the exact descending continuation',()=>{
 const k=lists[1][1].find(k=>k[0]==='A'),up=O.route('minor',k,'up',2),down=O.route('minor',k,'down',2);
 a.equal(Array.from(up.filter(p=>p.s===3),p=>p.f).join(''),'01241243');
 a.deepEqual(plain(up).slice(11,14),[[64,3,1,7,'extended'],[66,3,2,7,'extended'],[68,3,4,7,'extended']]);
 a.deepEqual(plain(up).slice(0,11),plain(O.route('minor',k,'up',2,false,'reviewed-048')).slice(0,11));
 a.deepEqual(plain(down),plain(O.route('minor',k,'down',2,false,'reviewed-048')));
 a.deepEqual(plain(up).at(-1),plain(down)[0]);
 const refs=O.get('minor',k,'up',F.scaleNotes('minor',k,'up',2));
 const shown=F.notePlacement(69,{},refs);a.equal(shown.technique,'naturalHarmonic');a.equal(shown.anchor,undefined);a.equal(shown.shape,undefined);
 for(const map of[{69:{s:3,f:2}},{69:{s:2,f:3}},{69:{s:3,f:3}}])a.equal(F.notePlacement(69,map,refs).technique,undefined);
 a.equal(F.notePlacement(57,{},refs).technique,undefined);a.equal(F.notePlacement(57,{},refs).group,'open');
});
test('C-minor inside-arrow changes only presentation, retains both-endpoint guard and archived cue',()=>{
 const k=lists[1][1].find(k=>k[0]==='C'),r=O.route('minor',k,'down',2),old=O.route('minor',k,'down',2,false,'reviewed-048');
 a.deepEqual(plain(r),plain(old));a.equal(r[2].shiftCue.symbol,'↑');a.equal(r[2].shiftCue.placement,'inside');a.equal(old[2].shiftCue.symbol,'（↑）');
 const refs=Object.fromEntries(r.map(p=>[p.midi,p]));for(const map of[{56:{s:2,f:3}},{55:{s:2,f:3}}])a.equal(F.resolvedShiftCue(56,map,refs),null);
 a.match(r[2].shiftCue.description,/第4指.*弦枕.*半音.*降/);
});
