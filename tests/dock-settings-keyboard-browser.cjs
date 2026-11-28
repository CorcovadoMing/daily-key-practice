const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
module.exports=(async()=>{
  const server=createServer((req,res)=>{
    const file=join(process.cwd(),new URL(req.url,'http://localhost').pathname.replace(/^\/experimental\//,'')||'index.html');
    try{res.setHeader('content-type',file.endsWith('.js')?'text/javascript':'text/html');res.end(readFileSync(file));}
    catch{res.writeHead(404);res.end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  let browser;
  try{
    browser=await chromium.launch({headless:true,...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{})});
    const origin='http://127.0.0.1:'+server.address().port;
    const mode=process.argv[2];
    for(const [width,height] of [[320,700],[390,844],[568,256],[768,1024],[1280,800]])for(const colorScheme of ['light','dark']){
      const page=await browser.newPage({viewport:{width,height},colorScheme,reducedMotion:'reduce'});
      await page.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
      await page.goto(origin+'/experimental/',{waitUntil:'domcontentloaded'});
      if((await page.locator('html').getAttribute('data-appearance')==='dark')!==(colorScheme==='dark'))await page.locator('#appearance-toggle').click();
      const focus=()=>page.evaluate(()=>document.activeElement.id);
      for(const [trigger,field,panel,next] of [['metro-settings','metro-bpm','metronome-panel','metro-slider'],['tuner-settings','tuner-a','tuner-preferences',null]]){
        const button=page.locator('#'+trigger), popup=page.locator('#'+panel);
        await button.focus();
        await page.keyboard.press('Enter');
        assert.ok(await popup.isVisible());
        const entered=await focus();
        if(mode!=='measure'){
          const input=page.locator('#'+field),oldValue=+(await input.inputValue());
          await page.keyboard.press('ArrowUp');
          assert.equal(+(await input.inputValue()),oldValue+1);
        }
        await page.keyboard.press('Tab');
        const tab=await focus();
        await page.keyboard.press('Escape');
        assert.equal(await popup.isVisible(),false);
        assert.equal(await focus(),trigger);
        await button.click();
        assert.notEqual(await focus(),field,'Touch/pointer opening should not summon a numeric keyboard.');
        const boxes=await popup.boundingBox();
        assert.ok(boxes.y>=0 && boxes.x>=0 && boxes.x+boxes.width<=width);
        await page.mouse.click(width-4,4);
        assert.equal(await popup.isVisible(),false);
        await button.focus();
        await page.keyboard.press('Space');
        assert.ok(await popup.isVisible());
        if(mode!=='measure')assert.equal(await focus(),field);
        await page.keyboard.press('Escape');
        assert.equal(await focus(),trigger);
        console.log(width,height,colorScheme,trigger,entered,tab);
        if(mode!=='measure'){
          assert.equal(entered,field);
          if(next)assert.equal(tab,next);
        }
      }
      await page.close();
    }
  }finally{await browser?.close();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
