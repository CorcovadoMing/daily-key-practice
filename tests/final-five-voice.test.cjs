const test=require('node:test'),a=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),crypto=require('crypto');
const c={window:{}};vm.createContext(c);for(const f of ['fingerboard.js','fingering-presets.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c);
const O=c.window.CelloFingeringOptimizer,F=c.window.CelloFingerboard,h=fs.readFileSync('index.html','utf8'),lists={};for(const[m,n]of[['major','MAJOR_KEYS'],['minor','MINOR_KEYS']])lists[m]=vm.runInNewContext(h.match(new RegExp('const '+n+' = (\\[[\\s\\S]*?\\n    \\]);'))[1]);
const specs=[
 ['major','A♭',false,'up',[null,null,null,[[60,61,63,65,67,68],'124134']]],
 ['major','A♭',true,'up',[null,null,null,[[60,63,68],'144']]],
 ['major','D♭',false,'up',[[[37,39,41,42,44,46],'124124'],[[48,49,51],'124'],[[53,54,56],'124'],[[58,60,61],'134']]],
 ['minor','F',false,'up',[null,null,[[50,52,53,55,56,58,60],'0124124'],[[62,64,65],'134']]],
 ['minor','F',false,'down',[[[41,43,44],'134'],[[46,48,49],'134'],[[51,53,55,56,58,60],'124124'],[[61,63,65],'124']]],
 ['minor','F',true,'up',[[[41],'4'],[[44,48],'14'],[[53,56,60],'214'],[[65],'2']]],
 ['minor','B♭',false,'up', [[],[[46,48,49],'134'],null,[[57,58,60,61,63,65,67,69,70],'013412123']]],
 ['minor','B♭',false,'down',[[],[[46,48,49],'134'],[[51,53,54,56,58,60],'134124'],[[61,63,65,66,68,70],'124123']]],
 ['minor','B♭',true,'up',[[],[[46,49],'14'],[[53,58],'14'],[[61,65,70],'143']]],
 ['minor','E♭',false,'up',[[[39,41,42],'134'],[[44,46,48],'124'],[[50,51,53,54,56,58],'013124'],[[60,62,63],'134']]],
 ['minor','E♭',false,'down',[[[39,41,42],'134'],[[44,46,47,49,51,53],'134124'],[[54,56,58],'124'],[[59,61,63],'124']]],
 ['minor','E♭',true,'up',[[[39,42,46],'214'],[[51],'2'],[[54,58],'14'],[[63],'2']]]
];
for(const[m,k,arp,d,strings]of specs)test(`011 exact voice ${m} ${k} ${arp?'arpeggio':'scale'} ${d}`,()=>{
 const key=lists[m].find(q=>q[0]===k),r=O.route(m,key,d,2,arp).sort((a,b)=>a.midi-b.midi);
 strings.forEach((spec,s)=>{if(spec===null)return;const row=r.filter(p=>p.s===s);a.deepEqual(Array.from(row,p=>p.midi),spec[0]||[]);a.equal(row.map(p=>p.f).join(''),spec[1]||'');});
 if(arp||m==='major')a.deepEqual(JSON.parse(JSON.stringify(O.route(m,key,'down',2,arp))),JSON.parse(JSON.stringify(O.route(m,key,'up',2,arp).reverse())));
});
test('011 changes exactly18 of144 routes;126 exact010 routes and all pitches/physical frames preserved',()=>{
 let changed=0;for(const[id,hash]of JSON.parse(fs.readFileSync('tests/fixtures/routes-010.json'))){
 const[m,k,oct,ar,d]=id.split('|'),o=Number(oct),arp=ar==='true',key=lists[m].find(q=>q[0]===k),r=O.route(m,key,d,o,arp);
 const target=o===2&&((m==='major'&&(k==='A♭'||k==='D♭'&&!arp))||(m==='minor'&&['F','B♭','E♭'].includes(k)));
 const actual=crypto.createHash('sha256').update(JSON.stringify(r)).digest('hex');if(target){a.notEqual(actual,hash,id);changed++;}else a.equal(actual,hash,id);
 const notes=arp?F.arpeggioNotes(m,key,d):F.scaleNotes(m,key,d,o);a.deepEqual(Array.from(r,p=>p.midi),Array.from(notes,p=>p.midi));
 for(const[i,p]of r.entries()){if(p.f&&p.technique!=='naturalHarmonic')a.equal(p.midi,[36,43,50,57][p.s]+p.anchor+O.SHAPES[p.shape][p.f-1],id);if(i)a.ok(O.movementStep(r[i-1],p,d),id);}
 }a.equal(changed,18);
});
