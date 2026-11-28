const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const { strict: assert } = require('node:assert');
const { createServer } = require('node:http'), { readFileSync } = require('node:fs'), { join } = require('node:path');
module.exports=(async () => {
 const srv=createServer((req,res)=>{
  const rel=new URL(req.url,'http://localhost').pathname.replace(/^\/experimental\//,'')||'index.html';
  try{const file=join(process.cwd(),rel);const mime=file.endsWith('.js')?'text/javascript':'text/html';res.setHeader('content-type',mime);res.end(readFileSync(file));}
  catch{res.writeHead(404);res.end();}
 });
 await new Promise(r=>srv.listen(0,'127.0.0.1',r));let b;
 try{
  b=await chromium.launch({headless:true,...(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{}),args:['--autoplay-policy=no-user-gesture-required']});
  for(const width of [320,390,768,1280])for(const dark of [false,true]){
   const p=await b.newPage({viewport:{width,height:780},reducedMotion:'reduce',colorScheme:dark?'dark':'light'});
   await p.addInitScript(()=>{
    navigator.mediaDevices.getUserMedia=()=>new Promise(resolve=>window.allowMic=()=>{
      const c=new AudioContext(),d=c.createMediaStreamDestination(),o=c.createOscillator(),g=c.createGain();
      o.frequency.value=442;g.gain.value=0;o.connect(g).connect(d);o.start();c.resume();
      window.signal=value=>{g.gain.value=value;};resolve(d.stream);
    });
   });
   const origin='http://127.0.0.1:'+srv.address().port;
   await p.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
   await p.goto(origin+'/experimental/',{waitUntil:'domcontentloaded'});
   const root=p.locator('html');if((await root.getAttribute('data-appearance')==='dark')!==dark)await p.locator('#appearance-toggle').click();
   assert.equal(await root.getAttribute('data-appearance')==='dark',dark);
   const ensure=async(state)=>p.waitForFunction(s=>document.querySelector('#tuner-panel').dataset.feedback===s,state);
   const hit=await p.locator('.audio-buttons button').evaluateAll(bs=>bs.map(x=>{
    const r=x.getBoundingClientRect();return {id:x.id,x:r.x,right:r.right,w:r.width,h:r.height};
   }));
   assert.equal(hit.length,4);hit.forEach((x,j)=>{assert.equal(x.w,width<=480&&x.id.endsWith('-settings')?30:44,JSON.stringify(x));assert.ok(x.h>=44,JSON.stringify(x));if(j)assert.ok(hit[j-1].right<=x.x);});
   const open=p.locator('#tuner-open'),settings=p.locator('#tuner-settings'),metro=p.locator('#metro-settings'),panel=p.locator('#tuner-panel');
   await metro.click();assert.ok(await p.locator('#metronome-panel').isVisible());await p.keyboard.press('Escape');
   await settings.click();assert.ok(await p.locator('#tuner-preferences').isVisible());await p.keyboard.press('Escape');
   assert.equal(await settings.evaluate(e=>document.activeElement===e),true);
   await p.locator('#mode-settings-toggle').click();
   await p.locator('#tuner-detector input[value=existing]').check();
   await open.click();await ensure('permission');await p.evaluate(()=>window.allowMic());await ensure('listening');
   assert.equal(await p.locator('#tuner-state').textContent(),'等待音高');
   const meter=await p.locator('#tuner-meter').boundingBox();
   assert.ok(meter.width>=(width===320?106:width===390?156:70)&&meter.x>=hit.at(-1).right&&meter.x+meter.width<=width,JSON.stringify({width,hit,meter}));
   await p.evaluate(()=>signal(.08));await ensure('live');
   const ticks=await panel.locator('.audio-scale span').evaluateAll(items=>items.map(el=>{
    const r=document.createRange();r.selectNodeContents(el);const box=r.getBoundingClientRect();
    return {l:box.left,r:box.right,y:box.top,visible:getComputedStyle(el).visibility==='visible'};
   }));
   assert.equal(ticks.length,4);assert.ok(ticks.every((t,j)=>t.visible&&t.y===ticks[0].y&&(!j||ticks[j-1].r<=t.l)),JSON.stringify(ticks));
   await p.evaluate(()=>signal(0));await ensure('held');
   assert.equal(await p.locator('#tuner-state').textContent(),'保留上次讀數');
   assert.notEqual(await p.locator('#tuner-note').textContent(),'—');
   await p.evaluate(()=>signal(.08));await ensure('live');
   await open.click();await ensure('idle');assert.equal(await panel.isVisible(),false);
   console.log(width,dark?'dark':'light', '44×44; meter',Math.round(meter.width),'status/hold/resume/focus passed');
   await p.close();
  }
 }finally{await b?.close();srv.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
