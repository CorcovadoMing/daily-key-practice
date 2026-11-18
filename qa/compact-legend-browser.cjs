const{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),a=require('node:assert/strict');
(async()=>{const b=await chromium.launch({headless:true});try{for(const width of[320,390,1440]){const p=await b.newPage({viewport:{width,height:1000}});await p.route('**/classroom.js*',r=>r.abort());await p.goto(process.env.URL||'http://127.0.0.1:8802');const result=await p.evaluate(()=>{
 const F=CelloFingerboard,keys=[['minor',['E',1,'E F♯ G A B C♯ D♯ E','E F♯ G A B C D E']],['minor',['B',2,'B C♯ D E F♯ G♯ A♯ B','B C♯ D E F♯ G A B']],['major',['A',3,'A B C♯ D E F♯ G♯ A']],['major',['E',4,'E F♯ G♯ A B C♯ D♯ E']]];
 const host=document.createElement('main');host.className='container';document.body.replaceChildren(host);let arrows=0,maxLegend=0;
 for(const[mode,key]of keys){const board=F.create(mode,key,{});host.replaceChildren(board);for(const point of board.querySelectorAll('[data-position-group]')){
  const group=point.getAttribute('data-position-group'),digit=point.querySelector('text'),circle=point.querySelector('circle');if(digit.getAttribute('fill')!==(group==='open'?'#34483a':'#ffffff'))throw Error('digit ink');
  if(point.getAttribute('data-position-extended')==='true'&&(circle.getAttribute('stroke-width')!=='1.5'||circle.getAttribute('stroke-dasharray')!=='none'))throw Error('extension border');
  const cue=point.querySelector('.cello-shift-cue');if(cue&&cue.textContent==='↓'){arrows++;if(cue.getAttribute('fill')!=='#ffffff')throw Error('arrow ink');const cx=+circle.getAttribute('cx'),cy=+circle.getAttribute('cy'),r=+circle.getAttribute('r');for(const t of[digit,cue]){const q=t.getBBox(),pad=t.getAttribute('stroke')==='none'?0:.5;for(const[x,y]of[[q.x-pad,q.y-pad],[q.x+q.width+pad,q.y-pad],[q.x-pad,q.y+q.height+pad],[q.x+q.width+pad,q.y+q.height+pad]])if(Math.hypot(x-cx,y-cy)>r)throw Error('arrow halo outside point');}}
 }
 for(const section of board.querySelectorAll('.cello-fb-direction')){if(section.hidden)continue;const legend=section.querySelector('.cello-fb-legend'),items=[...legend.querySelectorAll('.cello-legend-item')];maxLegend=Math.max(maxLegend,items.length);for(const item of items)if(item.scrollWidth>item.clientWidth+1)throw Error('legend clipped');}
 if(board.querySelector('.caption,.cello-inline-hint'))throw Error('explanatory prose');
 }
 return{width:innerWidth,arrows,maxLegend,overflow:document.documentElement.scrollWidth>innerWidth};
 });a.equal(result.overflow,false);console.log(result);await p.screenshot({path:'/private/tmp/052-compact-'+width+'.png',fullPage:true});await p.close();}}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
