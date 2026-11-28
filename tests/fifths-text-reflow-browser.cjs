const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');const root=process.cwd(),A=require('node:assert/strict');
module.exports=(async()=>{const server=http.createServer((q,r)=>{let f=new URL(q.url,'http://test').pathname.replace(/^\/experimental\//,'')||'index.html';try{r.setHeader('content-type',f.endsWith('.js')?'text/javascript':'text/html');const bytes=fs.readFileSync(path.join(root,f));r.end(bytes);}catch{r.writeHead(404);r.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));let b;try{
b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const host='http://127.0.0.1:'+server.address().port;
for(const width of [320,390,768,1280])for(const zoom of [100,200])for(const colorScheme of ['light','dark']){const p=await b.newPage({viewport:{width,height:820},hasTouch:width<500,isMobile:width<500,colorScheme,reducedMotion:'reduce'});await p.route('**/*',r=>r.request().url().startsWith(host+'/')?r.continue():r.abort());await p.goto(host+'/experimental/',{waitUntil:'domcontentloaded'});if(zoom===200)await p.addStyleTag({content:'html{font-size:200%!important}'});

const summary=p.locator('#draw-settings>summary');if(width<500)await summary.tap();else await summary.click();await p.waitForTimeout(180);
const layout=await p.evaluate(()=>{
 const circle=document.querySelector('.fifths-circle'),cells=[...circle.querySelectorAll('.filter-key')],signs=[...circle.querySelectorAll('.fifths-signature')];
 const box=e=>e.getBoundingClientRect(),bound=box(circle);
 const ov=(a,b)=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1;
 const hit=a=>document.elementFromPoint((a.left+a.right)/2,(a.top+a.bottom)/2)?.closest('.filter-key')?.dataset;
 const pairOverlap=[],markerOverlap=[],overwide=[],outside=[] ;
 for(const [j,el] of cells.entries()){
  const a=box(el),label=el.textContent.trim();
  if(a.left<bound.left-.5||a.right>bound.right+.5||a.top<bound.top-.5||a.bottom>bound.bottom+.5)outside.push(label);
  for(const child of el.querySelectorAll('strong,small')){const range=document.createRange();range.selectNodeContents(child);const q=range.getBoundingClientRect();if(q.left<a.left||q.right>a.right)overwide.push([label,Math.round(q.width),Math.round(a.width)]);}
  for(const b of cells.slice(j+1))if(ov(a,box(b)))pairOverlap.push([label,b.textContent.trim()]);
  for(const m of signs)if(ov(a,box(m)))markerOverlap.push([label,m.textContent.trim()]);
 }
 return {labels:cells.length,markerCount:signs.length,bound:[bound.width,bound.height],pairOverlap,markerOverlap,overwide,outside};
});

A.equal(layout.labels,24);A.equal(layout.markerCount,12);for(const k of ['pairOverlap','markerOverlap','overwide','outside'])A.equal(layout[k].length,0,k);
const keys=p.locator('.fifths-circle .filter-key');
const names=await keys.allTextContents();
A.deepEqual([names[0],names[1],names[12],names[13]],['C大調','A小調','F♯大調','E♭小調']);
for(let i=0;i<24;i++){
 const key=keys.nth(i);
 A.ok(await key.evaluate(e=>{e.scrollIntoView({block:'center',inline:'nearest'});const b=e.getBoundingClientRect();return document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)?.closest('.filter-key')===e;}),names[i]);
}
for(const i of [0,6,9,10,12,13,16,17,23]){
 const key=keys.nth(i);await key.evaluate(e=>e.scrollIntoView({block:'center',inline:'nearest'}));
 const before=await key.getAttribute('aria-pressed');
 if(width<500)await key.tap({timeout:3000});else await key.click({timeout:3000});
 A.notEqual(await key.getAttribute('aria-pressed'),before);
 await p.keyboard.press('Space');A.equal(await key.getAttribute('aria-pressed'),before);
}console.log(JSON.stringify({kind:'fifths-reflow',width,zoom,colorScheme,passed:true}));await p.close();}
}finally{await b?.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1});
