const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const {createServer}=require('node:http'),{readFileSync}=require('node:fs'),assert=require('node:assert/strict');
const root=process.cwd();
module.exports=(async()=>{
 const server=createServer((req,res)=>{
  const file=new URL(req.url,'http://test').pathname.replace(/^\/experimental\//,'')||'index.html';
  try{
   if(!/^(?:index\.html|fingerboard(?:-editor)?\.js|fingering-presets\.js|classroom\.js|firebase-config\.js|metronome-worklet\.js)$/.test(file))throw Error('Unsupported test route');
   const content=readFileSync(root+'/'+file);
   res.setHeader('content-type',file.endsWith('.js')?'text/javascript':'text/html');
   res.end(content);
  }catch{res.writeHead(404).end();}
 });
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 let browser;
 try{
  browser=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});
  const host='http://127.0.0.1:'+server.address().port;
  for(const [width,height] of [[320,820],[390,844],[768,1024],[1280,850]])for(const textSize of [100,200])for(const colorScheme of ['light','dark']){
   const touch=width<500;
   const page=await browser.newPage({viewport:{width,height},isMobile:touch,hasTouch:touch,colorScheme,reducedMotion:'reduce'});
   try{
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.route('**/*',r=>r.request().url().startsWith(host+'/')?r.continue():r.abort());
    await page.goto(host+'/experimental/',{waitUntil:'domcontentloaded'});
    if((await page.locator('html').getAttribute('data-appearance')==='dark')!==(colorScheme==='dark'))await page.locator('#appearance-toggle').click();
    if(textSize===200)await page.addStyleTag({content:'html{font-size:200%!important}'});
    const activate=locator=>touch?locator.tap():locator.click();
    const history=page.locator('#history-settings'),heat=page.locator('#practice-heat-grid');
    await activate(history.locator(':scope > summary'));
    assert.notEqual(await history.getAttribute('open'),null);
    await heat.locator('[aria-current=date]').waitFor({state:'visible'});
    await page.evaluate(()=>new Promise(ok=>requestAnimationFrame(()=>requestAnimationFrame(ok))));
    const layout=await page.evaluate(()=>{
     const heat=document.querySelector('#practice-heat-grid');
     const trigger=document.querySelector('#metro-settings'),r=trigger.getBoundingClientRect(),v=visualViewport;
     return {root:document.documentElement.scrollWidth,inner:innerWidth,visibleWidth:v.width,visibleHeight:v.height,
      dockBottom:r.bottom,dockHit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('#metro-settings')===trigger,
      heatClient:heat.clientWidth,heatScroll:heat.scrollWidth};
    });
    console.log(JSON.stringify({kind:'history-heat-reflow',width,height,textSize,colorScheme,...layout}));
    assert.equal(layout.root,width,'an internal calendar must not widen the page');
    assert.equal(layout.inner,width);assert.equal(layout.visibleWidth,width);
    assert.ok(layout.dockBottom<=layout.visibleHeight&&layout.dockHit,'metronome remains hittable with history open');
    assert.equal(await heat.getByRole('listitem').count(),84);
    assert.match(await heat.locator('[aria-current=date]').ariaSnapshot(),/完成 \d+ 調/);
    assert.equal((await page.locator('.practice-heat-legend').textContent()).replace(/\s/g,''),'0123–45+');
    if(width===320&&textSize===200)assert.ok(layout.heatScroll>layout.heatClient,'narrow calendar keeps its own scroll area');
    if(layout.heatScroll>layout.heatClient){
     await heat.focus();
     await page.keyboard.press('ArrowRight');
     await page.waitForFunction(()=>document.querySelector('#practice-heat-grid').scrollLeft>0,{},{timeout:2500});
     assert.equal(await page.evaluate(()=>window.scrollX),0);
    }
    const metro=page.locator('#metro-settings');
    await activate(metro);
    assert.equal(await metro.getAttribute('aria-expanded'),'true');
    await page.keyboard.press('Escape');
    assert.equal(await metro.getAttribute('aria-expanded'),'false');
    assert.deepEqual(errors,[]);
   }finally{await page.close();}
  }
 }finally{await browser?.close();await new Promise(ok=>server.close(ok));}
})();
if(require.main===module)module.exports.catch(error=>{console.error(error);process.exitCode=1;});
