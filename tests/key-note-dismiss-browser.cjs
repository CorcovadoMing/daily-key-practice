const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');const root=process.cwd(),A=require('node:assert/strict');
module.exports=(async()=>{const server=http.createServer((q,r)=>{let f=new URL(q.url,'http://test').pathname.replace(/^\/experimental\//,'')||'index.html';try{r.setHeader('content-type',f.endsWith('.js')?'text/javascript':'text/html');const bytes=fs.readFileSync(path.join(root,f));r.end(bytes);}catch{r.writeHead(404);r.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));let b;try{
b=await chromium.launch(process.env.CHROMIUM?{executablePath:process.env.CHROMIUM}:{});const host='http://127.0.0.1:'+server.address().port;
for(const width of [320,390,768,1280])for(const zoom of [100,200])for(const colorScheme of ['light','dark']){const p=await b.newPage({viewport:{width,height:820},hasTouch:width<500,isMobile:width<500,colorScheme,reducedMotion:'reduce'});await p.addInitScript(()=>{const d=new Date(),day=[d.getFullYear(),String(d.getMonth()+1).padStart(2,0),String(d.getDate()).padStart(2,0)].join('-');const ns='daily-key-practice:experimental:';
 if(!localStorage.getItem(ns+'v1'))localStorage.setItem(ns+'v1',JSON.stringify({version:1,sessions:{[day]:{date:day,createdAt:Date.now(),majorIds:[0],minorIds:[0],doneIds:[]}},personalHistory:[],classroomHistory:[],fingerings:{},preferences:{majorCount:1,minorCount:1}}));
 if(!localStorage.getItem(ns+'key-note:major-0'))localStorage.setItem(ns+'key-note:major-0','原本保留的筆記');
});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.route('**/*',r=>r.request().url().startsWith(host+'/')?r.continue():r.abort());await p.goto(host+'/experimental/',{waitUntil:'domcontentloaded'});if(zoom===200)await p.addStyleTag({content:'html{font-size:200%!important}'});

const opener=p.locator('.key-card[data-key-id="major-0"] .student-note-button'),dialog=p.locator('dialog.student-note-dialog'),input=dialog.locator('textarea');
const click=sel=>width<500?sel.tap({timeout:4000}):sel.click({timeout:4000});
await click(opener);A.equal(await input.inputValue(),'原本保留的筆記');A.equal(await input.evaluate(e=>document.activeElement===e),true);
await p.keyboard.press('End');await p.keyboard.type(' newer');
await p.keyboard.press('Escape');await p.waitForTimeout(100);
const opened=await dialog.isVisible();
A.equal(opened,true);
A.equal(await input.inputValue(),'原本保留的筆記 newer');
const status=dialog.getByRole('status');A.equal(await status.textContent(),'請先儲存或取消編輯。');
await click(dialog.getByRole('button',{name:'取消',exact:true}));await dialog.waitFor({state:'detached'});
A.equal(await opener.evaluate(e=>e===document.activeElement),true);
await click(opener);A.equal(await input.inputValue(),'原本保留的筆記');
await p.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
await click(opener);await input.fill('有儲存的修改');
await click(dialog.getByRole('button',{name:'儲存筆記',exact:true}));await dialog.waitFor({state:'detached'});
await click(opener);A.equal(await input.inputValue(),'有儲存的修改');
await input.fill('暫時');await p.keyboard.press('Escape');A.equal(await status.textContent(),'請先儲存或取消編輯。');
await input.fill('有儲存的修改');A.equal(await status.textContent(),'');A.deepEqual(errors,[]);
await p.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
console.log(JSON.stringify({kind:'key-note-dismiss',width,zoom,colorScheme,passed:true}));await p.close();}
}finally{await b?.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1});
