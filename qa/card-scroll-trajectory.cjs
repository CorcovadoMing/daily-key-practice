const{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),a=require('node:assert/strict');
(async()=>{const b=await chromium.launch({headless:true});try{for(const width of[390,1440])for(const reducedMotion of['no-preference','reduce'])for(const anchoring of['auto','none'])for(const direction of['down','up']){
 const p=await b.newPage({viewport:{width,height:900},reducedMotion});await p.route('**/classroom.js*',r=>r.abort());await p.goto(process.env.URL||'http://127.0.0.1:8801');
 const r=await p.evaluate(async({anchoring,direction})=>{
  DailyKeyPractice.setClassroomRoom('qa-local',{createdAt:1,majorIds:[0,1,2],minorIds:[0],doneIds:[],session:{createdAt:1,date:'2026-11-15',majorIds:[0,1,2],minorIds:[0],doneIds:[]}});
  const cards=[...document.querySelectorAll('.key-card')],first=cards[0].querySelector('.key-title'),last=cards.at(-1).querySelector('.key-title');
  document.documentElement.style.overflowAnchor=anchoring;
  if(direction==='up'){last.click();await new Promise(r=>setTimeout(r,1100));}
  const title=direction==='down'?last:first;window.scrollTo({top:scrollY+title.getBoundingClientRect().top-400,behavior:'instant'});await new Promise(r=>requestAnimationFrame(r));
  const before=title.getBoundingClientRect().top,trace=[],start=performance.now();title.click();
  await new Promise(resolve=>{function sample(t){trace.push({t:t-start,y:title.getBoundingClientRect().top,scroll:scrollY});if(t-start>1200)resolve();else requestAnimationFrame(sample)}requestAnimationFrame(sample)});
  return{before,trace,margin:parseFloat(getComputedStyle(title).scrollMarginTop),overflow:document.documentElement.scrollWidth>innerWidth};
 },{anchoring,direction});
 const ys=r.trace.map(x=>x.y);a.ok(ys.every((y,i)=>!i||y<=ys[i-1]+3),'heading reverses direction');const min=Math.min(...ys),max=Math.max(...ys);a.ok(min>=r.margin-3,JSON.stringify({width,reducedMotion,anchoring,direction,min}));a.ok(max<=r.before+3,JSON.stringify({width,reducedMotion,anchoring,direction,max,before:r.before}));a.ok(Math.abs(ys.at(-1)-r.margin)<3);a.equal(r.overflow,false);console.log({width,reducedMotion,anchoring,direction,before:r.before,min,max,final:ys.at(-1)});await p.close();
 }}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
