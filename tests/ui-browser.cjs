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
async function redrawCheck(page,mode){
  const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('daily-key-practice:experimental:v1')));
  const draw=page.locator('#draw-button'),resume=page.locator('#launch-resume');
  if(mode==='sequential'){
    await page.locator('#mode-settings-toggle').click();
    await page.locator('input[name="launch-mode"][value="sequential"]').check();
  }
  const before=await saved(),original=before.personalHistory;
  assert.ok(original.length>0);
  assert.match(await draw.innerText(),/重新抽選/);
  await resume.click();
  assert.deepEqual((await saved()).personalHistory,original,'continuing is not a new record');
  for(let i=1;i<=2;i++){
    await draw.click();
    assert.equal(await page.locator('dialog[open]').count(),0);
    const after=await saved(),latest=after.personalHistory.at(-1);
    assert.equal(after.personalHistory.length,original.length+i);
    assert.deepEqual(after.personalHistory.slice(0,original.length),original,'keep old keys, identity and progress');
    assert.equal(new Set(after.personalHistory.map(r=>r.id)).size,after.personalHistory.length);
    assert.deepEqual(latest.doneIds,[]);
    assert.equal(after.sessions[latest.date].historyId,latest.id);
    assert.equal(latest.sequenceMode,mode==='sequential'?'signature':undefined);
  }
  const expected=(await saved()).personalHistory;
  await page.reload();
  assert.deepEqual((await saved()).personalHistory,expected,'reload keeps all separately saved draws');
}
async function checkCompletion(page,reduced){
  const card=page.locator('.key-card[data-key-id="major-0"]');
  const button=card.locator('.key-complete'),glyph=button.locator('.completion-glyph');
  const rect=()=>card.evaluate(e=>{const p=e.getBoundingClientRect();return [p.x,p.width,p.height];});
  const animations=()=>button.evaluate(b=>b.getAnimations({subtree:true}).map(a=>a.animationName).filter(x=>x?.startsWith('completion-')).sort());
  assert.equal(await button.getAttribute('aria-pressed'),'false');
  assert.equal(await glyph.evaluate(e=>getComputedStyle(e).visibility),'hidden');
  assert.deepEqual(await animations(),[]);
  await button.focus();
  const initial=await rect();
  await button.press('Space');
  assert.equal(await button.getAttribute('aria-pressed'),'true');
  assert.equal(await glyph.evaluate(e=>getComputedStyle(e).visibility),'visible');
  assert.deepEqual(await animations(),reduced?[]:['completion-circle','completion-stroke']);
  assert.deepEqual(await rect(),initial,'completion must not move or resize its card');
  await button.press('Space');
  assert.equal(await button.getAttribute('aria-pressed'),'false');
  assert.deepEqual(await animations(),[]);
  assert.equal(await glyph.evaluate(e=>getComputedStyle(e).visibility),'hidden');
  await button.press('Space');
  assert.deepEqual(await animations(),reduced?[]:['completion-circle','completion-stroke']);
  await page.waitForFunction(()=>!document.querySelector('.key-complete[data-check-motion]'));
  assert.equal(await glyph.evaluate(e=>getComputedStyle(e).visibility),'visible');
  assert.deepEqual(await rect(),initial);
  await page.reload();
  assert.equal(await button.getAttribute('aria-pressed'),'true');
  assert.equal(await glyph.evaluate(e=>getComputedStyle(e).visibility),'visible');
  assert.deepEqual(await animations(),[],'restoring an already-complete key does not replay the effect');
}
async function resultButtonCheck(page){
 const first=page.locator('.key-card').first();
 await first.locator('.key-title').click();
 const unloadAllowed=()=>page.evaluate(()=>window.dispatchEvent(new Event('beforeunload',{cancelable:true})));
 assert.equal(await unloadAllowed(),true);
 assert.doesNotMatch(await page.locator('meta[name=viewport]').getAttribute('content'),/maximum-scale|user-scalable/);
 for(const kind of ['scale','arpeggio']){
  const view=first.locator('.scale-practice[data-practice-kind="'+kind+'"]'),button=view.locator('.scale-practice-button');
  const observe=()=>button.evaluate(e=>{
   const a=getComputedStyle(e),s=e.parentElement,r=e.getBoundingClientRect();
   return {x:e.offsetLeft,y:e.offsetTop,w:r.width,h:r.height,group:s.offsetWidth,color:a.color,background:a.backgroundColor};
  });
  const phase=name=>view.evaluate((e,n)=>e.dataset.phase===n,name);
  const expectPhase=async n=>{for(let t=0;t<150;t++){if(await phase(n))return;await page.waitForTimeout(20);}assert.fail('Missing phase '+n);};
  await button.focus();
  const idle=await observe();
  assert.equal((await button.innerText()).trim(),'開始練習');
  await button.press('Space');
  await expectPhase('pending');
  assert.equal((await button.innerText()).trim(),'取消收音');
  assert.equal(await unloadAllowed(),false);
  assert.deepEqual(await observe(),idle);
  await page.evaluate(()=>window.releaseSimulatedMic());
  await expectPhase('listening');
  assert.equal((await button.innerText()).trim(),'觀看結果');
  assert.match(await button.getAttribute('aria-label'),/^觀看結果/);
  assert.equal(await button.getAttribute('aria-pressed'),'true');
  assert.equal(await unloadAllowed(),false);
  assert.equal(await button.evaluate(e=>getComputedStyle(e).touchAction),'manipulation');
  assert.equal(await page.locator('html').evaluate(e=>getComputedStyle(e).overscrollBehaviorY),'contain');
  assert.deepEqual(await observe(),idle);
  assert.equal(await view.locator('.scale-start-chevron').isDisabled(),true);
  await button.press('Space');
  await expectPhase('idle');
  assert.equal(await unloadAllowed(),true);
  assert.equal((await button.innerText()).trim(),'開始練習');
  assert.equal(await button.evaluate(e=>e===document.activeElement),true);
  assert.deepEqual(await observe(),idle);
 }
}
async function surfaceMotionCheck(page){
 const button=page.locator('#tuner-settings'),panel=page.locator('#tuner-preferences');
 await button.press('Space');
 assert.equal(await button.getAttribute('aria-expanded'),'true');
 const motion=()=>panel.evaluate(e=>e.getAnimations().map(a=>[a.transitionProperty,a.effect.getTiming().duration,a.effect.getTiming().easing]));
 const spring=entries=>entries.some(([p,,e])=>p==='scale'&&e==='cubic-bezier(0.2, 0.82, 0.26, 1.32)');
 assert.ok(spring(await motion()),'popover should use shared spring on opening');
 await page.waitForFunction(()=>document.querySelector('#tuner-preferences').getAnimations().length===0);
 assert.equal(await panel.evaluate(e=>getComputedStyle(e).scale),'1');
 await page.keyboard.press('Escape');
 assert.equal(await button.getAttribute('aria-expanded'),'false');
 assert.ok(spring(await motion()),'popover should spring on closing too');
 await panel.waitFor({state:'hidden'});
 const summary=page.locator('#history-settings summary'),details=page.locator('#history-settings');
 const heightMotion=()=>details.evaluate(e=>e.getAnimations().find(a=>a.effect.getKeyframes()[0].height)?.effect.getTiming().duration);
 const closed=await details.evaluate(e=>e.offsetHeight);
 await summary.press('Space');
 assert.equal(await heightMotion(),480);
 assert.ok(await summary.evaluate(e=>e.getAnimations().some(a=>a.id==='practice-fold-feedback')));
 await page.waitForFunction(()=>document.querySelector('#history-settings').getAnimations().length===0);
 assert.ok(await details.evaluate(e=>e.open&&e.offsetHeight>40));
 await summary.press('Space');
 assert.equal(await heightMotion(),480);
 assert.ok(await summary.evaluate(e=>e.getAnimations().some(a=>a.id==='practice-fold-feedback')));
 await page.waitForFunction(()=>!document.querySelector('#history-settings').open);
 assert.equal(await details.evaluate(e=>e.offsetHeight),closed);
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
 const card=q('.key-card').first(),arrow=card.locator('.key-expand');
 const checkArrow=async()=>{
  const a=await arrow.evaluate(e=>{const s=getComputedStyle(e);return [e.offsetWidth,e.offsetHeight,s.backgroundColor,s.borderTopWidth,s.boxShadow,s.webkitTapHighlightColor,getComputedStyle(e,'::before').content];});
  assert.deepEqual(a,[44,44,'rgba(0, 0, 0, 0)','0px','none','rgba(0, 0, 0, 0)','none']);
 };
 if(await arrow.getAttribute('aria-expanded')==='true')await arrow.press('Space');
 await checkArrow();
 await arrow.press('Space');
 assert.equal(await arrow.getAttribute('aria-expanded'),'true');
 await checkArrow();
 if(width>=500){
  await arrow.hover();await checkArrow();
  await page.mouse.down();try{await checkArrow();}finally{await page.mouse.up();}
  assert.equal(await arrow.getAttribute('aria-expanded'),'false');
  await arrow.press('Space');
 }
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
  browser=await chromium.launch({headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'],...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{})});
  for(const [width,dark] of viewports){
   for(const [kind,resume] of [['layout',false],['layout',true],['notes',true]]){
    const page=await browser.newPage({viewport:{width,height:850},isMobile:width<500,hasTouch:width<500,reducedMotion:'reduce'});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
    await seed(page,{resume,notes:kind==='notes'});
    await page.goto(base+'/experimental/');
    if(dark&&kind==='notes')await page.locator('#appearance-toggle').click();
    if(kind==='notes'){await noteCheck(page,width,errors);await extras(page,width);await redrawCheck(page,dark?'sequential':'random');}
    else await modeCheck(page,width,dark,resume);
    assert.deepEqual(errors,[]);
    await page.close();
    console.log(JSON.stringify({kind,width,dark,resume,passed:true}));
   }
  }
   for(const [width,dark,reduced] of [[390,true,false],[768,false,true],[1280,false,false]]){
    const page=await browser.newPage({viewport:{width,height:850},isMobile:width<500,hasTouch:width<500,reducedMotion:reduced?'reduce':'no-preference'});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
    await seed(page,{resume:true,notes:false});
    await page.goto(base+'/experimental/');
    if(dark)await page.locator('#appearance-toggle').click();
    await checkCompletion(page,reduced);
    if(width===390)await surfaceMotionCheck(page);
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({kind:'completion',width,dark,reduced,passed:true}));
    await page.close();
   }
   for(const [width,dark] of [[320,false],[390,true],[768,false],[1280,true]]){
    const page=await browser.newPage({viewport:{width,height:850},isMobile:width<500,hasTouch:width<500,reducedMotion:'reduce'});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
    await seed(page,{resume:true,notes:false});
    await page.addInitScript(()=>{
      const media=navigator.mediaDevices,original=media.getUserMedia.bind(media);
      media.getUserMedia=options=>new Promise((resolve,reject)=>{
        window.releaseSimulatedMic=()=>original(options).then(resolve,reject);
      });
    });
    await page.goto(base+'/experimental/');
    if(dark)await page.locator('#appearance-toggle').click();
    await resultButtonCheck(page);
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({kind:'result-button',width,dark,passed:true}));
    await page.close();
   }
 }finally{await browser?.close();await new Promise(res=>server.close(res));}
})().catch(e=>{console.error(e);process.exitCode=1});
