const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const context={window:{}};vm.createContext(context);
for(const file of ['fingerboard.js','fingering-presets.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context);
const F=context.window.CelloFingerboard,html=fs.readFileSync('index.html','utf8');
for(const [mode,name] of [['major','MAJOR_KEYS'],['minor','MINOR_KEYS']]){
 const keys=vm.runInNewContext(html.match(new RegExp('const '+name+' = (\\[[\\s\\S]*?\\n    \\]);'))[1]);
 for(const key of keys)test(mode+' '+key[0]+' arpeggio triad, octaves and directional sources',()=>{
  const up=F.arpeggioNotes(mode,key,'up'),down=F.arpeggioNotes(mode,key,'down'),all=[...up,...down.slice(1)];
  assert.equal(all.length,13);assert.equal(up[6].midi-up[0].midi,24);
  assert.equal(all.filter(n=>n.midi===up[6].midi).length,1);
  assert.deepEqual(Array.from(up,n=>n.midi-up[0].midi),mode==='major'?[0,4,7,12,16,19,24]:[0,3,7,12,15,19,24]);
  assert.deepEqual(Array.from(down,n=>n.midi),Array.from(up,n=>n.midi).reverse());
  for(const dir of ['up','down']){
   const scale=F.scaleNotes(mode,key,dir,2),arp=F.arpeggioNotes(mode,key,dir),presets=context.window.CelloFingeringPresets.get(mode,key,dir,scale);
   for(const n of arp){assert.equal(n.name,scale.find(v=>v.midi===n.midi).name);assert.ok(Number.isInteger(F.notePlacement(n.midi,{},presets).finger));}
   const n=arp[1],p=F.notePlacement(n.midi,{},presets);
   assert.equal(F.notePlacement(n.midi,{[n.midi]:{s:p.string,f:4}},presets).finger,p.semitones===0?0:4);
  }
 });
}
