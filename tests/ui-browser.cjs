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
   assert.equal(await p.locator('#practice-heat-title').innerText(),'練習天數');
   const legend=p.getByRole('group',{name:'完成調性個數'});
   const legendLayout=await legend.evaluate(e=>({tops:[...e.children].map(x=>x.offsetTop),items:[...e.children].map(x=>x.textContent),width:e.clientWidth,scroll:e.scrollWidth,
     labelBottom:e.previousElementSibling.getBoundingClientRect().bottom,top:e.getBoundingClientRect().top}));
   assert.deepEqual(legendLayout.items,['0','1','2','3–4','5+']);
   assert.equal(new Set(legendLayout.tops).size,1);
   assert.equal(legendLayout.width,legendLayout.scroll);
   assert.ok(legendLayout.labelBottom<=legendLayout.top);
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
     if((await replay.getAttribute('aria-label')).startsWith('繼續')){
       assert.equal(await replay.innerText(),'');
       assert.equal(await replay.locator('.history-resume-icon[aria-hidden=true]').count(),1);
     }else{
       assert.equal(await replay.innerText(),'重練');
     }
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
   const noteKey='daily-key-practice:experimental:key-note:major-0';
   async function checkNoteClear(dialog){
      const clear=dialog.getByRole('button',{name:'清空',exact:true});
      const cancel=dialog.getByRole('button',{name:'取消',exact:true}),save=dialog.getByRole('button',{name:'儲存筆記',exact:true});
      const paint=await clear.evaluate(e=>{
        const s=getComputedStyle(e),r=e.getBoundingClientRect();
        return {x:r.x,w:r.width,h:r.height,color:s.color,text:e.innerText};
      });
      assert.equal(paint.text,'清空');
      assert.equal(await clear.locator('svg').count(),0);
      assert.equal(paint.color,dark?'rgb(255, 157, 166)':'rgb(168, 49, 58)');
      assert.ok(paint.w>=44&&paint.h>=44);
      assert.ok(paint.x+paint.w<(await cancel.boundingBox()).x);
      assert.ok((await cancel.boundingBox()).x<(await save.boundingBox()).x);
      await clear.click();
      assert.equal(await dialog.locator('textarea').inputValue(),'');
      assert.equal(await p.evaluate(k=>localStorage.getItem(k),noteKey),'既有 C 練習');
      await cancel.click();
   }
   await cards.first().locator('.student-note-button').click();
   await checkNoteClear(p.locator('.student-note-dialog:not(.practice-notes-overview)'));
   await p.locator('.student-note-dialog:not(.practice-notes-overview)').waitFor({state:'detached'});
   await statsNotes.click();
   const overview=p.locator('.practice-notes-overview');
   assert.ok((await overview.innerText()).includes('既有 C 練習'));
   const close=overview.getByRole('button',{name:'關閉',exact:true});
   assert.equal(await close.innerText(),'');
   assert.deepEqual(await close.evaluate(e=>[getComputedStyle(e,'::before').content,getComputedStyle(e,'::after').content]),['""','""']);
   await overview.getByRole('button',{name:'編輯 C 大調 筆記',exact:true}).click();
   await checkNoteClear(overview);
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
async function adviceOrderCheck(page){
 const root=page.locator('#advice-test-cards');
 await page.evaluate(()=>{
   const history=window.CelloPracticeHistory,scale=window.CelloScalePractice;
   const mount=document.createElement('div');mount.id='advice-test-cards';
   document.body.append(mount);
   for(const [kind,expected] of [['scale',['上行','下行','運弓建議']],['arpeggio',['下行','運弓建議']]]){
     const target=[{midi:36,name:'C',octave:2},{midi:38,name:'D',octave:2},{midi:36,name:'C',octave:2}];
     const scope='browser-advice-'+kind, key=history.keyFor(scope,kind,target);
     // Deliberately use reverse order from a legacy saved report.
     const issues=['下行：C，偏低最多 21¢。','下行：C，量到的前段較接近零線，後段偏低。'];
     if(expected.includes('上行'))issues.push('上行：D，偏高最多 19¢。');
     const written=history.saveKeyDraft(localStorage,key,{id:history.newDraftId(),mode:'single',values:[0,19,-21],laps:0,passed:0,progress:3,pending:false,
        advice:{issues,drills:['下行：拿「下行：C」做一弓長音練習：保持弓速。','下行：聽上一音再對準 C。']}});
     if(!written.ok||!written.adviceSaved)throw Error('Advice fixture was not saved: '+JSON.stringify(written));
     mount.append(scale.card(document.createElement('div'),target,()=>{},kind,scope).element);
   }
 });
 for(const [kind,headings] of [['scale',['上行','下行','運弓建議']],['arpeggio',['下行','運弓建議']]]){
   const result=root.locator('[data-practice-kind="'+kind+'"] .scale-practice-local-coach');
   assert.deepEqual(await result.locator('.scale-practice-coach-phase > h4').allTextContents(),headings);
   const bow=result.locator('.scale-practice-coach-phase').last();
   assert.match(await bow.innerText(),/後段偏低[\s\S]*一弓長音/);
   assert.doesNotMatch(await bow.innerText(),/偏低最多|對準 C/);
   const paint=await result.evaluate(e=>{
      const color=n=>getComputedStyle(n).color;
      return {dark:document.documentElement.dataset.appearance==='dark', drills:[...e.querySelectorAll('.scale-practice-coach-drill, .scale-practice-coach-drill li')].map(color),
        observation:color(e.querySelector('ul.scale-practice-coach-steps li')),caution:color(e.querySelector('.practice-advice-caution')),
        contrastBackground:getComputedStyle(e).backgroundColor};
   });
   const blue=paint.dark?'rgb(168, 203, 255)':'rgb(36, 93, 170)';
   assert.ok(paint.drills.length>=6);
   assert.ok(paint.drills.every(c=>c===blue));
   assert.notEqual(paint.observation,blue);
   assert.notEqual(paint.caution,blue);
   const luminance=c=>c.match(/\d+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
   const v=[luminance(blue),luminance(paint.contrastBackground)].sort((a,b)=>b-a);
   assert.ok((v[0]+.05)/(v[1]+.05)>=4.5);

 }
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
async function segmentMotionCheck(page,reduced){
 await page.locator('#mode-settings-toggle').press('Space');
 await page.waitForFunction(()=>!document.querySelector('#mode-settings').hasAttribute('data-animating'));
 const track=page.locator('fieldset').filter({has:page.locator('input[name=launch-mode]')});
 const result=await track.evaluate(async (e,reduce)=>{
   const fields=[...e.querySelectorAll('input')],layout=()=>[e.offsetWidth,e.offsetHeight,...fields.map(x=>x.parentElement.offsetWidth)];
   const paint=()=>{
     const css=getComputedStyle(e,'::before'),scale=css.scale==='none'?[1,1]:css.scale.split(' ').map(Number);
     return {travel:Number(css.getPropertyValue('--segment-travel')),x:scale[0],y:scale[1]??scale[0],translate:css.translate,transition:css.transitionProperty};
   };
   const run=async i=>{
     const start=paint(); fields[i].click();
     const samples=[paint()];
     if(!reduce){
       const until=performance.now()+510;
       while(performance.now()<until){await new Promise(requestAnimationFrame);samples.push(paint());}
     }
     return {start,samples,end:samples.at(-1),checked:fields[i].checked};
   };
   const before=layout(),forward=await run(1),back=await run(0);
   return {before,after:layout(),forward,back};
 },reduced);
 assert.deepEqual(result.before,result.after,'segment deformation cannot resize either label or track');
 assert.ok(result.forward.checked&&result.back.checked);
 const {forward,back}=result;
 if(reduced){
   assert.equal(forward.end.translate,'100%');assert.equal(back.end.translate,'none');
   assert.equal(forward.end.x,1);assert.equal(back.end.x,1);
   return;
 }
 for(const [direction,from,to] of [[forward,0,1],[back,1,0]]){
   assert.equal(direction.start.travel,from);
   assert.equal(direction.end.travel,to);
   assert.equal(direction.end.x,1);assert.equal(direction.end.y,1);
   assert.ok(direction.samples.some(s=>s.travel>.3&&s.travel<.75&&s.x>1.12&&s.y<.94),'thumb stretches and narrows between the two options');
   const travels=direction.samples.map(s=>s.travel);
   assert.ok(travels.every((x,i)=>x>=0&&x<=1&&(!i||(x-travels[i-1])*(to-from)>=-.001)),'thumb does not shake or overshoot');
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
 assert.ok(await summary.evaluate(e=>e.getAnimations().length===0&&['none','1'].includes(getComputedStyle(e).scale)));
 await page.waitForFunction(()=>document.querySelector('#history-settings').getAnimations().length===0);
 assert.ok(await details.evaluate(e=>e.open&&e.offsetHeight>40));
 await summary.press('Space');
 assert.equal(await heightMotion(),480);
 assert.ok(await summary.evaluate(e=>e.getAnimations().length===0&&['none','1'].includes(getComputedStyle(e).scale)));
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
    await segmentMotionCheck(page,reduced);
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
    await adviceOrderCheck(page);
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({kind:'result-button',width,dark,passed:true}));
    await page.close();
   }
 }finally{await browser?.close();await new Promise(res=>server.close(res));}
})().catch(e=>{console.error(e);process.exitCode=1});
