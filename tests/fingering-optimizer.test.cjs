const test=require('node:test'),a=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const c={window:{}};vm.createContext(c);
for(const file of ['fingerboard.js','fingering-presets.js'])vm.runInContext(fs.readFileSync(file,'utf8'),c);
const F=c.window.CelloFingerboard,O=c.window.CelloFingeringOptimizer,P=c.window.CelloFingeringPresets;
const html=fs.readFileSync('index.html','utf8'),OPEN=[36,43,50,57];
const identity=p=>[p.midi,p.s,p.f,p.anchor,p.shape].join(':');
function playable(route,direction){
 for(let i=0;i<route.length;i++){
  const p=route[i],semi=p.midi-OPEN[p.s];
  a.ok(p.anchor>=1&&p.anchor<=13);a.equal(p.f===0,semi===0);
  if(p.f){a.equal(semi,p.anchor+O.SHAPES[p.shape][p.f-1]);if(p.anchor>=8)a.ok(p.f<=3);
   a.equal(p.positionLabel.includes('擴增把位'),p.shape==='extended');}
  if(i)a.ok(O.transition(route[i-1],p,direction),identity(route[i-1])+' -> '+identity(p));
 }
}
for(const [mode,name] of [['major','MAJOR_KEYS'],['minor','MINOR_KEYS']]){
 const keys=vm.runInNewContext(html.match(new RegExp('const '+name+' = (\\[[\\s\\S]*?\\n    \\]);'))[1]);
 for(const key of keys){
  for(const octaves of [1,2])test(`${mode} ${key[0]} ${octaves} octave bounded scale states`,()=>{
   const up=O.route(mode,key,'up',octaves),down=O.route(mode,key,'down',octaves);
   playable(up,'up');playable(down,'down');
   for(const [dir,route] of [['up',up],['down',down]]){
    const notes=F.scaleNotes(mode,key,dir,octaves);
    a.deepEqual(Array.from(route,p=>p.midi),Array.from(notes,n=>n.midi));
    a.equal(Object.keys(O.get(mode,key,dir,notes)).length,notes.length);
   }
   a.equal(identity(up.at(-1)),identity(down[0]));
   if(mode==='major')a.deepEqual(Array.from(down,identity),Array.from(up,identity).reverse());
   else a.equal(up.at(-3).midi-down[2].midi,1); // melodic 6th vs natural 6th
  });
  test(`${mode} ${key[0]} independent symmetric arpeggio`,()=>{
   const up=O.route(mode,key,'up',2,true),down=O.route(mode,key,'down',2,true);
   playable(up,'up');playable(down,'down');
   a.deepEqual(Array.from(down,identity),Array.from(up,identity).reverse());
   const notes=F.arpeggioNotes(mode,key,'up');a.deepEqual(Array.from(up,p=>p.midi),Array.from(notes,p=>p.midi));
   a.equal(Object.keys(O.get(mode,key,'up',notes,true)).length,7);
   const p=up[1],map={[p.midi]:{s:p.s,f:p.f===4?3:4}},edited=F.notePlacement(p.midi,map,O.get(mode,key,'up',notes,true));
   a.equal(edited.custom,true);a.equal(edited.group,'custom');a.match(edited.positionLabel,/未核對/);
  });
 }
}
test('open strings cannot erase the cost of repositioning',()=>{
 const a1={s:0,f:1,anchor:2,shape:'normal'},b={s:1,f:0,anchor:7,shape:'normal'};
 a.equal(O.transition(a1,b,'up')[0],1);
 a.equal(O.transition(a1,{...b,anchor:2},'up')[0],0);
});
test('normal hand spans three semitones, extensions explicit and bounded',()=>{
 a.deepEqual(Array.from(O.SHAPES.normal),[0,1,2,3]);
 a.deepEqual(Array.from(O.SHAPES.extended),[0,2,3,4]);
 a.equal(O.LABELS[5],'第三把位');a.equal(O.LABELS[3],'上第一／下第二把位');
 a.equal(O.LABELS.length,14);
});
test('Werner confirmed source remains separately available and unchanged',()=>{
 a.equal(P.MAJOR_FINGERS.C,'013401340124012');a.equal(P.MINOR_FINGERS.A,'13401240124124342142104210431');
 a.equal(P.source,'user-Werner-photo');
});
test('computed defaults are bundled in a deployed existing asset',()=>{
 a.ok(html.indexOf('fingering-presets.js')<html.indexOf('fingerboard.js'));
 a.ok(fs.readFileSync('fingering-presets.js','utf8').includes('window.CelloFingeringOptimizer='));
 a.match(html,/20261115-043-experimental/);
});
