const test=require('node:test'),a=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),crypto=require('crypto');
const c={window:{}};vm.createContext(c);for(const f of['fingerboard.js','fingering-presets.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c);
const O=c.window.CelloFingeringOptimizer,h=fs.readFileSync('index.html','utf8'),lists=[['major','MAJOR_KEYS'],['minor','MINOR_KEYS']].map(([m,n])=>[m,vm.runInNewContext(h.match(new RegExp('const '+n+' = (\\[[\\s\\S]*?\\n    \\]);'))[1])]);
const key=lists[1][1].find(k=>k[0]==='F♯'),plain=r=>Array.from(r,p=>[p.midi,p.s,p.f,p.anchor,p.shape]);
test('reviewed ascending12124 closes extension at the exact shared apex',()=>{
 const up=O.route('minor',key,'up',2,false,'reviewed-048'),down=O.route('minor',key,'down',2,false,'reviewed-048');
 a.equal(Array.from(up.slice(9),p=>p.f).join(''),'012124');
 a.deepEqual(plain(up).slice(12),[[63,3,1,6,'extended'],[65,3,2,6,'extended'],[66,3,4,6,'normal']]);
 a.deepEqual(plain(down).slice(0,2),[[66,3,4,6,'normal'],[64,3,2,6,'normal']]);
 a.deepEqual(plain(up).at(-1),plain(down)[0]);
 const oldUp=O.route('minor',key,'up',2,false,'reviewed-047'),oldDown=O.route('minor',key,'down',2,false,'reviewed-047');
 a.deepEqual(plain(up).slice(0,12),plain(oldUp).slice(0,12));a.deepEqual(plain(down).slice(2),plain(oldDown).slice(2));
 for(const [r,d]of[[up,'up'],[down,'down']])for(let i=1;i<r.length;i++)a.ok(O.movementStep(r[i-1],r[i],d));
 for(const p of[up[14],down[0],down[1]]){a.equal(p.shape,'normal');a.ok(!p.displayExtended);a.notEqual(p.group,'extended');a.doesNotMatch(p.positionLabel,/擴增/);}
 for(const p of[up[12],up[13]]){a.equal(p.displayExtended,true);a.match(p.positionLabel,/擴增/);}
});
test('12124 adds a separate closing event, not a longitudinal shift',()=>{
 for(const[d,expected]of[['up',[5,11,4,8]],['down',[4,7,2,7]]]){
  const m=O.movementMetrics(O.route('minor',key,d,2,false,'reviewed-048'));a.deepEqual([m.events,m.components,m.anchorShifts,m.travel],expected);
 }
});
test('reviewed048 scope keeps130 other directions and exact047 reference',()=>{
 const rows=[];let unchanged=0;
 for(const[m,keys]of lists)for(const k of keys)for(const[o,arp]of[[1,false],[2,false],[2,true]])for(const d of['up','down']){
  const old=O.route(m,k,d,o,arp,'reviewed-047');rows.push([[m,k[0],o,arp,d].join('|'),plain(old)]);
  if(m==='minor'&&k[0]==='F♯'&&o===2&&!arp)continue;
  if(m==='major'&&((o===1&&!arp&&['E','B','F♯'].includes(k[0]))||(arp&&['D♭','F♯','A♭'].includes(k[0]))))continue;
  a.deepEqual(plain(O.route(m,k,d,o,arp,'reviewed-048')),plain(old));unchanged++;
 }
 a.equal(unchanged,130);a.equal(crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex'),'ace98586cfffb3d2e970d4f871471b22e68ae909742532e4fc653206b33bc4c6');
});

test('all144 approved048 physical routes match independently reviewed checksum',()=>{
 const rows=[];
 for(const[m,keys]of lists)for(const k of keys)for(const[o,arp]of[[1,false],[2,false],[2,true]])for(const d of['up','down'])
  rows.push([[m,k[0],o,arp,d].join('|'),plain(O.route(m,k,d,o,arp,'reviewed-048'))]);
 a.equal(crypto.createHash('sha256').update(JSON.stringify(rows)).digest('hex'),'0a1bee116da86d8f46a538c145f49801a4b8bb0a5ac6c254b3353ba589688575');
});
