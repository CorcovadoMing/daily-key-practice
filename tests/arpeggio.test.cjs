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

test('all 24 keys feed targets from the exact rendered scale and arpeggio staff',()=>{
 class Node{
  constructor(){this.children=[];this.attributes={};}
  append(...children){this.children.push(...children);}
  setAttribute(name,value){this.attributes[name]=value;}
 }
 context.document={createElement:()=>new Node(),createElementNS:()=>new Node()};
 for(const [mode,name] of [['major','MAJOR_KEYS'],['minor','MINOR_KEYS']]){
  const keys=vm.runInNewContext(html.match(new RegExp('const '+name+' = (\\[[\\s\\S]*?\\n    \\]);'))[1]);
  for(const key of keys)for(const arpeggio of [false,true]){
   const expected=F.scoreNotes(mode,key,arpeggio);
   const staff=F.makeScore(mode,key,arpeggio,expected);
   const notes=staff.children[0].children.filter(x=>'data-midi' in x.attributes);
   assert.equal(notes.length,arpeggio?13:29);
   assert.deepEqual(notes.map(x=>[Number(x.attributes['data-midi']),x.attributes['data-note']]),
     Array.from(expected,n=>[n.midi,n.name]));
   assert.ok(notes.every(note=>note.children.filter(x=>x.attributes.class==='scale-stem').length===1),
     'every individual note owns its own stem, including repeated pitches and the final tonic');
   assert.ok(notes.every(note=>!note.children.some(x=>x.attributes.class==='scale-beam')),
     'shared beams cannot inherit the note highlight');
   const rows=staff.children[1].children;
   const firstCount=arpeggio?7:16;
   const rowsNotes=rows.map(staff=>staff.children.filter(x=>'data-midi' in x.attributes));
   assert.equal(rowsNotes[0].length,firstCount);
   assert.equal(rowsNotes[1].length,expected.length-firstCount);
   assert.deepEqual(rowsNotes.flat().map(x=>[x.attributes['data-score-index'],x.attributes['data-midi'],x.attributes['data-duration']]),
     notes.map(x=>[x.attributes['data-score-index'],x.attributes['data-midi'],x.attributes['data-duration']]),
     'mobile rows use the identical score positions with no duplicate top tonic');
   const pickSign=head=>head.children.find(x=>x.attributes.class==='scale-accidental')?.textContent??'';
   assert.deepEqual(rowsNotes.flat().map(pickSign),notes.map(pickSign),
     mode+' '+key[0]+' must keep every accidental at the same score index across a visual system break');
   assert.ok(rows[0].attributes['aria-label'].includes('上行') && rows[1].attributes['aria-label'].includes('下行'));
   assert.ok(rows.every(row=>row.children.filter(x=>x.attributes.class==='scale-key-signature').length===Math.abs(key[1])));
   const last=rowsNotes[1].at(-1);
   assert.ok(!last.children.some(x=>x.attributes.class==='scale-beam-local'));
   if(!arpeggio){
     assert.deepEqual(rows.map(row=>row.children.filter(x=>x.attributes.class==='scale-beam').length),[8,6],
       'the phone sustains all seven whole groups of four');
     assert.ok(rows[0].attributes['aria-label'].includes('下行起點'));
     assert.ok(rowsNotes.flat().slice(0,-1).every(head=>head.children.filter(x=>x.attributes.class==='scale-beam-local').length===2));
     assert.ok(rowsNotes.flat().every(head=>!head.children.some(x=>x.attributes.class==='scale-beam-local'&&'d' in x.attributes)),
       'breaking the score should never introduce lone flagged sixteenths for the site’s scale routes');
   }
   const beams=staff.children[0].children.filter(x=>x.attributes.class==='scale-beam');
   assert.equal(beams.length,arpeggio?0:14);
   for(const [i,note] of notes.entries()){
    const overlays=note.children.filter(x=>x.attributes.class==='scale-beam-local');
    assert.equal(overlays.length,arpeggio||i===28?0:2);
    overlays.forEach(({attributes:a},j)=>{
     const base=beams[Math.floor(i/4)*2+j].attributes;
     const stem=note.children.find(x=>x.attributes.class==='scale-stem').attributes;
     const onRail=x=>Number(base.y1)+(base.y2-base.y1)*(x-base.x1)/(base.x2-base.x1);
     assert.ok(+base.x1<=+a.x1 && +a.x1<=+stem.x1 && +stem.x1<=+a.x2 && +a.x2<=+base.x2);
     assert.ok(a.x2-a.x1<=29);
     assert.ok(Math.abs(a.y1-onRail(a.x1))<1e-9 && Math.abs(a.y2-onRail(a.x2))<1e-9);
     assert.equal(a.stroke,'none');
     assert.equal(a['aria-hidden'],'true');
     assert.equal(base.stroke,'#222');
    });
   }
  }
 }
});

test('local double-beam follows active pitch hue or explicit skipped red and is suppressed in print',()=>{
 assert.match(html,/\[data-practice-current=true\] \.scale-stem\{stroke:var\(--practice-tone\)/);
 assert.match(html,/\[data-practice-current=true\] \.scale-beam-local\{stroke:var\(--practice-tone\)/);
 assert.match(html,/@media print\{\s*[^}]*\[data-practice-current\] \.scale-beam-local,[^}]*\[data-practice-next\] \.scale-beam-local,[^}]*\[data-practice=skipped\] \.scale-beam-local\{stroke:none\}/);
 assert.match(html,/\[data-practice=skipped\] :is\(\.scale-stem,\.scale-beam-local\)\{stroke:var\(--practice-red\)\}/);
 assert.doesNotMatch(html,/\[data-practice=(matched|missing|detuned)\] \.scale-beam-local/);
});
