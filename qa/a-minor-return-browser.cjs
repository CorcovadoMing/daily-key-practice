const{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),a=require('node:assert/strict');
(async()=>{const b=await chromium.launch({headless:true});try{for(const width of[320,390,1440]){const p=await b.newPage({viewport:{width,height:1000}});await p.route('**/classroom.js*',r=>r.abort());await p.goto(process.env.URL||'http://127.0.0.1:8803');await p.addScriptTag({url:'/fingerboard-editor.js'});const result=await p.evaluate(()=>{
 const F=CelloFingerboard,O=CelloFingeringOptimizer,key=['A',0,'A B C D E F♯ G♯ A','A B C D E F G A'],host=document.createElement('main');host.className='container';document.body.replaceChildren(host);let cases=0;
 for(const reverse of[false,true])for(const direction of['up','down']){
  const r=O.route('minor',key,direction,2),chart=F.chartSVG('minor',key,direction,2,{},null,[],reverse);host.replaceChildren(chart);
  for(const point of chart.querySelectorAll('[data-position-group="position-7"]')){const text=point.querySelector('title').textContent;if(!text.includes('第四把位'))throw Error('position label');if(point.getAttribute('data-position-extended')!==String(direction==='up'))throw Error('wrong extension');}
  if(chart.querySelectorAll('[data-position-group="position-7"]').length!==3)throw Error('upper triple missing');
  if(chart.querySelectorAll('.cello-harmonic-mark').length!==1)throw Error('harmonic missing');
  const refs=Object.fromEntries(r.map(x=>[x.midi,x]));for(const n of r)if(!n.f&&F.notePlacement(n.midi,{},refs).anchor!==undefined)throw Error('open position');cases++;
 }
 for(const [mode,k]of[['minor',key],['major',['A',3,'A B C♯ D E F♯ G♯ A']]])for(const octaves of[1,2])for(const direction of['up','down']){
  const chart=F.chartSVG(mode,k,direction,octaves,{},null,[],false,true);host.replaceChildren(chart);
  const scale=O.route(mode,k,'up',2),arp=O.route(mode,k,direction,2,true);
  for(const note of arp){if(mode==='minor'&&[60,64].includes(note.midi)){if(note.f!==(note.midi===60?1:4)||note.anchor!==3||note.shape!=='extended')throw Error('latest A-minor0143');continue;}const match=scale.find(p=>p.midi===note.midi);if(!match||match.s!==note.s||match.f!==note.f||match.anchor!==note.anchor||match.shape!==note.shape)throw Error('arp not scale-derived');}
  const displayed=[...chart.querySelectorAll('[data-position-group]')];if(displayed.length!==7)throw Error('arp octave toggle changed range');
  if(chart.querySelectorAll('.cello-harmonic-mark').length!==1)throw Error('arp harmonic missing');cases++;
 }
 const bk=['B♭',-2,'B♭ C D E♭ F G A B♭'],ek=['E',1,'E F♯ G A B C♯ D♯ E','E F♯ G A B C D E'],fk=['F♯',3,'F♯ G♯ A B C♯ D♯ E♯ F♯','F♯ G♯ A B C♯ D E F♯'];
 for(const direction of['up','down']){
  const chart=F.chartSVG('major',bk,direction,2);host.replaceChildren(chart);const tail=[...chart.querySelectorAll('[data-position-group="position-10"]')];if(tail.length!==3||tail.some(p=>p.getAttribute('data-position-extended')!=='false'||!p.querySelector('title').textContent.includes('第六把位')))throw Error('B-flat134 frame');cases++;
  const teacher=F.createEditor('major',bk,{upMap:JSON.stringify({70:{s:3,f:4}})}).element;if(!teacher.textContent.includes('(4)'))throw Error('high fourth custom rejected');
  for(const octaves of[1,2]){const e=F.chartSVG('minor',ek,direction,octaves);host.replaceChildren(e);const pair=[...e.querySelectorAll('[data-position-group="position-3"]')];if(pair.length!==2||pair.some(p=>p.getAttribute('data-position-extended')!=='false'||!p.querySelector('title').textContent.includes('上第一把位／下第二把位')))throw Error('E-minor24 frame');cases++;}
  const f=F.chartSVG('minor',fk,direction,2,{},null,[],false,true),cue=f.querySelector('.cello-shift-cue');host.replaceChildren(f);if(cue.textContent!=='換把'||/半音/.test(cue.parentElement.textContent+cue.getAttribute('aria-label')))throw Error('misleading arp cue');cases++;
 }
 const board=F.create('minor',key,{});host.replaceChildren(board);const panels=[...board.querySelectorAll('.cello-fb-direction')],down=panels[1];
 if(!down||down.querySelector('[data-position-extended="true"]'))throw Error('natural descent falsely extended');
 const editor=F.createEditor('minor',key,{},'down').element;host.replaceChildren(editor);if(editor.querySelectorAll('.cello-harmonic-mark').length!==1)throw Error('teacher harmonic');
 return{width:innerWidth,cases,overflow:document.documentElement.scrollWidth>innerWidth};
 });a.equal(result.overflow,false);console.log(result);await p.screenshot({path:'/private/tmp/053-a-minor-'+width+'.png',fullPage:true});await p.close();}}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
