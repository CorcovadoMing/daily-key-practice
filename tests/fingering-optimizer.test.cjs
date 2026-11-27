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
  if(p.f){a.equal(semi,p.anchor+O.SHAPES[p.shape][p.f-1]);if(p.anchor>=8&&p.f>3){
    if(p.source==='reviewed-final-five-011')a.equal(identity(p),'68:3:4:8:normal');
    else if(p.source==='reviewed-four-key-voice-v1')a.ok(['61:2:4:8:normal','68:3:4:8:normal'].includes(identity(p)),'explicit voice-selected high fourth finger');
    else{a.equal(p.source,'reviewed-bflat-upper134-053-v1');a.equal(p.midi,70);a.equal(p.s,3);a.equal(p.f,4);a.equal(p.anchor,10);a.equal(p.shape,'normal');}
   }
   a.equal(p.positionLabel.includes('擴增把位'),p.shape!=='normal'||p.displayExtended===true);}
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
   if(mode==='minor'&&octaves===2&&['C♯','G♯'].includes(key[0])){
    // Voice-selected ascent134 / natural-return124 share the same fourth-finger
    // contact point but prepare different remaining fingers at the turn.
    const top=up.at(-1),back=down[0],s=key[0]==='C♯'?2:3,midi=key[0]==='C♯'?61:68;
    a.equal(identity(top),[midi,s,4,8,'normal'].join(':'));
    a.equal(identity(back),[midi,s,4,7,'extended'].join(':'));
    a.equal(top.source,'reviewed-four-key-voice-v1');a.equal(back.source,'reviewed-four-key-voice-v1');
    a.equal(top.anchor+O.SHAPES[top.shape][3],back.anchor+O.SHAPES[back.shape][3]);
   }else if(mode==='minor'&&octaves===2&&['F','E♭'].includes(key[0])){
    const midi=key[0]==='F'?65:63,anchor=key[0]==='F'?5:3;
    a.equal(identity(up.at(-1)),[midi,3,4,anchor,'normal'].join(':'));
    a.equal(identity(down[0]),[midi,3,4,anchor-1,'extended'].join(':'));
   }else if(mode==='minor'&&octaves===2&&key[0]==='B♭'){
    a.equal(identity(up.at(-1)),'70:3:3:10:extended');a.equal(identity(down[0]),'70:3:3:11:normal');
   }else a.equal(identity(up.at(-1)),identity(down[0]));
   if(mode==='major')a.deepEqual(Array.from(down,identity),Array.from(up,identity).reverse());
   else if(mode==='minor')a.equal(up.at(-3).midi-down[2].midi,1); // melodic 6th vs natural 6th
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
 a.match(html,/20261127-088-experimental/);
});

test('F major preserves GD 0124 and applies reviewed expanded124 then fourth-position12',()=>{
 const key=['F',-1,'F G A B♭ C D E F'],up=O.route('major',key,'up'),down=O.route('major',key,'down');
 a.equal(Array.from(up,p=>p.f).join(''),'401240124012412');
 a.equal(Array.from(up,p=>p.s).join(''),'011112222333333');
 a.deepEqual(Array.from(up,p=>p.anchor),[2,2,2,2,2,2,2,2,2,2,2,2,2,7,7]);
 a.ok(up.every((p,i)=>p.shape===(i>=9&&i<=12?'backwardExtended':'normal')&&p.source==='reviewed-F-124-fourth-position-v1'));
 a.equal(Array.from(O.route('major',key,'up',2,false,'reviewed-045'),p=>p.f).join(''),'401240124013134');
 a.deepEqual(Array.from(down,identity),Array.from(up,identity).reverse());
 a.equal(O.metrics(up).shifts,1);a.equal(O.metrics(up).extensions,3);
 const minimum=O.route('major',key,'up',2,false,'minimum-shifts');
 a.equal(O.metrics(minimum).shifts,1);a.equal(O.metrics(minimum).extensions,3);
});
test('044 preference does not alter any unrelated route or legacy Werner digits',()=>{
 for(const [mode,name] of [['major','MAJOR_KEYS'],['minor','MINOR_KEYS']]){
  const keys=vm.runInNewContext(html.match(new RegExp('const '+name+' = (\\[[\\s\\S]*?\\n    \\]);'))[1]);
  for(const key of keys)for(const octaves of [1,2])for(const arp of [false,true])for(const dir of ['up','down']){
   if((!arp&&mode==='major'&&key[0]==='F'&&octaves===2)||(mode==='minor'&&key[0]==='C'))continue;
   a.deepEqual(Array.from(O.route(mode,key,dir,octaves,arp,'reviewed-045'),identity),
     Array.from(O.route(mode,key,dir,octaves,arp,'minimum-shifts'),identity));
  }
 }
 a.equal(P.MAJOR_FINGERS.F,'401240124012134');
});

test('C minor keeps first-position reference with honest directional extensions',()=>{
 const key=['C',-3,'C D E♭ F G A B C','C D E♭ F G A♭ B♭ C'];
 const up=O.route('minor',key,'up'),down=O.route('minor',key,'down');
 a.equal(Array.from(up,p=>p.s).join(''),'000011112222333');
 a.equal(Array.from(up,p=>p.f).join(''),'012401340124012');
 a.equal(Array.from(down,p=>p.s).join(''),'332222211110000');
 a.equal(Array.from(down,p=>p.f).join(''),'214421042104210');
 a.ok(up.every(p=>p.anchor===2));
 a.ok(down.every((p,i)=>p.anchor===(i===2?3:2)));
 a.equal(identity(up.at(-1)),identity(down[0]));
 a.equal(O.metrics(up).shifts,0);a.equal(O.metrics(down).shifts,2);
 a.equal(O.metrics(up).extensions,1);a.equal(O.metrics(down).extensions,5);
 a.equal(up[9].shape,'backwardExtended');a.match(up[9].positionLabel,/第一把位.*向後擴增把位/);
 for(const i of [1,3,4,5,9])a.equal(down[i].shape,'backwardExtended');
 a.equal(down[2].shape,'normal');a.equal(down[2].shiftCue.toMidi,55);
 a.equal(down[2].shiftCue.symbol,'↑');
 a.equal(down.filter(p=>p.shiftCue).length,1);
 const oneUp=O.route('minor',key,'up',1),oneDown=O.route('minor',key,'down',1);
 a.equal(Array.from(oneUp,p=>p.f).join(''),'01240134');
 a.equal(Array.from(oneDown,p=>p.f).join(''),'42104210');
 a.equal(O.metrics(oneUp).shifts,0);a.equal(O.metrics(oneUp).extensions,0);
 a.equal(O.metrics(oneDown).shifts,0);a.equal(O.metrics(oneDown).extensions,1);
 a.equal(identity(oneUp.at(-1)),identity(oneDown[0]));
 a.equal(oneDown[2].shape,'backwardExtended');
 a.deepEqual(Array.from(O.SHAPES.backwardExtended),[-1,1,2,3]);
 a.ok(O.candidates(51).every(p=>p.shape!=='backwardExtended'));
 a.ok(O.candidates(51,{s:2,f:1},['backwardExtended']).some(p=>p.anchor===2));
});

test('extension display colors the entire same-string anchor segment, not neighboring strings',()=>{
 const key=['C',-3,'C D E♭ F G A B C','C D E♭ F G A♭ B♭ C'],up=O.route('minor',key,'up');
 a.deepEqual(Array.from(up,p=>!!p.displayExtended),[false,false,false,false,false,false,false,false,false,true,true,true,false,false,false]);
 for(const i of [9,10,11]){
  const p=F.notePlacement(up[i].midi,{},Object.fromEntries(up.map(p=>[p.midi,p])));
  a.equal(F.pointStyling(p).group,'position-2');a.equal(F.pointStyling(p).extended,true);a.match(F.pointStyling(p).label,/擴增第一把位/);
 }
 a.equal(up[8].f,0);a.equal(up[10].shape,'normal');a.equal(O.metrics(up).extensions,1);
 const custom=F.notePlacement(up[10].midi,{[up[10].midi]:{s:2,f:3}},Object.fromEntries(up.map(p=>[p.midi,p])));
 a.equal(F.pointStyling(custom).group,'custom');a.equal(custom.displayExtended,undefined);
 for(const mode of ['major','minor']){
  const major=['F',-1,'F G A B♭ C D E F'];
  const k=mode==='major'?major:key;
  const upArp=O.route(mode,k,'up',2,true),downArp=O.route(mode,k,'down',2,true);
  a.deepEqual(Array.from(downArp,p=>[p.s,p.f,p.anchor,p.shape,!!p.displayExtended,p.group,p.positionLabel].join(':')),
    Array.from(upArp,p=>[p.s,p.f,p.anchor,p.shape,!!p.displayExtended,p.group,p.positionLabel].join(':')).reverse());
 }
});

test('all 144 raw physical routes reproduce the released 043 baseline checksum',()=>{
 const rows=[];
 for(const [mode,name] of [['major','MAJOR_KEYS'],['minor','MINOR_KEYS']]){
  const keys=vm.runInNewContext(html.match(new RegExp('const '+name+' = (\\[[\\s\\S]*?\\n    \\]);'))[1]);
  for(const key of keys)for(const [oct,arp] of [[1,false],[2,false],[2,true]])for(const dir of ['up','down']){
   rows.push([[mode,key[0],oct,arp,dir].join('|'),Array.from(O.route(mode,key,dir,oct,arp,'minimum-shifts'),p=>[p.midi,p.s,p.f,p.anchor,p.shape])]);
  }
 }
 a.equal(rows.length,144);
 a.equal(require('node:crypto').createHash('sha256').update(JSON.stringify(rows)).digest('hex'),
   '6ef3e6ae9d269e5998d258d024fdeeac3f5d58903085854aec91aaa595b05c6a');
});

test('open strings never expose a hand position even within an extended segment',()=>{
 for(const [mode,name] of [['major','MAJOR_KEYS'],['minor','MINOR_KEYS']]){
  const keys=vm.runInNewContext(html.match(new RegExp('const '+name+' = (\\[[\\s\\S]*?\\n    \\]);'))[1]);
  for(const key of keys)for(const [oct,arp] of [[1,false],[2,false],[2,true]])for(const dir of ['up','down']){
   const route=O.route(mode,key,dir,oct,arp),map=Object.fromEntries(route.map(p=>[p.midi,p]));
   for(const p of route.filter(p=>p.f===0)){
    const shown=F.notePlacement(p.midi,{},map),style=F.pointStyling(shown);
    a.equal(p.group,'open');a.equal(p.displayExtended,undefined);a.equal(p.positionLabel,'空弦');
    a.equal(style.group,'open');a.equal(style.label,'空弦');
    a.equal(shown.anchor,undefined);a.equal(shown.shape,undefined);a.equal(shown.displayExtended,undefined);
   }
  }
 }
 a.equal(F.pointStyling({semitones:0,finger:0,displayExtended:true,group:'extended',positionLabel:'第一把位'}).label,'空弦');
});
test('reviewed same-finger cue is suppressed when either endpoint string or finger changes',()=>{
 const key=['C',-3,'C D E♭ F G A B C','C D E♭ F G A♭ B♭ C'],notes=F.scaleNotes('minor',key,'down',2);
 const ref=O.get('minor',key,'down',notes);
 a.equal(F.resolvedShiftCue(56,{},ref).symbol,'↑');
 for(const map of [{56:{s:2,f:3}},{55:{s:2,f:3}},{56:{s:3,f:1}},{55:{s:1,f:4}}])a.equal(F.resolvedShiftCue(56,map,ref),null);
 a.equal(F.resolvedShiftCue(56,{56:{s:2,f:4},55:{s:2,f:4}},ref).symbol,'↑');
 a.equal(F.resolvedShiftCue(55,{},ref),null);
});

test('C-minor arpeggio uses first-position second fingers and one D extension segment',()=>{
 const key=['C',-3,'C D E♭ F G A B C','C D E♭ F G A♭ B♭ C'];
 const up=O.route('minor',key,'up',2,true),down=O.route('minor',key,'down',2,true);
 a.equal(Array.from(up,p=>p.s).join(''),'0011223');
 a.equal(Array.from(up,p=>p.f).join(''),'0204142');
 a.ok(up.every(p=>p.anchor===2));a.equal(up[1].shape,'normal');a.equal(up[6].shape,'normal');
 a.deepEqual(Array.from(up,p=>!!p.displayExtended),[false,false,false,false,true,true,false]);
 a.equal(O.metrics(up).shifts,0);a.equal(O.metrics(up).extensions,2);
 a.deepEqual(Array.from(down,identity),Array.from(up,identity).reverse());
 a.ok([...up,...down].every(p=>!p.shiftCue));
});
