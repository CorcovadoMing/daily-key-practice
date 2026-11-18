const fs=require('fs'),vm=require('vm');const html=fs.readFileSync('index.html','utf8');let ctx={module:{exports:{}},Float32Array,Float64Array,Math,Number};vm.runInNewContext(html.split('// AUDIO_TOOLS_START')[1].split('// AUDIO_TOOLS_END')[0],ctx);const {detectPitch,PitchWindow}=ctx.module.exports;
let results=[];
for(const rate of [44100,48000])for(const duration of [100,160,250,500])for(const low of [65.406,146.832,440])for(const offset of [0,20,40,60]){
 const tones=[0,2,4,5,7,5,4,2].map(n=>low*2**(n/12));const lead=500,end=lead+tones.length*duration;let phase=0,seed=22;
 const signal=Float32Array.from({length:Math.ceil((end+200)/1000*rate)},(_,i)=>{const t=i/rate*1000,idx=t<lead?0:Math.min(tones.length-1,Math.floor((t-lead)/duration)),age=t<lead?t:(t-lead)%duration;phase+=2*Math.PI*tones[idx]/rate;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const env=Math.min(1,age/12)*(.85+.15*Math.sin(i/rate*12));return .05*env*(Math.sin(phase)+.6*Math.sin(2*phase)+.25*Math.sin(3*phase))+.0002*(seed/2147483648-1);});
 for(const [name,win,step] of [['031',8192,80],['short',4096,40]]){
  let smoother=new PitchWindow(),seen=tones.map(()=>null),wrong=0,valid=0,blank=0;
  for(let t=lead+offset;t<end;t+=step){const at=Math.floor(t/1000*rate),x=signal.slice(at-win,at);let f=detectPitch(x,rate,.0002);const idx=Math.floor((t-lead)/duration);if(!f){blank++;continue;}f=smoother.push(f);valid++;let nearest=tones.map(v=>Math.abs(1200*Math.log2(f/v)));if(Math.min(...nearest)>50)wrong++;if(nearest[idx]<30&&seen[idx]===null)seen[idx]=t-(lead+idx*duration);}
  results.push({rate,duration,low,offset,name,hit:seen.filter(x=>x!==null).length,miss:seen.filter(x=>x===null).length,latencies:seen.filter(x=>x!==null),wrong,valid,blank});
 }
}
fs.writeFileSync('/tmp/tuner-sequence-results.json',JSON.stringify(results,null,2));
for(const duration of [100,160,250,500])for(const name of ['031','short']){let rows=results.filter(r=>r.duration===duration&&r.name===name),lat=rows.flatMap(r=>r.latencies).sort((a,b)=>a-b);console.log({duration,name,hit:rows.reduce((a,r)=>a+r.hit,0),total:rows.length*8,median:lat[Math.floor(lat.length/2)],p90:lat[Math.floor(lat.length*.9)],wrong:rows.reduce((a,r)=>a+r.wrong,0),valid:rows.reduce((a,r)=>a+r.valid,0),blank:rows.reduce((a,r)=>a+r.blank,0)});}
