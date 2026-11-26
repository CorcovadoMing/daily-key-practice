const {chromium}=require('/opt/codex/cua_node/lib/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
(async()=>{
 const dirs=new Set(['index.html','fingerboard.js','fingerboard-editor.js','fingering-presets.js','classroom.js','firebase-config.js','metronome-worklet.js']);
 const served=[];
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  const file=url.pathname.endsWith('/')?'index.html':path.basename(url.pathname);
  if(dirs.has(file)){served.push(url.pathname);res.setHeader('content-type',file.endsWith('.js')?'text/javascript':'text/html');res.end(fs.readFileSync(file));}
  else{res.statusCode=404;res.end();}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;
 let browser;
 try {
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM||undefined});
  for(const [width,dark] of [[320,false],[320,true],[390,false],[390,true],[1280,false],[1280,true]]){
   const p=await browser.newPage({viewport:{width,height:800},isMobile:width<500,hasTouch:width<500});
   const errors=[];
   p.on('pageerror',e=>errors.push(e.message));
   await p.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
   await p.addInitScript(()=>{
    window.__qa={decoded:[],started:[],stopped:[],mic:0};
    const proto=AudioContext.prototype, original=proto.decodeAudioData;
    proto.decodeAudioData=async function(data){const bytes=data.byteLength;const buffer=await original.call(this,data);window.__qa.decoded.push([bytes,buffer.duration,this.state]);return buffer;};
    const audio=AudioBufferSourceNode.prototype,start=audio.start,stop=audio.stop;
    audio.start=function(...x){start.apply(this,x);window.__qa.started.push([this.playbackRate.value,...x]);};
    audio.stop=function(...x){stop.apply(this,x);window.__qa.stopped.push(x);};
    if(navigator.mediaDevices){
      navigator.mediaDevices.getUserMedia=async()=>{window.__qa.mic++;throw Error('QA has no microphone permission');};
    }
   });
   const before=served.filter(s=>s.endsWith('/fingerboard-editor.js')).length;
   await p.goto(origin+'/experimental/');
   if(dark)await p.locator('#appearance-toggle').click();
   assert.equal(await p.locator('html').getAttribute('data-appearance'),dark?'dark':'light');
   const top=selector=>p.locator(selector).evaluate(el=>el.getBoundingClientRect().top);
   const order=await Promise.all(['#classroom-disclosure','#mode-settings','#draw-settings','#draw-button'].map(top));
   assert.ok(order[0]<order[1]&&order[1]<order[2]&&order[2]<order[3],JSON.stringify(order));
   assert.equal(await p.locator('#pitch-detector').isVisible(),false);
   const keyNote=p.locator('#session-launch-note');
   assert.equal(await keyNote.isVisible(),true);
   assert.match(await keyNote.textContent(),/大調：.+\n小調：.+/);
   await p.locator('#launch-settings-toggle').click();
   const filter=p.locator('#signature-filters .filter-key').first();
   await filter.waitFor({state:'visible'});
   const beforeNote=await keyNote.textContent();
   assert.ok(await top('#signature-filters')>await top('#session-launch-note'));
   await filter.click();assert.notEqual(await keyNote.textContent(),beforeNote);
   await filter.click();assert.equal(await keyNote.textContent(),beforeNote);
   await p.locator('#launch-settings-toggle').click();
   await p.waitForFunction(()=>!document.querySelector('#draw-settings').open);
   const draw=p.locator('#draw-button'), counts=p.locator('#launch-count-settings'), resume=p.locator('#launch-resume');
   assert.equal(await p.locator('#draw-text').textContent(),'開始練習');
   assert.equal(await resume.isVisible(),false);
   assert.equal(await p.locator('#major-count').textContent(),'1');
   assert.equal(await p.locator('#minor-count').textContent(),'1');
   await p.locator('#major-plus').click();
   assert.equal(await p.locator('#major-count').textContent(),'2');
   await p.locator('#major-minus').click();
   assert.equal(await p.locator('#major-count').textContent(),'1');
   const drawBox=await draw.boundingBox(),countBox=await counts.boundingBox();
   const plusBoxes=await Promise.all(['#major-plus','#minor-plus'].map(sel=>p.locator(sel).boundingBox()));
   assert.ok(countBox.x>=drawBox.x+drawBox.width&&plusBoxes.every(b=>b.x+b.width<=width),JSON.stringify({width,drawBox,countBox,plusBoxes}));
   await draw.click();
   await resume.waitFor({state:'visible'});
   assert.equal(await p.locator('#draw-text').textContent(),'重新抽選');
   await p.waitForFunction(()=>{const a=document.querySelector('#draw-button').getBoundingClientRect(),b=document.querySelector('#launch-resume').getBoundingClientRect();return b.top>=a.bottom-1;});
   const line=await draw.evaluate(e=>{const text=e.querySelector('#draw-text');return {height:text.offsetHeight,line:parseFloat(getComputedStyle(text).lineHeight)};});
   assert.ok(line.height<line.line*1.5,JSON.stringify(line));
   await p.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
   await p.screenshot({path:path.join('..','modes-074-home-'+width+'-'+dark+'.png')});
   await resume.click();
   await p.locator('.key-title').first().waitFor({state:'visible'});
   if(!(await p.locator('.scale-practice[data-practice-kind=scale] .scale-practice-demo').first().isVisible()))
     await p.locator('.key-title').first().click();
   const demo=p.locator('.scale-practice[data-practice-kind=scale] .scale-practice-demo').filter({visible:true}).first();
   await demo.waitFor({state:'visible'});assert.equal(await demo.locator('.scale-demo-caption').textContent(),'');assert.match(await demo.getAttribute('aria-label'),/先聽一次/);assert.equal(await demo.getAttribute('data-demo-state'),'idle');
   assert.equal(await demo.locator('.scale-demo-ear').isVisible(),true);
   const contrast=()=>demo.evaluate(el=>{
     const linear=x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;};
     const lum=s=>s.match(/[\d.]+/g).slice(0,3).map(Number).map(linear).reduce((n,x,i)=>n+[.2126,.7152,.0722][i]*x,0);
     const style=getComputedStyle(el), l=[lum(style.backgroundColor),lum(style.color)].sort((a,b)=>b-a);
     return (l[0]+.05)/(l[1]+.05);
   });
   assert.ok(await contrast()>=7,JSON.stringify({width,dark,contrast:await contrast()}));
   assert.equal(await demo.evaluate(el=>getComputedStyle(el).borderRadius),'22px');
   const {box,launch}=await demo.evaluate(el=>{
     const box=e=>{const {x,y,width,height}=e.getBoundingClientRect();return {x,y,width,height};};
     return {box:box(el),launch:box(el.closest('.scale-practice-action').querySelector('.scale-practice-button'))};
   });
   assert.ok(box.x+box.width<launch.x && Math.abs(box.y-launch.y)<3,JSON.stringify({box,launch}));
   assert.ok(box.width>=44 && box.height>=44 && box.x>=0 && box.x+box.width<=width+1,JSON.stringify(box));
   assert.equal(served.filter(s=>s.endsWith('/fingerboard-editor.js')).length,before);
   await demo.click();
   await p.waitForFunction(()=>Boolean(document.querySelector('.scale-practice-demo[data-demo-state=playing]')));
   await p.waitForFunction(()=>[...document.querySelectorAll('.scale-practice-demo[data-demo-state=playing] .scale-demo-bar')].some(b=>parseFloat(b.style.getPropertyValue('--demo-level'))>.30));
   assert.match(await demo.getAttribute('aria-label'),/停止音階示範/);
   await p.waitForFunction(()=>getComputedStyle(document.querySelector('.scale-practice-demo[data-demo-state=playing] .scale-demo-caption')).visibility==='hidden');
   assert.ok(await contrast()>=7,JSON.stringify({width,dark,contrast:await contrast()}));
   await p.waitForFunction(()=>document.querySelector('.scale-practice-demo[data-demo-state=playing]').getBoundingClientRect().width>=81);
   const capsule=await demo.boundingBox();
   assert.ok(capsule.width>box.width+7,JSON.stringify({box,capsule}));
   const played=await p.evaluate(()=>window.__qa);
   assert.deepEqual(played.decoded.map(x=>[x[0],x[2]]),[[172268,'running']]);
   assert.ok(Math.abs(played.decoded[0][1]-21.45)<.08);assert.equal(played.started.length,29);
   assert.equal(played.mic,0);
   await p.waitForFunction(()=>[...document.querySelectorAll('.scale-practice-demo[data-demo-state=playing]')].some(e=>getComputedStyle(e).borderRadius==='22px'));
   const collapse=await demo.evaluate(async el=>{
     const c=()=>{const s=getComputedStyle(el),b=el.getBoundingClientRect();return {r:parseFloat(s.borderRadius),w:b.width,x:b.x,y:b.y};};
     const from=c();el.click();const first=c();
     await new Promise(r=>setTimeout(r,155));const mid=c();
     await Promise.allSettled(el.getAnimations().map(m=>m.finished));const end=c();
     return {from,first,mid,end};
   });
   assert.ok(Object.values(collapse).every(x=>x.r===22),JSON.stringify(collapse));
   assert.ok(Math.abs(collapse.from.r-collapse.first.r)<.9,JSON.stringify(collapse));
   assert.ok(Math.abs(collapse.mid.w-collapse.end.w)>1,JSON.stringify(collapse));
   for(const k of ['x','y'])assert.ok(Object.values(collapse).every(x=>Math.abs(x[k]-collapse.from[k])<.5),JSON.stringify(collapse));
   assert.equal(await demo.getAttribute('data-demo-state'),'idle');
   assert.ok((await p.evaluate(()=>window.__qa.stopped.filter(x=>x.length===0).length))>0);
   assert.equal(await p.evaluate(()=>window.__qa.mic),0);assert.deepEqual(errors,[]);
   console.log(JSON.stringify({collapse,width}));
   const arp=p.locator('.scale-practice[data-practice-kind=arpeggio] .scale-practice-demo').filter({visible:true}).first();
   await arp.waitFor({state:'visible'}); const arpBox=await arp.boundingBox();
   assert.ok(arpBox.x>=0&&arpBox.x+arpBox.width<=width+1&&arpBox.height>=44);
   await arp.click();await p.waitForFunction(()=>Boolean(document.querySelector('.scale-practice-demo[data-demo-state=playing]')));
   const total=await p.evaluate(()=>window.__qa);
   assert.equal(total.decoded.length,1); assert.equal(total.started.length-played.started.length,13);
   assert.equal(total.mic,0); await arp.click();assert.equal(await arp.getAttribute('data-demo-state'),'idle');
   assert.deepEqual(errors,[]);
   await p.locator('#mode-settings-toggle').click();
   const radio=p.locator('#pitch-detector');
   await radio.waitFor({state:'visible'});
   await p.getByRole('radio',{name:'循序'}).check();
   assert.equal(await counts.isVisible(),false);
   await p.getByRole('radio',{name:'隨機'}).check();
   assert.equal(await counts.isVisible(),true);
   const beforeSlide=await radio.evaluate(x=>getComputedStyle(x,'::before').translate);
   await radio.getByRole('radio',{name:'傳統'}).check();
   await p.waitForFunction(()=>getComputedStyle(document.querySelector('#pitch-detector'),'::before').translate==='none');
   assert.match(beforeSlide,/100%/);
   assert.ok(await radio.getByRole('radio',{name:'傳統'}).isChecked());
   const second=await radio.evaluate(async x=>{
      x.querySelector('[value=swift]').click();
      const start=getComputedStyle(x,'::before').translate;
      await new Promise(r=>setTimeout(r,105));
      return {start,mid:getComputedStyle(x,'::before').translate};
   });
   assert.notEqual(second.mid,second.start);
   assert.notEqual(second.mid,'100%');
   await p.waitForFunction(()=>getComputedStyle(document.querySelector('#pitch-detector'),'::before').translate.startsWith('100%'));
   await p.locator('#mode-settings-toggle').press('Escape');
   await p.waitForFunction(()=>!document.querySelector('#mode-settings').open);
   assert.equal(await keyNote.isVisible(),true);
   console.log(JSON.stringify({width,dark,box,arpBox,scaleNotes:played.started.length,arpeggioNotes:total.started.length-played.started.length,decoded:played.decoded,errors,mic:played.mic}));
   await p.close();
  }
 } finally {await browser?.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
