const test=require('node:test'),a=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),c={window:{}};vm.createContext(c);for(const f of['fingerboard.js','fingering-presets.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c);const O=c.window.CelloFingeringOptimizer,F=c.window.CelloFingerboard,h=fs.readFileSync('index.html','utf8'),lists=[['major','MAJOR_KEYS'],['minor','MINOR_KEYS']].map(([m,n])=>[m,vm.runInNewContext(h.match(new RegExp('const '+n+' = (\\[[\\s\\S]*?\\n    \\]);'))[1])]),plain=r=>Array.from(r,p=>[p.midi,p.s,p.f,p.anchor,p.shape]);
test('141 configurations remain exact051; reviewed ascent changes and exact arrow semantics',()=>{
 let arrows=0;for(const[m,ks]of lists)for(const k of ks)for(const[o,arp]of[[1,false],[2,false],[2,true]])for(const d of['up','down']){
  const r=O.route(m,k,d,o,arp,'reviewed-052'),old=O.route(m,k,d,o,arp,'reviewed-051');if(!((m==='major'&&k[0]==='A'||k[0]==='E')&&o===2&&!arp&&d==='up'))a.deepEqual(plain(r),plain(old));
  for(let i=0;i<r.length;i++)if(r[i].shiftCue?.symbol==='↓'&&r[i].midi!==59){
   arrows++;a.equal(m,'minor');a.ok(['E','B'].includes(k[0]));a.equal(arp,false);a.equal(d,'up');
   const p=r[i],q=r[i+1],x=O.SHAPES[p.shape].map(n=>n+p.anchor),y=O.SHAPES[q.shape].map(n=>n+q.anchor);
   a.equal(p.f,1);a.equal(q.f,1);a.equal(p.s,q.s);a.equal(y[0]-x[0],1);a.deepEqual(Array.from(y.slice(1)),Array.from(x.slice(1)));
   a.equal(q.shape,'normal');a.ok(!q.displayExtended);a.equal(q.displaySegmentStart,true);
   if(o===2){a.deepEqual(Array.from(r.slice(i+1,i+4),p=>p.f),[1,3,4]);for(const n of r.slice(i+1,i+4)){a.equal(n.shape,'normal');a.ok(!n.displayExtended);}}
   const refs=Object.fromEntries(r.map(p=>[p.midi,p]));for(const map of[{[p.midi]:{s:p.s,f:2}},{[q.midi]:{s:q.s,f:2}}])a.equal(F.resolvedShiftCue(p.midi,map,refs),null);
  }
 }a.equal(arrows,4);
});
test('white filled-note digits use a dark halo only when needed, open0 remains dark',()=>{
 for(let anchor=1;anchor<=13;anchor++){const style=F.pointStyling({semitones:anchor,finger:1,anchor,shape:'normal',group:'shifting'});a.equal(style.textColor,'#ffffff');a.equal(style.textStroke,F.contrastInk(F.POSITION_COLORS[style.group])==='#000000'?'#18251b':'none');}
 const open=F.pointStyling({semitones:0,finger:0});a.equal(open.textColor,'#34483a');a.equal(open.textStroke,'none');
});
test('latest A-major and both E ascents keep exact old descent and harmonic apex',()=>{
 for(const[m,name,expected]of[['major','A','01341243'],['major','E','01134'],['minor','E','01134']]){
  const k=lists.find(([mode])=>mode===m)[1].find(k=>k[0]===name),up=O.route(m,k,'up',2,false,'reviewed-052'),down=O.route(m,k,'down',2,false,'reviewed-052'),oldDown=O.route(m,k,'down',2,false,'reviewed-051');
  a.deepEqual(plain(down),plain(oldDown));a.deepEqual(plain(up).at(-1),plain(down)[0]);a.equal(Array.from(up.filter(p=>p.s===3),p=>p.f).join(''),expected);
  if(name==='A'){for(const p of up.filter(p=>[64,66,68].includes(p.midi))){a.equal(p.anchor,7);a.equal(p.shape,'extended');}a.equal(up.at(-1).technique,'naturalHarmonic');}
  else{const tail=up.slice(-3);a.deepEqual(Array.from(tail,p=>p.f),[1,3,4]);for(const p of tail){a.equal(p.anchor,4);a.equal(p.shape,'normal');a.ok(!p.displayExtended);}const cue=up.find(p=>p.midi===59).shiftCue;a.equal(cue.symbol,'↓');a.match(cue.description,/全音/);a.equal(cue.toMidi,61);}
 }
});
test('archived051 full144 routes including metadata match immutable released checksum',()=>{
 const rows=[];for(const[m,ks]of lists)for(const k of ks)for(const[o,arp]of[[1,false],[2,false],[2,true]])for(const d of['up','down'])rows.push([[m,k[0],o,arp,d].join('|'),O.route(m,k,d,o,arp,'reviewed-051')]);
 a.equal(require('node:crypto').createHash('sha256').update(JSON.stringify(rows)).digest('hex'),'a592533045f0412fc61f9d2c7d5a512e029f691bf01ad42c2217ff1e8325ad78');
});
