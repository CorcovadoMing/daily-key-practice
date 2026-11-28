const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const section=name=>html.split('// '+name+'_START')[1].split('// '+name+'_END')[0];
const shared={exports:{}};
new Function('module',section('PRACTICE_LOUDNESS'))(shared);
const loud=shared.exports;
function load(name){
  const context={module:{exports:{}},window:{},CelloPracticeLoudness:loud};
  vm.runInNewContext(section(name),context);
  return context.module.exports;
}
const wave=(amplitude,dc=0,rate=48000,ct=4096)=>Float32Array.from({length:ct},(_,i)=>dc+amplitude*Math.sin(2*Math.PI*200*i/rate));
test('short-tail centered RMS reflects a controlled signal and ignores earlier samples',()=>{
  for(const rate of [44100,48000]){
    const a=loud.measure(wave(.1,.035,rate),rate), b=loud.measure(wave(.2,.035,rate),rate);
    assert.ok(Math.abs(a.rms-.1/Math.sqrt(2))<.001);
    assert.ok(Math.abs(20*Math.log10(b.rms/a.rms)-6.0206)<.02);
    assert.equal(a.clipped,false);
    assert.ok(Math.abs(a.halfMs-17.5)<.02);
    const old=wave(.1,0,rate);old.fill(1,0,old.length-Math.round(rate*.035));
    assert.ok(Math.abs(loud.measure(old,rate).rms-a.rms)<.001);
    assert.equal(loud.measure(old,rate).clipped,false);
  }
  assert.equal(loud.measure(new Float32Array(4096).fill(.27),48000).rms,0);
  assert.equal(loud.measure(wave(1.2),48000).clipped,true);
  assert.equal(loud.measure(Float32Array.of(.2,NaN),48000),null);
});
const observe=(collector,ms,rms,flags={})=>collector.observeMic({now:ms,rms,...flags});
function synthetic(levelAt,flagsAt=()=>({})){
  const take=loud.capture(1000);
  // Mic frames arrive first. This is valid for delayed SwiftF0 inference.
  for(let t=0;t<=700;t+=25)observe(take,1000+t,levelAt(t),flagsAt(t));
  for(let t=0;t<=700;t+=16)take.observePitch(1000+t,2,1);
  return take.snapshot(.003);
}
test('fixed room gain cancels, steady sustains and note envelopes do not warn',()=>{
  const a=synthetic(t=>t<65||t>625?.014:.07),b=synthetic(t=>t<65||t>625?.028:.14);
  assert.deepEqual(a.points.map(x=>x.db),b.points.map(x=>x.db));
  assert.equal(a.connection,null);
  assert.equal(b.connection,null);
  assert.equal(loud.suggestion(a,'D3↑'),null);
});
test('one lap reports only a measured short interruption, rough join, or local dip',()=>{
  function tracked({kind='break',slot=3,lap=1,pause=108,reject=null,glitch=null,allow=true}={}){
    const take=loud.capture(1000);
    for(let t=0;t<=1200+pause;t+=27){
      const during=t>=594&&t<594+pause;
      let rms=t<594?.065:kind==='step'?.17:.07,rough=.01;
      if(during&&kind==='break')rms=0;
      if(during&&kind==='dip')rms=.012;
      if(during&&kind==='noise')rough=.8;
      if(during&&kind==='one'&&t===594)rough=.8;
      if(kind==='bright'&&t>=594)rough=.8;
      if(glitch==='missing'&&during)continue;
      observe(take,1000+t,rms,{rough,...(glitch&&t===594?{[glitch]:true}:{})});
    }
    for(let t=0;t<=1200+pause;t+=16){
      const during=t>=594&&t<594+pause;
      take.observePitch(1000+t,during?null:t<594?2:slot,t<594?1:lap);
    }
    return take.snapshot(.003,({slot})=>slot!==reject,null,()=>allow);
  }
  for(const [kind,expected,copy] of [['break','break',/接近安靜/],['dip','dip',/掉下去又回來/],['noise','rough',/較粗的聲音/]]){
    const trace=tracked({kind}),e=trace.connection;
    assert.equal(e?.kind,expected);
    assert.deepEqual([e.from,e.to,e.lap],[2,3,1]);
    const advice=loud.suggestion(trace,'上行','D','E');
    assert.match(advice.observation,copy);
    assert.match(advice.action,/如果這裡本來要拉得連貫.*原本的弓法慢拉 D → E 兩次/);
    assert.match(advice.action,/同一弓的話.*讓弓繼續走.*要換弓的話.*不刻意加重音/);
    assert.match(advice.check,/前後各一音.*如果本來就要斷開，不用把兩音接起來/);
    assert.ok(advice.check.includes({break:'有沒有空隙',dip:'突然掉下去',rough:'有沒有沙聲'}[expected]));
  }
  for(const controls of [{lap:2},{slot:4},{slot:2},{pause:270},{pause:27},{kind:'step'},{kind:'bright'},{kind:'one'},
    {kind:'normal'},{reject:3},{allow:false},{glitch:'missing'},{glitch:'processed'},{glitch:'clipped'},{glitch:'metro'},{glitch:'muted'}])
    assert.equal(tracked(controls).connection,null,JSON.stringify(controls));
  assert.equal(synthetic(t=>t<350?.06:.145).connection,null,'one varying pitch is not a connection');
});
test('only two reviewed adjacent strings earn a conditional bow-crossing drill',()=>{
  const trace={connection:{kind:'rough',from:0,to:1,lap:1}};
  const plan=(a,b,reviewed=true,source='confirmed/visible plan')=>({source,slots:[
    {plan:{string:a,reviewed:true}},{plan:{string:b,reviewed}}
  ]});
  const fallback=loud.suggestion(trace,'上行','D','E');
  for(const p of [plan('G','G'),plan('C','D'),plan('G','D',false),plan('G','D',true,'score only'),plan('G','X'),null])
    assert.deepEqual(loud.suggestion(trace,'上行','D','E',p),fallback);
  for(const [a,b,direction] of [['G','D','上行'],['D','G','下行']]){
    const out=loud.suggestion(trace,direction,'D','E',plan(a,b));
    assert.equal(out.source,'bowCrossing');
    assert.match(out.observation,/錄到一小段較粗的聲音/);
    assert.ok(out.action.includes(a+'、'+b+' 兩條空弦'));
    assert.match(out.action,/如果這裡本來要拉得連貫.*先用同一弓.*弓只轉到能乾淨碰到下一弦.*照原弓法慢拉 D → E 兩次；原本要換弓，就保留換弓/);
    assert.match(html,/bowCrossing:\{[^\n]*24-improving-string-crossings/);
    assert.doesNotMatch(out.observation,/弓高|同一弓|手腕|弓臂/);
    assert.match(out.check,/前後各一音.*沙聲.*如果本來就要斷開/);
    assert.equal(loud.suggestion({...trace,processing:true},direction,'D','E',plan(a,b)),null);
  }
});
test('one mixed RMS window on either side does not hide a short interrupted join',()=>{
  function probe({third=false,missing=false,long=false,lowDip=false}={}){
    const c=loud.capture(1000);
    const raw=long?[[567,.03],[594,.029],[621,0],[648,0],[675,.028],[702,.028]]:
      [[567,.029],[594,lowDip?.011:0],[621,lowDip?.011:0],[648,.029]];
    const samples=new Map(raw);
    if(third)samples.set(675,.029);
    for(let t=27;t<=1200;t+=27){
      if(missing&&t===648)continue;
      c.observeMic({now:1000+t,rms:samples.get(t)??.07,rough:.015});
    }
    for(let t=16;t<=1200;t+=16)c.observePitch(1000+t,t<=560?2:t>=698?3:null,1);
    return c.snapshot(.003,()=>true,null,()=>true).connection;
  }
  assert.equal(probe()?.kind,'break');
  assert.equal(probe({lowDip:true}),null);
  for(const controls of [{third:true},{missing:true},{long:true}])
    assert.equal(probe(controls),null,JSON.stringify(controls));
});
test('centered short-window roughness distinguishes broadband bursts from smooth pitch and level changes',()=>{
  for(const rate of [44100,48000]){
    const tone=wave(.10,0,rate);
    const bright=Float32Array.from(tone,(v,i)=>v+.04*Math.sin(2*Math.PI*1000*i/rate));
    let seed=17;
    const scratch=Float32Array.from(tone,v=>{seed=(1664525*seed+1013904223)>>>0;return v+(seed/2**32-.5)*.35;});
    for(const a of [tone,bright,wave(.24,0,rate)])assert.ok(loud.measure(a,rate).rough<.12);
    assert.ok(loud.measure(scratch,rate).rough>.5);
  }
});
test('clipping, metronome, mute and silence cause gaps, not spin or false dips',()=>{
  const a=synthetic(t=>t===475?.0001:.05,t=>({clipped:t===200,metro:t===350,muted:t===575}));
  assert.equal(a.clipped,true);assert.equal(a.metronome,true);
  for(const t of [200,350,375,400,425,450,475,575])assert.ok(!a.points.some(x=>x.ms===t));
  assert.equal(new Set(a.points.map(p=>p.segment)).size,4);
  assert.equal(a.connection,null);
  assert.equal(synthetic(()=>.0001).points.length,0);
});
test('auto-processing may show readings but suppresses the technique observation',()=>{
  const a=synthetic(t=>t<350?.06:.15,t=>({processed:t===100}));
  assert.ok(a.points.length>0);assert.equal(a.processing,true);assert.equal(a.connection,null);
});
test('unvoiced and out-of-span frames are omitted and each take is separate',()=>{
  const take=loud.capture(3000,8);
  observe(take,2999,.5);
  for(let t=0;t<12;t++)observe(take,3000+t*25,.08);
  for(let t=1;t<8;t++)take.observePitch(3000+t*25,t===4?null:1,1);
  const a=take.snapshot();
  assert.equal(a.capped,true);assert.equal(a.points.length,6);
  assert.equal(new Set(a.points.map(p=>p.segment)).size,2);
  assert.ok(!a.points.some(p=>p.ms===0||p.ms>=200||p.ms===100));
  assert.deepEqual(loud.capture(4000).snapshot().points,[]);
});
test('Swift capture forwards the current scalar untouched, not with historical frame time',async()=>{
  const {swiftPracticeCapture}=load('AUDIO_TOOLS');
  let mic,stopCount=0;
  const levels=[],pitches=[];
  const source={subscribe(listener){mic=listener;return()=>stopCount++;}};
  const batch=()=>Promise.resolve([{now:140,frequency:196,muted:false,swiftHop:6}]);
  const swift=swiftPracticeCapture({performance:{now:()=>100}},source,{load:()=>Promise.resolve()},batch,()=>false);
  const stop=swift.subscribe({ready(){},frame:p=>pitches.push(p),loudness:p=>levels.push(p),error:x=>assert.fail(x)});
  mic.ready();await Promise.resolve();
  mic.loudness({now:242.5,rms:.052,muted:false});
  mic.frame({now:260,rms:.045,muted:false});await Promise.resolve();
  assert.equal(levels[0].now,242.5);assert.equal(pitches[0].now,140);
  assert.equal(pitches[0].rms,undefined);
  stop();mic.loudness({now:270,rms:.07});assert.equal(levels.length,1);assert.equal(stopCount,1);
});
test('shared hub provides a scalar-only practice tap without opening another stream or altering detector',async()=>{
  const {micCapture}=load('SCALE_PRACTICE');
  let tick,count=0;
  const pitches=[],measurements=[];
  class AudioContext {
    state='running';sampleRate=48000;
    createMediaStreamSource(){return {connect(){},disconnect(){}};}
    createAnalyser(){return {getFloatTimeDomainData(buf){buf.set(wave(.2));},disconnect(){}};}
    close(){return Promise.resolve();} resume(){return Promise.resolve();}
  }
  const track={readyState:'live',getSettings:()=>({autoGainControl:true}),stop(){}};
  const tracks={getTracks:()=>[track],getAudioTracks:()=>[track]};
  const hub=micCapture({AudioContext,isSecureContext:true,performance:{now:()=>100},
    navigator:{mediaDevices:{getUserMedia:async()=>{count++;return tracks}}},
    setInterval(fn){tick=fn;},clearInterval(){},clearTimeout(){}},()=>196,.001);
  const stop=hub.subscribe({ready(){},error:x=>assert.fail(x),frame:x=>pitches.push(x.frequency),
    loudness:x=>measurements.push(x)});
  const stop2=hub.subscribe({ready(){},error:x=>assert.fail(x),frame:x=>pitches.push(x.frequency)});
  await new Promise(setImmediate);tick();stop();stop2();
  assert.equal(count,1);assert.deepEqual(pitches,[196,196]);assert.equal(measurements.length,1);
  assert.equal(measurements[0].now,82.5);assert.equal(measurements[0].processed,true);
  assert.ok(Math.abs(measurements[0].rms-.2/Math.sqrt(2))<.001);
  assert.deepEqual(Object.keys(measurements[0]).sort(),['clipped','halfMs','muted','now','processed','rms','rough']);
});
test('actual coach button renders current take loudness and resets from next take; no audio data is persisted',async()=>{
  let fetches=0, writes=0;
  class Node {
    children=[];dataset={};attributes={};handlers={};style={setProperty(){}};className='';
    constructor(tag){this.tag=tag;}
    append(...children){this.children.push(...children);for(const c of children)c.parent=this;}
    insertBefore(child,other){this.children.splice(this.children.indexOf(other),0,child);child.parent=this;}
    remove(){this.parent.children=this.parent.children.filter(x=>x!==this);}
    setAttribute(k,v){this.attributes[k]=v;}
    addEventListener(k,v){this.handlers[k]=v;}
    get textContent(){return (this.text??'')+this.children.map(x=>x.textContent).join('');}
    set textContent(s){this.text=s;this.children=[];}
    find(p){return p(this)?this:this.children.map(c=>c.find(p)).find(Boolean);}
  }
  const context=vm.createContext({
    module:{exports:{}},CelloPracticeLoudness:loud,CelloPracticeCoach:{enabled:()=>true},
    localStorage:{getItem(){return 'loop';},setItem(){writes++;}},
    fetch(){fetches++;throw Error('unexpected network access');},
    document:{createElement:t=>new Node(t),createElementNS:(_,t)=>new Node(t)},
    location:{hostname:'example.test',pathname:'/experimental/',search:''}
  });
  vm.runInContext(section('SCALE_PRACTICE'),context);
  const {manager,card}=context.module.exports, {pitchReading}=load('AUDIO_TOOLS');
  let clock=1000,listener;
  const capture={subscribe(next){listener=next;return()=>{};}};
  const managerInstance=manager({performance:{now:()=>clock}},{
    capture,swiftCapture:capture,pitchReading,pitchName:String,reference:()=>442,loudnessCapture:loud.capture
  });
  const target=[50,52,53,52,50].map((midi,i)=>({midi,name:['D','E','F','E','D'][i],octave:3}));
  const view=card({querySelectorAll:()=>target.map(()=>new Node('g'))},target,()=>{});
  async function play(repeatCount,makeVariation){
    await managerInstance.toggle(view);listener.ready();
    const route=[50,...Array.from({length:repeatCount},()=>[52,53,52,50]).flat()];
    for(let slot=0;slot<route.length;slot++){
      const midi=route[slot];
      if(makeVariation&&slot===1){
        for(let i=0;i<4;i++){
          clock+=27;listener.loudness({now:clock-17.5,rms:0});
          listener.frame({now:clock,frequency:null});
        }
      }
      for(let i=0;i<23;i++){
        clock+=27;
        listener.loudness({now:clock-17.5,rms:makeVariation&&slot===0?.065:.155});
        listener.frame({now:clock,frequency:442*2**((midi-69)/12)});
      }
    }
    await managerInstance.toggle(view);
  }
  const chart=()=>view.element.find(n=>n.tag==='section'&&n.dataset.chartTime==='volume');
  await play(1,true);
  assert.ok(chart());
  assert.match(chart().textContent,/本回收音中位數/);
  assert.ok(chart().find(n=>n.attributes.class==='trend-line')?.attributes.d.includes('L'));
  assert.match(view.element.textContent,/上行：D → E.*接近安靜/);
  assert.match(view.element.textContent,/Aldo Parisot：如何練習平順換弓/);
  const first=chart();
  await play(2,false);
  assert.equal(chart(),first,'reuse the same chart across takes');
  assert.doesNotMatch(view.element.textContent,/接近安靜/);
  assert.doesNotMatch(view.element.textContent,/Aldo Parisot：如何練習平順換弓/);
  view.snapshotVisiblePlan=()=>({source:'confirmed/visible plan',revision:'confirmed',
    slots:target.map((note,i)=>({...note,direction:i<=2?'up':'down',plan:{string:i===0||i===4?'G':'D',reviewed:true,finger:i===0||i===4?4:1}}))});
  await play(1,true);
  assert.match(view.element.textContent,/G 弦上的 D → D 弦上的 E.*接近安靜/);
  assert.match(view.element.textContent,/G、D 兩條空弦.*弓只轉到能乾淨碰到下一弦/);
  assert.match(view.element.textContent,/Ailbhe McDonagh：兩音連弓換弦/);
  assert.doesNotMatch(view.element.textContent,/Aldo Parisot：如何練習平順換弓/);
  assert.equal(writes,0);assert.equal(fetches,0);
});
test('a provisional score match may be visualized but cannot recommend a technique',()=>{
  const take=loud.capture(1000);
  // Strong variation was genuinely recorded, but the provisional pitch was
  // later rejected/reassigned by the final score alignment.
  for(let t=0;t<=660;t+=25){
    observe(take,1000+t,t<330?.055:.15);
    take.observePitch(1000+t,2,1);
  }
  const rejected=take.snapshot(.003,()=>false);
  const accepted=take.snapshot(.003,span=>span.slot===2&&span.lap===1&&span.start===1000);
  assert.ok(rejected.points.length>12);assert.equal(rejected.connection,null);
  assert.equal(accepted.connection,null,'a single accepted pitch cannot build a pair');
  assert.equal(loud.suggestion(rejected,'D'),null);
});
test('window spanning start is discarded even if its center is after start',()=>{
  const take=loud.capture(1000);
  take.observePitch(1000,0,1);
  take.observePitch(1025,0,1);
  take.observePitch(1050,0,1);
  observe(take,1006,.5,{halfMs:17.5});
  observe(take,1025,.1,{halfMs:17.5});
  assert.deepEqual(take.snapshot().points.map(x=>x.ms),[25]);
});

test('a centered near-silent bow join may be corroborated by both overlapping shoulders, never a lone dip',()=>{
  function probe({core=0,left=.015,right=.015,recovered=.055,omit=-1,processed=false,muted=false,metro=false}={}){
    const c=loud.capture(1000);
    const samples=new Map([[567,recovered],[594,left],[621,core],[648,right],[675,recovered]]);
    for(let t=27;t<940;t+=27){
      if(t===omit)continue;
      c.observeMic({now:1000+t,rms:samples.get(t)??.055,rough:.015,
        processed:processed&&t===621,muted:muted&&t===621,metro:metro&&t===621});
    }
    // The destination is confirmed late and ends soon afterwards, just like
    // the traditional PCM replay. Match provenance still comes from scoring.
    for(let t=16;t<=940;t+=16)c.observePitch(1000+t,t<=608?2:t>=736&&t<=848?3:null,1);
    return c.snapshot(.003,()=>true,null,()=>true).connection;
  }
  const actual=probe();
  assert.deepEqual([actual?.kind,actual?.from,actual?.to],['break',2,3]);
  for(const control of [{core:.007},{left:.055},{right:.055},{recovered:.026},{omit:594},{processed:true},{muted:true},{metro:true}])
    assert.equal(probe(control),null,JSON.stringify(control));
});
