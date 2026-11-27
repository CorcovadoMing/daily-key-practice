const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const root=process.cwd();
const viewports=[[320,false],[390,true],[768,false],[1280,true]];
function seed(page,config){
 return page.addInitScript(({resume,notes})=>{
  const p='daily-key-practice:experimental:',d=new Date(),day=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  if(!localStorage.getItem(p+'v1'))localStorage.setItem(p+'v1',JSON.stringify({version:1,
   sessions:resume?{[day]:{date:day,createdAt:Date.now(),majorIds:notes?[0,1]:[0],minorIds:notes?[]:[0],doneIds:[]}}:{},
   personalHistory:notes?[{id:'ui-personal',date:day,drawnAt:Date.now(),majorIds:[0],minorIds:[0],doneIds:['major-0']}]:[],
   classroomHistory:notes?[{id:'ui-class',date:day,drawnAt:Date.now(),majorIds:[0],minorIds:[],doneIds:['major-0']}]:[],
   fingerings:{},preferences:{majorCount:notes?2:1,minorCount:notes?0:1}}));
  if(notes&&!localStorage.getItem(p+'key-note:major-0'))localStorage.setItem(p+'key-note:major-0','既有 C 練習');
 },config);
}
async function modeCheck(page,width,dark,resume){
   const q=s=>page.locator(s),button=q('#draw-button'),warning=q('#filter-warning');
   if(dark&&await q('html').getAttribute('data-appearance')!=='dark')await q('#appearance-toggle').click();
   await q('#mode-settings-toggle').click();
   await q('#launch-count-settings').scrollIntoViewIfNeeded();
   assert.equal(await q('#launch-resume').isVisible(),resume);
   const dims=()=>page.evaluate(()=>Object.fromEntries(['#draw-button','#launch-resume','#major-plus','#minor-plus','#launch-count-settings','#session-launch'].map(s=>{const el=document.querySelector(s);return [s,[el.offsetLeft,el.offsetTop,el.offsetWidth,el.offsetHeight]];})));
   const select=mode=>q('input[name="launch-mode"][value="'+mode+'"]').check();
   const normal=await dims();await select('sequential');
   assert.deepEqual(await dims(),normal);
   assert.equal(await q('#major-plus').isDisabled(),true);
   await select('random');assert.deepEqual(await dims(),normal);
   await q('#major-minus').click();await q('#minor-minus').click();
   assert.equal(await warning.isVisible(),true);assert.equal(await button.isDisabled(),true);
   const invalid=await dims();
   await select('sequential');
   assert.deepEqual(await dims(),invalid,{width,dark,resume});
   assert.equal(await button.isDisabled(),false);
   assert.equal(await warning.isVisible(),false);
   assert.equal(await q('#major-plus').isDisabled(),true);
   await select('random');assert.deepEqual(await dims(),invalid);
   assert.equal(await q('#major-plus').isDisabled(),false);
}
async function noteCheck(p, width, errors){
   const cards=p.locator('.key-card'),newNote=cards.nth(1).locator('.student-note-button');
   const visual=await newNote.evaluate(e=>{const pseudo=getComputedStyle(e,'::before'),b=e.getBoundingClientRect();return {h:b.height,w:b.width,top:parseFloat(pseudo.top),bottom:parseFloat(pseudo.bottom),color:pseudo.backgroundColor};});
   assert.equal(visual.h,44);assert.equal(visual.w,44);assert.equal(visual.top+visual.bottom,8);
   const singleLayer=el=>{const outer=getComputedStyle(el),inset=getComputedStyle(el,'::before');return {outer:outer.backgroundColor,edge:outer.borderTopColor,shadow:outer.boxShadow,inset:inset.backgroundColor,insetEdge:inset.borderTopColor};};
   const assertSingleLayer=async el=>{const layer=await el.evaluate(singleLayer);assert.equal(layer.outer,'rgba(0, 0, 0, 0)');assert.equal(layer.edge,'rgba(0, 0, 0, 0)');assert.equal(layer.shadow,'none');assert.notEqual(layer.inset,'rgba(0, 0, 0, 0)');assert.notEqual(layer.insetEdge,'rgba(0, 0, 0, 0)');};
   await assertSingleLayer(newNote);
   await assertSingleLayer(cards.nth(0).locator('.student-note-button'));
   if(width>=500){await newNote.hover();await assertSingleLayer(newNote);}
   await newNote.click({position:{x:22,y:2}});
   const perCard=p.locator('.student-note-dialog');assert.equal(await perCard.evaluate(e=>e.open),true);
   await p.keyboard.press('Escape');await perCard.waitFor({state:'detached'});
   await p.locator('#history-settings summary').click();
   const statsNotes=p.locator('#practice-stats-note-open');
   const dimensions=e=>{const s=getComputedStyle(e,'::before'),b=e.getBoundingClientRect();
     return {w:b.width,h:b.height,visibleHeight:b.height-parseFloat(s.top)-parseFloat(s.bottom),
       visibleWidth:b.width-parseFloat(s.left)-parseFloat(s.right),radius:s.borderRadius};};
   const noteSize=await newNote.evaluate(dimensions),overviewSize=await statsNotes.evaluate(dimensions);
   assert.equal(overviewSize.h,noteSize.h);assert.equal(overviewSize.visibleHeight,noteSize.visibleHeight);
   await assertSingleLayer(statsNotes);
   const dark=await p.locator('html').getAttribute('data-appearance')==='dark';
   for(const id of ['personal','classroom']){
     const actions=p.locator('#'+id+'-history-list .history-actions').first();
     const replay=actions.locator('.history-replay'),trash=actions.locator('.history-delete');
     assert.deepEqual(await replay.evaluate(dimensions),noteSize);
     await assertSingleLayer(replay);
     const checkTrash=async()=>{
       const v=await trash.evaluate(e=>{const s=getComputedStyle(e),svg=e.querySelector('svg'),b=e.getBoundingClientRect();return {w:b.width,h:b.height,border:s.borderTopWidth,bg:s.backgroundColor,shadow:s.boxShadow,color:getComputedStyle(svg).color,text:e.textContent.trim()};});
       assert.equal(v.w,44);assert.equal(v.h,44);assert.equal(v.border,'0px');
       assert.equal(v.bg,'rgba(0, 0, 0, 0)');assert.equal(v.shadow,'none');
       assert.equal(v.color,dark?'rgb(255, 157, 166)':'rgb(168, 49, 58)');assert.equal(v.text,'');
     };
     await checkTrash();
     if(width>=500){await trash.hover();await checkTrash();}
     await trash.focus();
     await p.keyboard.press('Tab');await p.keyboard.press('Shift+Tab');
     assert.equal(await trash.evaluate(e=>e.matches(':focus-visible')&&getComputedStyle(e).outlineStyle==='solid'),true);
     const dismissed=p.waitForEvent('dialog').then(async dialog=>{assert.equal(dialog.type(),'confirm');await dialog.dismiss();});
     await Promise.all([dismissed,trash.click()]);
     assert.equal(await actions.count(),1);
   }
   await statsNotes.click();
   const overview=p.locator('.practice-notes-overview');
   assert.ok((await overview.innerText()).includes('既有 C 練習'));
   await overview.getByRole('button',{name:'新增筆記',exact:true}).click();
   const picker=overview.getByRole('combobox',{name:'調性'}),textarea=overview.getByRole('textbox',{name:'練習筆記內容'});
   assert.equal(await overview.locator('input[type=search]').count(),0);
   assert.equal(await picker.evaluate(e=>e===document.activeElement&&e.nextElementSibling.tagName==='TEXTAREA'),true);
   assert.equal(await textarea.isDisabled(),true);
   assert.equal(await picker.locator('option').count(),24);
   assert.equal(await picker.locator('option[value="major-0"]').count(),0);
   await p.keyboard.press('ArrowDown');assert.equal(await picker.inputValue(),'major-1');
   await p.keyboard.press('Tab');assert.equal(await textarea.evaluate(e=>e===document.activeElement),true);
   await textarea.fill('新增 D♭ 練習');
   assert.equal(await picker.isDisabled(),true);
   await p.keyboard.press('Escape');assert.equal(await overview.evaluate(e=>e.open),true);
   assert.equal(await p.evaluate(()=>localStorage.getItem('daily-key-practice:experimental:key-note:major-1')),null);
   await overview.getByRole('button',{name:'儲存筆記',exact:true}).click();
   assert.ok((await overview.innerText()).includes('新增 D♭ 練習'));
   await overview.getByRole('button',{name:'關閉'}).click();await overview.waitFor({state:'detached'});
   assert.equal(await cards.nth(1).locator('.student-note-button').evaluate(e=>e.classList.contains('has-note')),true);
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0);
   assert.deepEqual(errors,[]);
}
async function extras(page,width){
 const q=s=>page.locator(s);
 // The dock's settings must be mutually exclusive and not start a microphone.
 const tuner=q('#tuner-settings'),metronome=q('#metro-settings');
 const layout=()=>page.evaluate(()=>[...document.querySelectorAll('.audio-tool-pair')].map(e=>e.offsetTop));
 assert.equal(new Set(await layout()).size,1);
 async function open(trigger){
  await trigger.click();
  const panel=q('#'+await trigger.getAttribute('aria-controls'));
  await panel.waitFor({state:'visible'});
  assert.equal(await trigger.getAttribute('aria-expanded'),'true');
  const t=await trigger.boundingBox(),p=await panel.boundingBox();
  const centered=Math.max(8,Math.min(t.x+t.width/2-p.width/2,width-p.width-8));
  assert.ok(Math.abs(p.x-centered)<3,JSON.stringify({trigger:await trigger.getAttribute('aria-controls'),p,centered}));
  return panel;
 }
 async function dismiss(panel,trigger){
  const focusable=panel.locator('input,button,select').first();
  if(await focusable.count())await focusable.focus();
  await page.keyboard.press('Escape');
  await panel.waitFor({state:'hidden'});
  assert.equal(await trigger.getAttribute('aria-expanded'),'false');
  assert.equal(await trigger.evaluate(e=>document.activeElement===e),true);
 }
 const tune=await open(tuner);
 assert.equal(await q('#tuner-open').getAttribute('aria-pressed'),'false');
 await dismiss(tune,tuner);
 const metro=await open(metronome);
 assert.equal(await tune.isVisible(),false);
 await dismiss(metro,metronome);
 const card=q('.key-card').first();
 if(await card.locator('.key-title').getAttribute('aria-expanded')!=='true')await card.locator('.key-title').click();
 for(const kind of ['scale','arpeggio']){
  const item=card.locator('.scale-practice[data-practice-kind="'+kind+'"]');
  const start=item.locator('.scale-start-chevron'),demo=item.locator('.scale-demo-chevron');
  const d=await open(demo);
  const a=await open(start);
  assert.equal(await d.isVisible(),false);
  const panes=a.locator('fieldset.launch-mode');
  for(const pane of await panes.all()){
   const radii=await pane.evaluate(e=>{
    const outer=parseFloat(getComputedStyle(e).borderTopLeftRadius);
    const labels=[...e.querySelectorAll('label span')];
    return {outer,children:labels.map(n=>parseFloat(getComputedStyle(n).borderTopLeftRadius))};
   });
   assert.ok(radii.outer>0&&radii.children.length===2&&radii.children.every(n=>n===radii.children[0]&&n<radii.outer));
  }
  await dismiss(a,start);
 }
 assert.equal(await q('#session-launch').evaluate(e=>e.getBoundingClientRect().width<=window.innerWidth),true);
}
(async()=>{
 const server=http.createServer((req,res)=>{
  const f=path.basename(new URL(req.url,'http://localhost').pathname)||'index.html';
  // The production experimental entry is mounted under a prefix; assets stay local.
  const name=f==='experimental'?'index.html':f;
  const allow=/^(index\.html|fingerboard(?:-editor)?\.js|fingering-presets\.js|classroom\.js|firebase-config\.js|metronome-worklet\.js)$/;
  if(!allow.test(name)||!fs.existsSync(path.join(root,name))){res.statusCode=404;return res.end();}
  res.setHeader('content-type',name.endsWith('.js')?'text/javascript':'text/html');res.end(fs.readFileSync(path.join(root,name)));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;
 const base='http://127.0.0.1:'+server.address().port;
 try{
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{})});
  for(const [width,dark] of viewports){
   for(const [kind,resume] of [['layout',false],['layout',true],['notes',true]]){
    const page=await browser.newPage({viewport:{width,height:850},isMobile:width<500,hasTouch:width<500,reducedMotion:'reduce'});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
    await seed(page,{resume,notes:kind==='notes'});
    await page.goto(base+'/experimental/');
    if(dark&&kind==='notes')await page.locator('#appearance-toggle').click();
    if(kind==='notes'){await noteCheck(page,width,errors);await extras(page,width);}
    else await modeCheck(page,width,dark,resume);
    assert.deepEqual(errors,[]);
    await page.close();
    console.log(JSON.stringify({kind,width,dark,resume,passed:true}));
   }
  }
 }finally{await browser?.close();await new Promise(res=>server.close(res));}
})().catch(e=>{console.error(e);process.exitCode=1});
