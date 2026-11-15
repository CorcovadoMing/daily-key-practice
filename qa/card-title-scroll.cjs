// Existing Playwright only; isolated local fixture, no service writes.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),a=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true});try{
 for(const width of[320,390,768,1440])for(const reducedMotion of['no-preference','reduce']){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion});
  await page.route('**/classroom.js*',r=>r.abort());await page.route('**/firebasejs/**',r=>r.abort());
  await page.addInitScript(()=>{window.scrollCalls=[];const original=HTMLElement.prototype.scrollIntoView;HTMLElement.prototype.scrollIntoView=function(options){window.scrollCalls.push({title:this.classList.contains('key-title'),card:this.classList.contains('key-card'),options});return original.call(this,options)}});
  await page.goto(process.env.URL||'http://127.0.0.1:8799');
  await page.evaluate(()=>DailyKeyPractice.setClassroomRoom('local-qa',{createdAt:1,majorIds:[0,1,2],minorIds:[0],doneIds:[],preferences:{majorCount:3,minorCount:1},session:{date:'2026-11-15',createdAt:1,majorIds:[0,1,2],minorIds:[0],doneIds:[]}}));
  await page.waitForTimeout(100);a.equal(await page.evaluate(()=>scrollCalls.length),0,'restored initial state must not scroll');
  const title=page.locator('.key-card[data-key-id="major-2"] .key-title');await title.click();
  await page.waitForFunction(()=>scrollCalls.some(c=>c.title));await page.waitForTimeout(800);
  const opened=await title.evaluate(el=>({top:el.getBoundingClientRect().top,open:el.getAttribute('aria-expanded'),margin:parseFloat(getComputedStyle(el).scrollMarginTop)}));
  a.equal(opened.open,'true');a.ok(Math.abs(opened.top-opened.margin)<3,JSON.stringify({width,reducedMotion,opened}));
  a.equal(await page.evaluate(()=>scrollCalls.filter(c=>c.title).at(-1).options.behavior),reducedMotion==='reduce'?'auto':'smooth');
  await page.evaluate(()=>scrollCalls=[]);await title.click();await page.waitForTimeout(650);a.equal(await page.evaluate(()=>scrollCalls.length),0,'closing must not force scroll');
  // Open and immediately close: stale animation/layout callback must not jump.
  await title.evaluate(el=>{el.click();el.click()});await page.waitForTimeout(650);a.equal(await page.evaluate(()=>scrollCalls.length),0,'rapid close');
  // Native note dialog opened while panel is settling prevents a late jump.
  await title.evaluate(el=>{el.click();el.closest('.key-card').querySelector('.student-note-button').click()});await page.waitForTimeout(650);
  a.equal(await page.evaluate(()=>scrollCalls.filter(c=>c.title).length),0,'modal must not be displaced');
  await page.evaluate(()=>document.querySelector('dialog[open]').close());
  await title.evaluate(el=>{if(el.getAttribute('aria-expanded')==='true')el.click();window.scrollCalls=[];el.click();window.dispatchEvent(new WheelEvent('wheel'));});
  await page.waitForTimeout(650);a.equal(await page.evaluate(()=>scrollCalls.some(c=>c.title)),false,'user wheel supersedes pending alignment');
  await page.evaluate(()=>scrollCalls=[]);
  await page.locator('#bottom-practice-nav .practice-jump').first().evaluate(el=>el.click());await page.waitForTimeout(700);
  a.ok(await page.evaluate(()=>scrollCalls.some(c=>c.card)),'existing direct jump');a.equal(await page.evaluate(()=>scrollCalls.some(c=>c.title)),false);
  a.equal(await page.evaluate(()=>document.activeElement.classList.contains('key-title')),true,'direct jump focus');
  a.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  console.log(JSON.stringify({width,reducedMotion,titleTop:opened.top,margin:opened.margin,initial:true,collapse:true,rapid:true,modal:true,direct:true,overflow:false}));
  await page.close();
 }
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
