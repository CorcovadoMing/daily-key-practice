const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');const root=process.cwd(),A=require('node:assert/strict');
module.exports=(async()=>{const server=http.createServer((q,r)=>{let f=new URL(q.url,'http://test').pathname.replace(/^\/experimental\//,'')||'index.html';try{r.setHeader('content-type',f.endsWith('.js')?'text/javascript':'text/html');const bytes=fs.readFileSync(path.join(root,f));r.end(bytes);}catch{r.writeHead(404);r.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));let b;try{
b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const host='http://127.0.0.1:'+server.address().port;
for(const width of [320,390,768,1280])for(const zoom of [100])for(const colorScheme of ['light','dark']){const p=await b.newPage({viewport:{width,height:820},hasTouch:width<500,isMobile:width<500,colorScheme,reducedMotion:'no-preference'});await p.addInitScript(()=>{const d=new Date(),day=[d.getFullYear(),String(d.getMonth()+1).padStart(2,0),String(d.getDate()).padStart(2,0)].join('-');const ns='daily-key-practice:experimental:';
 if(!localStorage.getItem(ns+'v1'))localStorage.setItem(ns+'v1',JSON.stringify({version:1,sessions:{[day]:{date:day,createdAt:Date.now(),majorIds:[0],minorIds:[0],doneIds:[]}},personalHistory:[],classroomHistory:[],fingerings:{},preferences:{majorCount:1,minorCount:1}}));
 if(!localStorage.getItem(ns+'key-note:major-0'))localStorage.setItem(ns+'key-note:major-0','原本保留的筆記');
});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('**/*',r=>r.request().url().startsWith(host+'/')?r.continue():r.abort());await p.goto(host+'/experimental/',{waitUntil:'domcontentloaded'});if(zoom===200)await p.addStyleTag({content:'html{font-size:200%!important}'});


if((await p.locator('html').getAttribute('data-appearance')==='dark')!==(colorScheme==='dark'))await p.locator('#appearance-toggle').click();A.equal(await p.locator('html').getAttribute('data-appearance')==='dark',colorScheme==='dark');await p.locator('.key-card[data-key-id="major-0"] .key-title').click();await p.waitForTimeout(500);
for(const kind of ['scale','arpeggio']){
 const card=p.locator('.key-card[data-key-id="major-0"] .scale-practice[data-practice-kind="'+kind+'"]'),shell=card.locator('.scale-demo-shell'),primary=shell.locator('.scale-practice-demo'),chevron=shell.locator('.scale-demo-chevron'),start=card.locator('.scale-start-chevron');
 const click=el=>width<500?el.tap({timeout:5000}):el.click({timeout:5000});
 await shell.evaluate(e=>e.scrollIntoView({block:'center',inline:'nearest'}));
 const inspect=()=>shell.evaluate(e=>{const [main,arrow]=e.children;const b=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {x:r.x,y:r.y,w:r.width,h:r.height,bg:s.backgroundColor,fg:s.color,shape:s.borderRadius,outline:s.outlineStyle,startBorder:s.borderInlineStartWidth,endBorder:s.borderInlineEndWidth,divider:getComputedStyle(el,'::before').backgroundColor}};
 const seam=getComputedStyle(arrow,'::before');const bars=main.querySelector('.scale-demo-bars').getBoundingClientRect();
 return {seam:{left:seam.insetInlineStart,top:seam.insetBlockStart,width:seam.inlineSize,content:seam.content},clearance:arrow.getBoundingClientRect().left-bars.right,main:b(main),arrow:b(arrow),start:b(e.parentElement.querySelector('.scale-start-chevron')),icon:b(arrow.firstElementChild),play:getComputedStyle(main.querySelector('.scale-demo-play')).opacity,stop:getComputedStyle(main.querySelector('.scale-demo-stop')).opacity,meters:[...main.querySelectorAll('.scale-demo-bar')].map(b=>b.style.getPropertyValue('--demo-level')),status:main.closest('.scale-practice').querySelector('.scale-practice-demo-status').textContent};});
 const assertSingleSeam=v=>{A.equal(v.main.endBorder,'0px');A.equal(v.arrow.startBorder,'0px');A.equal(v.main.x+v.main.w,v.arrow.x);A.deepEqual(v.seam,{left:'0px',top:'13px',width:'1px',content:'""'});A.ok(v.clearance>=5,v.clearance);};
 const dock=await p.locator('#tuner-settings').evaluate(e=>{const css=getComputedStyle(e),q=e.getBoundingClientRect(),icon=e.firstElementChild.getBoundingClientRect();return {w:q.width,h:q.height,iconW:icon.width,iconH:icon.height,bg:css.backgroundColor,r:css.borderRadius,divider:getComputedStyle(e,'::before').backgroundColor};});const initial=await inspect();const primaryWidth=width===320?64:72;
 A.equal(initial.main.w,primaryWidth);A.ok(initial.main.h>=44);A.equal(initial.main.y,initial.start.y);
 const shapes=[initial.arrow.w,initial.arrow.h,initial.icon.w,initial.icon.h,initial.arrow.divider];
 A.deepEqual(shapes,[dock.w,dock.h,dock.iconW,dock.iconH,dock.divider]);
 A.deepEqual(shapes.slice(0,4),[width<=480?30:44,44,14,14]);
 A.equal(initial.main.bg,initial.arrow.bg);assertSingleSeam(initial);
 await chevron.evaluate(e=>{const r=e.getBoundingClientRect();window.scrollBy({top:r.top-innerHeight*.45,behavior:'instant'});});
 await chevron.focus();await p.keyboard.press('Enter');await p.waitForTimeout(370);
 const pop=p.locator('#'+await chevron.getAttribute('aria-controls')),panel=await pop.boundingBox(),before=await chevron.boundingBox();
 const speedInput=pop.locator('input');A.equal(await speedInput.evaluate(e=>e===document.activeElement),true);
 A.ok(panel.x>=7&&panel.x+panel.width<=width-7&&before.y-panel.y-panel.height>5,JSON.stringify({panel,before}));
 await speedInput.press('Home');await speedInput.press('ArrowRight');
 await p.keyboard.press('Escape');A.equal(await chevron.evaluate(e=>e===document.activeElement),true);await click(primary);
 await p.waitForFunction(el=>el.dataset.demoState==='playing',await primary.elementHandle(),{timeout:8000});
 if(width>=500)await primary.hover();
 await p.waitForFunction(e=>getComputedStyle(e.firstElementChild).backgroundColor===getComputedStyle(e.lastElementChild).backgroundColor,await shell.elementHandle(),{timeout:1500});
 await p.waitForTimeout(450);const active=await inspect();
 assertSingleSeam(active);A.equal(active.main.bg,active.arrow.bg);A.equal(active.main.fg,active.arrow.fg);
 if(width>=500){
  await chevron.hover();
  await p.waitForFunction(e=>getComputedStyle(e.firstElementChild).backgroundColor===getComputedStyle(e.lastElementChild).backgroundColor,await shell.elementHandle(),{timeout:1500});
 }A.equal(active.main.w,primaryWidth);A.equal(active.stop,'1');A.equal(active.play,'0');A.ok(active.meters.some((a,i)=>a!==initial.meters[i]));
 await primary.evaluate(el=>{window.demoStates=[];const observer=new MutationObserver(()=>window.demoStates.push(el.dataset.demoState));observer.observe(el,{attributes:true,attributeFilter:['data-demo-state']});});
 await click(chevron);await speedInput.press('ArrowRight');const speed=await pop.locator('output').textContent();A.equal(speed,'0.8×');
 await p.keyboard.press('Escape');A.equal(await primary.getAttribute('data-demo-state'),'playing');A.ok((await p.evaluate(()=>window.demoStates)).every(s=>s==='playing'));
 await click(primary);await p.waitForFunction(el=>el.dataset.demoState==='idle',await primary.elementHandle(),{timeout:3000});
 await p.waitForTimeout(220);const stopped=await inspect();A.equal(stopped.main.w,primaryWidth);assertSingleSeam(stopped);A.deepEqual(errors,[]);console.log(JSON.stringify({kind:'demo-control',exercise:kind,width,colorScheme,passed:true}));
}
await p.close();}
}finally{await b?.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1});
