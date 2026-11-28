const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs'),http=require('node:http'),A=require('node:assert/strict');
const assets=new Set(['index.html','classroom.js','fingerboard.js','fingerboard-editor.js','fingering-presets.js','firebase-config.js','metronome-worklet.js']);
(async()=>{
 const server=http.createServer((req,res)=>{
  const name=new URL(req.url,'http://localhost').pathname.split('/').pop()||'index.html';
  if(!assets.has(name)){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':'text/html');
  fs.createReadStream(name).pipe(res);
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const url='http://127.0.0.1:'+server.address().port;
 let b;
 try {
  b=await chromium.launch({executablePath:process.env.BROWSER||undefined});
  for(const first of ['metro','tuner'])for(const path of ['worklet','fallback']){
   const p=await b.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Version/26.1 Mobile/15E148 Safari/604.1'});
   const errors=[];p.on('pageerror',e=>errors.push(e.message));
   await p.addInitScript(({path})=>{
    const originalContext=AudioContext, originalNode=AudioWorkletNode;
    const trace=window.trace={types:[],config:[],ramps:[],beats:[],capture:[],ended:0,output:0};
    let type='auto';
    Object.defineProperty(navigator,'audioSession',{configurable:true,value:{get type(){return type;},set type(v){type=v;trace.types.push(v);}}});
    const ramp=AudioParam.prototype.linearRampToValueAtTime;
    AudioParam.prototype.linearRampToValueAtTime=function(v,t){trace.ramps.push(v);return ramp.call(this,v,t);};
    const connect=AudioNode.prototype.connect;
    AudioNode.prototype.connect=function(out,...rest){if(out instanceof AudioDestinationNode)trace.output++;return connect.call(this,out,...rest);};
    window.AudioWorkletNode=class extends originalNode{
     constructor(...args){super(...args);this.port.addEventListener('message',({data})=>trace.beats.push(data.beat));this.port.start();
      const message=this.port.postMessage.bind(this.port);
      this.port.postMessage=(m,...options)=>{if(m.settings)trace.config.push(m.settings);return message(m,...options);};
     }
    };
    if(path==='fallback')AudioWorklet.prototype.addModule=()=>Promise.reject(new Error('test unavailable'));
    navigator.mediaDevices.getUserMedia=async ()=>{
     trace.capture.push(type);
     const mic=new originalContext();await mic.resume();const dest=mic.createMediaStreamDestination();
     const osc=mic.createOscillator(),gain=mic.createGain();osc.frequency.value=147;gain.gain.value=.06;osc.connect(gain).connect(dest);osc.start();
     const track=dest.stream.getAudioTracks()[0],stop=track.stop.bind(track);
     track.stop=()=>{trace.ended++;stop();osc.stop();void mic.close();};
     return dest.stream;
    };
   },{path});
   await p.route('**/*',r=>r.request().url().startsWith(url+'/')?r.continue():r.abort());
   await p.goto(url+'/experimental/');
   await p.evaluate(()=>{document.querySelector('#tuner-detector input[value=existing]').click();
    const slider=document.querySelector('#metro-volume');slider.value=43;slider.dispatchEvent(new Event('input'));});
   const ids={metro:'#metronome-open',tuner:'#tuner-open'};
   const meter=()=>p.evaluate(isFallback=>isFallback?trace.ramps.length:trace.beats.length,path==='fallback');
   const tap=type=>p.locator(ids[type]).tap();
   const other=first==='metro'?'tuner':'metro';
   await tap(first);await tap(other);
   await p.waitForFunction(()=>trace.capture.length===1&&document.querySelector('#metronome-open').getAttribute('aria-pressed')==='true');
   const isFallback=path==='fallback';
   const waitForBeat=async()=>{const n=await meter();await p.waitForFunction(({n,isFallback})=>(isFallback?trace.ramps.length:trace.beats.length)>n,{n,isFallback});};
   await waitForBeat();await waitForBeat();
   A.deepEqual(await p.evaluate(()=>trace.types),first==='metro'?['playback','auto']:[]);
   await tap('tuner');
   await p.waitForFunction(()=>trace.ended===1);
   await waitForBeat();await waitForBeat();
   A.equal(await p.locator(ids.metro).getAttribute('aria-pressed'),'true');
   A.equal(await p.locator('#metro-volume').evaluate(e=>e.value),'43');
   await tap('metro');
   const t=await p.evaluate(()=>trace);
   A.deepEqual(t.types,first==='metro'?['playback','auto','playback','auto']:['playback','auto']);
   A.deepEqual(t.capture,['auto']);
   A.equal(t.ended,1);
   if(isFallback){A.ok(t.ramps.length>=4);A.ok(t.ramps.every(v=>Math.abs(v-.43*.85)<1e-8));}
   else{A.equal(t.config.length,1);A.equal(t.config[0].volume,43);A.equal(t.config[0].peakLevel,.85);A.equal(t.output,1);}
   A.deepEqual(errors,[]);
   await p.close();
   console.log(first,path,'continued beating; gain unchanged; mic released once');
  }
 }finally{await b?.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
