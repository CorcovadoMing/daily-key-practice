const test=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const read=n=>fs.readFileSync(path.join(__dirname,'..',n),'utf8');
test('sample bank and calibrations are the independently octave-verified pair',()=>{
 const html=read('index.html'), js=read('fingerboard-editor.js');
 const encoded=js.match(/\nCELLO_DEMO_MP3_START\n([A-Za-z0-9+/=]+)\nCELLO_DEMO_MP3_END\n/)?.[1];
 a.ok(encoded);
 const payload=Buffer.from(encoded,'base64'); a.equal(payload.length,172268);
 a.equal(crypto.createHash('sha256').update(payload).digest('hex'),'b5dcbd7e71fc90a51461a1c007ebd61650f7f12565c09c761e9bf254afd4aacb');
 const table=JSON.parse(html.match(/const celloDemoRoots = (\[.*?\]);/)[1]);
 a.equal(table.length,13);
 for(let i=0;i<table.length;i++){
   const [f,s]=table[i],m=36+i*3;
   a.ok(Math.abs(1200*Math.log2(f/(440*2**((m-69)/12))))<10);
   a.equal(s,Number((.08+1.65*i).toFixed(2)));
 }
 a.match(html,/fingerboard-editor\.js\?v=20261126-cello-audio-2/);
});

test('reference crossfades sustained bows at every original cue and releases only the final note',async()=>{
 const vm=require('node:vm'),html=read('index.html'),f=html.slice(html.indexOf('  const celloDemoRoots'),html.indexOf('  function celloDemoPlayer'))+html.slice(html.indexOf('  function celloDemoPlayer'),html.indexOf('  function celloDemoPlayer')+html.slice(html.indexOf('  function celloDemoPlayer')).indexOf('\n  }\n')+5);
 const make=vm.runInNewContext(f+'\ncelloDemoPlayer');
 for(const [demoKind,base] of [['scale',.50],['arpeggio',.64]])for(const demoSpeed of [1,.6,1.4]){
  const step=base/demoSpeed;
  const notes=[],envelopes=[],stops=[],states=[];
  class AudioContext{
   state='running';currentTime=8;destination={};
   async decodeAudioData(){return {duration:21.45};}
   createGain(){const marks=[];envelopes.push(marks);return {gain:{setValueAtTime:(v,t)=>marks.push([v,t]),linearRampToValueAtTime:(v,t)=>marks.push([v,t])},connect(){},disconnect(){}};}
   createBufferSource(){return {playbackRate:{value:0},start(t,o,d){notes.push({t,o,d,r:this.playbackRate.value});},stop(t){stops.push(t);},connect(){}};}
  }
  const env={AudioContext,performance:{now:()=>8e3},fetch:async()=>({ok:true,text:async()=>read('fingerboard-editor.js')}),atob,setTimeout:()=>5,clearTimeout(){}};
  const player=make(env,{reference:()=>442,isCapturing:()=>false,asset:'bank'});
  const view={demoKind,demoSpeed,target:[36,43,48].map(midi=>({midi})),demoUpdate:s=>states.push(s)};
  await player.toggle(view);
  a.deepEqual(states,['loading','playing']);a.equal(notes.length,3);
  const near=(x,y)=>a.ok(Math.abs(x-y)<1e-9,[x,y].join(' vs '));
  const table=JSON.parse(html.match(/const celloDemoRoots = (\[.*?\]);/)[1]);
  for(let i=0;i<3;i++){
   const m=view.target[i].midi, [hz,offset]=table[Math.round((m-36)/3)];
   const cue=8.06+i*step, first=i===0, last=i===2;
   const start=cue-(first?0:.024), end=cue+(last?Math.min(1.30,1.10/demoSpeed):step+.024);
   near(notes[i].r,442*2**((m-69)/12)/hz);
   near(notes[i].t,start);near(notes[i].d/notes[i].r,end-start);
   near(notes[i].o,offset+(first?0:.115));near(stops[i],end);
   a.ok(notes[i].o+notes[i].d<offset+1.65,'never crosses into the next sample');
   const gain=envelopes[i+1];
   a.equal(gain[0][0],0);a.equal(gain.at(-1)[0],0);near(gain.at(-1)[1],end);
   a.ok(gain.every(([v,t],n)=>v>=0&&v<=1&&(n===0||t>gain[n-1][1])));
   if(!last){
    near(gain[2][1],cue+step-.024);
    near(gain[2][0],gain[1][0]); // unchanged gain up to the handover
    near(notes[i+1].t,gain[2][1]);
    near(envelopes[i+2][1][1],end); // complementary crossfade at same boundary
   }
  }
  await player.toggle(view);
  a.equal(states.at(-1),'idle');a.equal(stops.filter(s=>s===undefined).length,3);
 }
});

test('live speed swaps only unsounded notes and preserves cue, pitch, order, and Stop',async()=>{
 const vm=require('node:vm'),html=read('index.html'),code=html.split('// SCALE_PRACTICE_START')[1].split('// SCALE_PRACTICE_END')[0];
 const scope={module:{exports:{}}};vm.runInNewContext(code,scope);
 let current=8,armed=0;const sources=[],stops=[],states=[];
 class AudioContext{
  state='running';get currentTime(){return current;}destination={};
  async decodeAudioData(){return {duration:21.45};}
  createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){}},connect(){},disconnect(){}};}
  createBufferSource(){const id=sources.length,obj={id,playbackRate:{value:0},start(t,o,d){this.row={t,o,d,r:this.playbackRate.value};},stop(t){stops.push({id,t});},connect(){}};
   sources.push(obj);return obj;
  }
 }
 const env={AudioContext,performance:{now:()=>current*1e3},fetch:async()=>({ok:true,text:async()=>read('fingerboard-editor.js')}),atob,setTimeout:()=>++armed,clearTimeout(){}};
 const p=scope.module.exports.celloDemoPlayer(env,{reference:()=>442,isCapturing:()=>false,asset:'bank'});
 const view={target:[36,38,40,41,43,45].map(midi=>({midi})),demoKind:'scale',demoSpeed:1,demoUpdate:s=>states.push(s)};
 await p.toggle(view);
 const base=sources.slice(),eq=(x,y)=>a.ok(Math.abs(x-y)<1e-9);
 current=8.25;
 a.equal(p.speedChanged(1.4),true);
 a.deepEqual(stops.filter(x=>x.t===undefined).map(x=>x.id),[1,2,3,4,5]);
 const faster=sources.slice(6);
 eq(faster[0].row.t,base[1].row.t);eq(faster[1].row.t-faster[0].row.t,.5/1.4);
 a.deepEqual(faster.map(x=>x.row.r),base.slice(1).map(x=>x.row.r));
 // The first renewed note has now sounded. Slowing keeps it and the next cue.
 current=8.68;
 a.equal(p.speedChanged(.6),true);
 a.deepEqual(stops.filter(x=>x.t===undefined).map(x=>x.id),[1,2,3,4,5,7,8,9,10]);
 const slower=sources.slice(11);
 eq(slower[0].row.t,faster[1].row.t);eq(slower[1].row.t-slower[0].row.t,.5/.6);
 a.deepEqual(slower.map(x=>x.row.r),base.slice(2).map(x=>x.row.r));
 a.equal(states.length,2); // no stop/restart or replay UI during speed changes
 p.stop();a.equal(states.at(-1),'idle');
 a.equal(new Set(stops.filter(x=>x.t===undefined).map(x=>x.id)).size,sources.length);
});
