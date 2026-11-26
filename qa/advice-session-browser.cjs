const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const a=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
(async()=>{
 const root=process.argv[2]||process.cwd();
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1'),f=url.pathname.endsWith('/')?'index.html':path.basename(url.pathname);
  if(!/^(index\.html|fingerboard(?:-editor)?\.js|fingering-presets\.js|classroom\.js|firebase-config\.js|metronome-worklet\.js)$/.test(f)){res.statusCode=404;return res.end();}
  res.setHeader('content-type',f.endsWith('.js')?'text/javascript':'text/html');res.end(fs.readFileSync(path.join(root,f)));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;
 let b;
 try{
 b=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM||undefined});
 const p=await b.newPage();
 await p.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
 await p.addInitScript(()=>{Math.random=()=>0;});
 await p.goto(origin+'/experimental/');
 await p.locator('#draw-button').click();
 await p.locator('.key-title').first().waitFor();
 await p.evaluate(()=>{
   const card=document.querySelector('.key-card');
   const pitches=[...new Map([...card.querySelectorAll('.scale-exercise [data-midi][data-score-index]')].map(e=>[+e.dataset.scoreIndex,+e.dataset.midi])).values()];
   if(pitches.length!==29)throw new Error('score '+pitches.length);
   const storage=window.localStorage;
   const state=JSON.parse(storage.getItem('daily-key-practice:experimental:v1'));
   const current=Object.values(state.sessions)[0];
   const api=window.CelloPracticeHistory;
   const id=card.querySelector('.key-title').textContent.split(' ')[0];
   const key=api.keyFor('major-'+id,'scale',pitches);
   const draft={id:'coach-redraw-fixture',values:[-27,...Array(28).fill(null)],mode:'single',laps:0,passed:0,progress:1,pending:false,
   adviceSession:'personal:'+current.createdAt,advice:{issues:['舊建議專用標記'],drills:['只測原有練習。']}};
   if(!api.saveKeyDraft(storage,key,draft).ok)throw new Error('save fixture');
   const second=document.querySelectorAll('.key-card')[1];
   const slots=[...new Map([...second.querySelectorAll('.scale-exercise [data-midi][data-score-index]')].map(e=>[+e.dataset.scoreIndex,+e.dataset.midi])).values()];
   const otherKey=api.keyFor('minor-'+second.querySelector('.key-title').textContent.split(' ')[0],'scale',slots);
   const b={...draft,id:'independent-key',values:[11,...Array(28).fill(null)],advice:{issues:['另一調正確資料'],drills:['不清除這個調。']}};
   if(!api.saveKeyDraft(storage,otherKey,b).ok)throw new Error('second fixture');
   window.localStorage.setItem('autosave-e2e-keys',JSON.stringify([key,otherKey]));
 });
 const outcome=()=>p.locator('.key-card').first().locator('.scale-exercise .scale-practice-local-coach');
 async function openFirst(){ const box=outcome();if(!(await box.isVisible()))await p.locator('.key-title').first().click();return box; }
 await p.reload();
 a.match(await (await openFirst()).innerText(),/舊建議專用標記/);
 await p.locator('#draw-button').click();
 await p.locator('#draw-choice-dialog [data-history-choice="new"]').click();
 a.match(await (await openFirst()).innerText(),/舊建議專用標記/);
 await p.reload();
 a.match(await (await openFirst()).innerText(),/舊建議專用標記/);
 const history=p.locator('.history-replay');
 a.equal(await history.count(),2);
 await p.locator("#history-settings summary").click();
 await history.last().click();
 a.match(await (await openFirst()).innerText(),/舊建議專用標記/);
 const first=p.locator('.key-card').first(), clear=first.locator('.scale-exercise .scale-practice-clear-history');
 await clear.click();
 await first.locator('.scale-exercise .scale-practice-cancel-clear').click();
 a.match(await (await openFirst()).innerText(),/舊建議專用標記/);
 await clear.click();await first.locator('.scale-exercise .scale-practice-confirm-clear').click();
 a.doesNotMatch(await (await openFirst()).innerText(),/舊建議專用標記/);
 await p.reload();a.doesNotMatch(await (await openFirst()).innerText(),/舊建議專用標記/);
 a.deepEqual(await p.evaluate(()=>{
   const [x,y]=JSON.parse(localStorage.getItem('autosave-e2e-keys'));
   return [CelloPracticeHistory.loadKeyDraft(localStorage,x,29).exists,CelloPracticeHistory.loadKeyDraft(localStorage,y,29).exists,document.querySelectorAll('#practice-save-dialog').length];
 }),[false,true,0]);
 console.log('real browser: chart-advice pairing on redraw/reload, cancellation and scoped clear, unaffected second key');
 }finally{await b?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
