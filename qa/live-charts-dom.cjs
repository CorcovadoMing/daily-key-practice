/* Builds a synthetic-audio browser fixture from the real candidate core + CSS.
   No external requests, microphone recordings, or storage credentials. */
const fs=require('node:fs');
const html=fs.readFileSync(process.argv[2]||'index.html','utf8');
const section=name=>html.split('// '+name+'_START')[1].split('// '+name+'_END')[0];
const css=[...html.matchAll(/<style>[\s\S]*?<\/style>/g)].map(m=>m[0]).join('');
const body=`
(async()=>{
 const diagnostics={};
 const host=document.querySelector('main');
 const c=window.CelloScalePractice, notes=[36,38,40,41,43,45,47,48,50,52,53,55,57,59,60];
 const names=['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
 const target=[...notes,...notes.slice(0,-1).reverse()].map(midi=>({midi,name:names[midi%12],octave:Math.floor(midi/12)-1}));
 const arp=[36,40,43,48,52,55,60,55,52,48,43,40,36].map(midi=>({...target.find(n=>n.midi===midi)}));
 const make=notes=>{const score=document.createElement('div');score.append(...notes.map(n=>{const el=document.createElement('span');el.dataset.midi=n.midi;return el;}));host.append(score);return score;};
 const view=c.card(make(target),target,()=>{}),other=c.card(make(arp),arp,()=>{},'arpeggio');
 host.append(view.element,other.element);
 diagnostics.collapsed=view.element.querySelectorAll('.scale-pitch-chart,.scale-pitch-trend').length;
 view.element.showPracticeCharts(true);
 other.element.showPracticeCharts(true);
 const q=s=>view.element.querySelector(s), p=()=>q('[data-chart-time="pitch"]'), v=()=>q('[data-chart-time="volume"]');
 const curve=n=>n.querySelector('.trend-line'), mask=n=>n.querySelector('.trend-selection'), scroll=n=>n.querySelector('.scale-pitch-trend-scroll');
 diagnostics.open=[view.element.querySelectorAll('.scale-pitch-chart,.scale-pitch-trend').length,q('.scale-pitch-columns').children.length,other.element.querySelector('.scale-pitch-columns').children.length];
 diagnostics.blankBefore=[curve(p()).getAttribute('d'),curve(v()).getAttribute('d')];
 diagnostics.narrowSlotScroll=q('.scale-pitch-scroller').scrollWidth>q('.scale-pitch-scroller').clientWidth;
 let clock=1000,listener;
 const capture={subscribe(n){listener=n;return()=>{};}};
 const manager=c.manager({performance:{now:()=>clock}},{
  capture,swiftCapture:capture,reference:()=>442,pitchName:String,loudnessCapture:window.CelloPracticeLoudness.capture,
  pitchReading(frequency){const n=69+12*Math.log2(frequency/442);return {midi:Math.round(n),cents:100*(n-Math.round(n)),frequency};}
 });
 const feed=(midi,count)=>{
  for(let i=0;i<count;i++){
   clock+=27;
   listener.loudness({now:clock-17.5,rms:midi===null?.016:.085,halfMs:17.5});
   listener.frame({now:clock,frequency:midi===null?null:442*2**((midi-69+.12)/12),muted:false});
  }
 };
 await manager.toggle(view);listener.ready();
 feed(36,19);feed(null,5);feed(38,18);
 await new Promise(r=>setTimeout(r,140));
 diagnostics.live=[p().dataset.live,v().dataset.live,Boolean(curve(p()).getAttribute('d')),Boolean(curve(v()).getAttribute('d'))];
 feed(null,325);feed(40,18);feed(null,50);
 await manager.toggle(view);
 diagnostics.stopped=[p().dataset.live,v().dataset.live,Boolean(curve(p()).getAttribute('d')),Boolean(curve(v()).getAttribute('d'))];
 diagnostics.pathSegments=[(curve(p()).getAttribute('d').match(/M/g)||[]).length,(curve(v()).getAttribute('d').match(/M/g)||[]).length];
 diagnostics.sameWidth=p().querySelector('svg').getAttribute('viewBox')===v().querySelector('svg').getAttribute('viewBox');
 const right=q('.scale-pitch-columns').children[2].querySelector('button');
 right.click();
 diagnostics.link=[right.getAttribute('aria-pressed'),Boolean(mask(p()).getAttribute('d')),mask(p()).getAttribute('d')===mask(v()).getAttribute('d'),scroll(p()).scrollLeft,scroll(v()).scrollLeft];
 scroll(v()).scrollLeft=0;scroll(v()).dispatchEvent(new Event('scroll'));
 diagnostics.sync=[scroll(p()).scrollLeft,scroll(v()).scrollLeft];
 diagnostics.lightLine=getComputedStyle(curve(p())).stroke;
 document.documentElement.dataset.appearance='dark';
 diagnostics.darkLine=getComputedStyle(curve(p())).stroke;
 diagnostics.graphBoxes=[q('.scale-pitch-chart'),p(),v()].map(n=>{const r=n.getBoundingClientRect();return [r.left,r.width,getComputedStyle(n).paddingInlineStart];});
 diagnostics.order=[...view.element.children].filter(n=>n.matches('.scale-pitch-chart,.scale-pitch-trend')).map(n=>n.dataset.chartTime||'score');
 const out=document.createElement('pre');out.id='results';out.textContent=JSON.stringify(diagnostics);host.append(out);
})().catch(e=>{const out=document.createElement('pre');out.id='results';out.textContent=String(e.stack||e);document.body.append(out);});`;
fs.writeFileSync(process.argv[3]||'/tmp/scale-live-charts-browser.html','<!doctype html><html data-appearance="light"><meta name="viewport" content="width=device-width,initial-scale=1">'+css+'<main class="container"></main><script>'+section('PRACTICE_LOUDNESS')+'<\/script><script>'+section('SCALE_PRACTICE')+'<\/script><script>'+body+'<\/script></html>');
