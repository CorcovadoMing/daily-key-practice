const test=require('node:test'),a=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),crypto=require('crypto');
const c={window:{}};vm.createContext(c);for(const f of ['fingerboard.js','fingering-presets.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c);
const O=c.window.CelloFingeringOptimizer,F=c.window.CelloFingerboard,h=fs.readFileSync('index.html','utf8');
const lists=[['major','MAJOR_KEYS'],['minor','MINOR_KEYS']].map(([m,n])=>[m,vm.runInNewContext(h.match(new RegExp('const '+n+' = (\\[[\\s\\S]*?\\n    \\]);'))[1])]);
const plain=r=>Array.from(r,p=>[p.midi,p.s,p.f,p.anchor,p.shape]);
test('canonical alias is zero motion; opening true forward-first is shape only',()=>{
 const half={midi:58,s:3,f:1,anchor:1,shape:'extended'},back={...half,anchor:2,shape:'backwardExtended'};
 for(const [x,y]of[[half,back],[back,half]])for(const dir of ['up','down']){
  const step=O.movementStep(x,y,dir);a.ok(step);a.equal(step.events,0);a.equal(step.components,0);a.equal(step.travel,0);
 }
 const normal={midi:59,s:3,f:1,anchor:2,shape:'normal'},forward={...normal,shape:'extended'};
 const step=O.movementStep(normal,forward,'up');a.equal(step.events,1);a.equal(step.anchor,0);a.equal(step.shape,1);a.equal(step.travel,0);
});
test('simultaneous motion is one event with separate components; finger selection alone is free',()=>{
 const start={midi:39,s:0,f:2,anchor:2,shape:'normal'},same={midi:41,s:0,f:4,anchor:2,shape:'normal'};
 a.equal(O.movementStep(start,same,'up').events,0);
 const both={midi:47,s:1,f:2,anchor:3,shape:'extended'},step=O.movementStep(start,both,'up');
 a.equal(step.events,1);a.equal(step.components,3);
 const open={midi:43,s:1,f:0,anchor:2,shape:'normal'};a.equal(O.movementStep(start,open,'up').events,1);
 a.equal(O.movementStep(start,{...open,anchor:7},'up').components,2);
});
test('extension widens ONLY 1-2, never 2-3 or 3-4; normal134 remains valid',()=>{
 for(const shape of ['extended','backwardExtended']){
  const x=O.SHAPES[shape];a.equal(x[1]-x[0],2);a.equal(x[2]-x[1],1);a.equal(x[3]-x[2],1);
 }
 const make=(f,shape)=>({midi:36+2+O.SHAPES[shape][f-1],s:0,f,anchor:2,shape});
 a.equal(O.movementMetrics([1,3,4].map(f=>make(f,'normal'))).mixed134,0);
 a.equal(O.movementMetrics([1,3,4].map(f=>make(f,'normal'))).normal134,1);
 a.equal(O.movementMetrics([1,3,4].map(f=>make(f,'extended'))).stretched134,1);
 a.equal(O.movementMetrics([make(1,'normal'),make(3,'normal'),make(4,'extended')]).mixed134,1);
 a.equal(O.movementMetrics([1,2,4].map(f=>make(f,'extended'))).stretched124,1);
});
test('first-position family outranks less stretching in an unfamiliar position at equal events',()=>{
 const a1=Array.from(O.movementCost({s:0,f:1,anchor:2,shape:'extended'},null,false));
 const b=Array.from(O.movementCost({s:0,f:1,anchor:3,shape:'normal'},null,false));
 a.equal(a1[0],b[0]);a.ok(a1[1]<b[1]);
 a.ok(O.motionCandidates(37).some(p=>p.anchor===2&&p.shape==='backwardExtended'));
 a.ok(O.motionCandidates(37).every(p=>!(p.anchor===1&&p.shape==='extended')));
 a.ok(O.candidates(37).every(p=>p.shape!=='backwardExtended'));
});
test('144 locked045 physical routes reproduce the released reference checksum',()=>{
 const rows=[];for(const[m,keys]of lists)for(const k of keys)for(const[oct,arp]of[[1,false],[2,false],[2,true]])for(const d of['up','down'])
  rows.push([[m,k[0],oct,arp,d].join('|'),plain(O.route(m,k,d,oct,arp,'reviewed-045'))]);
 a.equal(crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex'),'11e8473d6aaac9bf057517778181de4bb9ed39fa5794a5da9a35cc6e5699328a');
});
for(const[m,keys]of lists)for(const k of keys)for(const[oct,arp]of[[1,false],[2,false],[2,true]])test(`${m} ${k[0]} ${oct}/${arp?'arp':'scale'} bounded motion and exact components`,()=>{
 const raw=[],now=[],old=[];
 for(const d of['up','down']){
  const r=O.route(m,k,d,oct,arp,'minimum-movements'),n=O.route(m,k,d,oct,arp),o=O.route(m,k,d,oct,arp,'reviewed-045');
  const rm=O.movementMetrics(r),nm=O.movementMetrics(n),om=O.movementMetrics(o);raw.push(rm);now.push(nm);old.push(om);
  a.equal(nm.components,nm.stringChanges+nm.anchorShifts+nm.shapeChanges);a.ok(nm.events<=nm.components);
  a.equal(nm.stretched134,0);a.equal(nm.mixed134,0);
  for(let i=1;i<n.length;i++)a.ok(O.movementStep(n[i-1],n[i],d));
  if(n[0].source==='computed-first-family-near-tie-v1'&&!n.some(p=>['reviewed-e-minor-upper-first24-053-v1','reviewed-b-minor-upper-055-v1','reviewed-g-minor-high-eflat1-055-v1','owner-voice-review-059-v1','reviewed-four-key-voice-v1','reviewed-final-five-011'].includes(p.source))){
   a.ok(nm.events<=rm.events+1);a.ok(nm.anchorShifts<=rm.anchorShifts);a.ok(nm.travel<=rm.travel);a.ok(nm.outsideFirstNotes<=rm.outsideFirstNotes);
  }
  if(m==='minor'&&k[0]==='C')a.deepEqual(plain(n),plain(o));
 }
 a.ok(raw[0].events+raw[1].events<=old[0].events+old[1].events);
});
test('F-sharp minor has stable stretched124, no mixed134/431 in either octave/direction',()=>{
 const k=lists[1][1].find(k=>k[0]==='F♯');
 for(const oct of[1,2])for(const d of['up','down']){
  const r=O.route('minor',k,d,oct),m=O.movementMetrics(r);a.equal(m.stretched134,0);a.equal(m.mixed134,0);a.ok(m.stretched124>=1);
 }
 const r=O.route('minor',k,'up',2),segment=r.filter(p=>[47,49,51].includes(p.midi));
 a.deepEqual(Array.from(segment,p=>p.f),[1,2,4]);a.ok(segment.every(p=>p.s===1&&p.anchor===4&&p.shape==='extended'));
});
