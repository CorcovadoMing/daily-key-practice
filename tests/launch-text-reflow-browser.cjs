const { chromium }=require(process.env.PLAYWRIGHT_PATH||'playwright'),{createServer}=require('node:http'),{readFileSync}=require('node:fs');
const dir=process.cwd();
module.exports=(async()=>{const server=createServer((req,res)=>{const path=new URL(req.url,'http://test').pathname.replace(/^\/experimental\//,'')||'index.html';try{if(!/^(?:index\.html|fingerboard(?:-editor)?\.js|fingering-presets\.js|classroom\.js|firebase-config\.js|metronome-worklet\.js)$/.test(path))throw Error('Unsupported test route');let f=readFileSync(dir+'/'+path);res.setHeader('content-type',path.endsWith('.js')?'text/javascript':'text/html');res.end(f);}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));let b;
try{b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const host='http://127.0.0.1:'+server.address().port;
for(const [width,height] of [[320,640],[390,844],[640,256],[768,1024],[1280,850]])for(const text of [100,200])for(const colorScheme of ['light','dark']){const p=await b.newPage({viewport:{width,height},hasTouch:width<450,isMobile:width<450,colorScheme,reducedMotion:'reduce'});await p.route('**/*',r=>r.request().url().startsWith(host+'/')?r.continue():r.abort());await p.goto(host+'/experimental/',{waitUntil:'domcontentloaded'});if((await p.locator('html').getAttribute('data-appearance')==='dark')!==(colorScheme==='dark'))await p.locator('#appearance-toggle').click();if(text>100)await p.addStyleTag({content:'html{font-size:200%!important}'});
const pre=await p.evaluate(()=>{const e=document.querySelector('#metro-settings'),b=e.getBoundingClientRect(),d=document.querySelector('#draw-button').getBoundingClientRect(),c=document.querySelector('#major-plus').getBoundingClientRect();return {hit:!!document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)?.closest('#metro-settings'),right:c.right,dockY:b.bottom,viewport:[visualViewport.width,visualViewport.height,innerWidth,innerHeight],primary:[d.x,d.y,d.width],counts:[c.x,c.y]};});
 console.log(width,height,text,colorScheme,JSON.stringify(pre));
 if(pre.right>width||pre.dockY>height||!pre.hit||pre.viewport[2]!==width)throw Error(JSON.stringify(pre));

 const pointer=selector=>width<450?p.locator(selector).tap({timeout:3000}):p.locator(selector).click({timeout:3000});
 await pointer('#major-plus');if(await p.locator('#major-count').textContent()!=='2')throw Error('major count failed');
 await pointer('#major-minus');
 await pointer('#metro-settings');await p.locator('#metro-beats').selectOption('6');
 await p.keyboard.press('Escape');await pointer('#tuner-settings');
 if(!await p.locator('#tuner-a').isVisible())throw Error('A4 unavailable');
 await p.keyboard.press('Escape');await pointer('#metro-settings');
const out=await p.evaluate(()=>{const box=q=>{const e=document.querySelector(q),r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height,e.scrollWidth,e.clientWidth,e.scrollHeight,e.clientHeight]};return {panel:box('#metronome-panel'),accents:box('#metro-accents'),six:box('[data-beat="5"]'),trigger:box('#metro-settings'),main:document.documentElement.scrollWidth,scroll:[window.scrollX,window.scrollY]};});if(out.accents[4]!==out.accents[5])throw Error('accents require horizontal scrolling');await p.close();
}}finally{await b?.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1});
