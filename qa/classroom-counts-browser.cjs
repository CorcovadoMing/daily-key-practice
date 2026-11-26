// Two local browser tabs, real UI and transaction updater, simulated Firebase retries; no live room.
const { chromium }=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
(async()=>{
 const root=process.argv[2]||'.',html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/<script type="module" src="classroom.js[^"]*"><\/script>/,'');
 const room=fs.readFileSync(path.join(root,'classroom.js'),'utf8');
 const tx=room.slice(room.indexOf('async function changeRoom(update)'),room.indexOf('  setExcludedKeys(excludedKeys) {'))+'};';
 const bridge=`const practice=window.DailyKeyPractice, ready=true, connected=true, roomRef={}, roomExpiresAt=null;
   const waiting=[];
   const firebase={runTransaction(ref,callback,options){if(options.applyLocally)throw Error('unexpected optimistic UI');return new Promise(resolve=>waiting.push({callback,resolve}));}};
   ${tx}
   window.__test={boot:room=>practice.setClassroomRoom('123456',room), count:()=>waiting.length,
     retry(room){waiting.forEach(p=>p.callback(room));},
     commit(room){return waiting.splice(0).reduce((current,p)=>{const next=p.callback(current);p.resolve({committed:!!next});return next??current;},room);}};`;
 const sourceNames=new Set(['fingerboard.js','fingering-presets.js','metronome-worklet.js','fingerboard-editor.js','firebase-config.js']);
 const server=http.createServer((req,res)=>{const name=path.basename(new URL(req.url,'http://localhost').pathname);if(sourceNames.has(name)){res.setHeader('content-type','text/javascript');res.end(fs.readFileSync(path.join(root,name)));}else{res.setHeader('content-type','text/html');res.end(html);}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 let b;
 try{
   b=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM||undefined});
   const tabs=await Promise.all([390,880].map(width=>b.newPage({viewport:{width,height:800}})));
   const errors=[];
   let data={majorCount:1,minorCount:1,showScale:false,fingerings:{},createdAt:Date.now(),excludedKeys:[]};
   const echo=()=>Promise.all(tabs.map(p=>p.evaluate(x=>window.__test.boot(x),data)));
   for(const p of tabs){p.on('pageerror',e=>errors.push(e.message));await p.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());await p.goto(origin+'/experimental/');await p.addScriptTag({content:bridge});}
   await echo();
   await tabs[0].evaluate(()=>{document.querySelector('#major-plus').click();document.querySelector('#major-plus').click();});
   await tabs[1].locator('#minor-plus').click();
   assert.deepEqual(await Promise.all(tabs.map(p=>p.evaluate(()=>window.__test.count()))),[2,1]);
   assert.deepEqual(await Promise.all(tabs.map(p=>p.locator('#major-count').textContent())),['1','1']);
   await Promise.all(tabs.map(p=>p.evaluate(x=>window.__test.retry(x),data)));
   data=await tabs[1].evaluate(x=>window.__test.commit(x),data);
   data=await tabs[0].evaluate(x=>window.__test.commit(x),data);
   await echo();
   for(const p of tabs){assert.equal(await p.locator('#major-count').textContent(),'3');assert.equal(await p.locator('#minor-count').textContent(),'2');}
   assert.deepEqual(errors,[]);console.log('Both clients show three majors and two minors after mixed delayed commits and retries.');
 }finally{await b?.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
