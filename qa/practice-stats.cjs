// Isolated DOM interaction QA; not browser rendering or device verification.
(async()=>{const {JSDOM}=require(process.env.JSDOM_MODULE || 'jsdom'),fs=require('fs'),a=require('assert/strict');const root=process.cwd()+'/';const html=fs.readFileSync(root+'index.html','utf8');const dom=new JSDOM(html,{url:'http://localhost',runScripts:'outside-only',pretendToBeVisual:true});const w=dom.window;w.matchMedia=()=>({matches:false,addEventListener(){}});w.ResizeObserver=class{observe(){}disconnect(){}};w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};for(const s of w.document.querySelectorAll('script')){if(s.type==='module')continue;if(s.src){if(s.src.includes('firebase'))continue;w.eval(fs.readFileSync(root+new URL(s.src).pathname.slice(1),'utf8'))}else w.eval(s.textContent)}const q=s=>w.document.querySelector(s),click=s=>q(s).click();
a.equal(w.document.querySelectorAll('.practice-stat').length,0);a.ok(q('.practice-stats-empty'));
w.DailyKeyPractice.setClassroomRoom('123456',{createdAt:1,majorIds:[0],minorIds:[],doneIds:['major-0'],preferences:{majorCount:1,minorCount:0},session:{date:'2026-11-14',createdAt:1,majorIds:[0],minorIds:[],doneIds:['major-0']}});
let b=q('.practice-stat[data-stat-key="major-0"]');a.ok(b);
b.click();q('#student-note-text').value='共享私人筆記';[...w.document.querySelectorAll('dialog button')].find(x=>x.textContent==='儲存筆記').click();
a.equal(w.localStorage.getItem('daily-key-practice:experimental:key-note:major-0'),'共享私人筆記');
a.ok([...w.document.querySelectorAll('[data-note-key="major-0"]')].every(x=>x.classList.contains('has-note')));
w.document.querySelectorAll('dialog').forEach(x=>x.remove());
let card=q('.key-card[data-key-id="major-0"] .student-note-button');card.click();a.equal(q('#student-note-text').value,'共享私人筆記');q('#student-note-text').value='';[...w.document.querySelectorAll('dialog button')].find(x=>x.textContent==='儲存筆記').click();
a.ok([...w.document.querySelectorAll('[data-note-key="major-0"]')].every(x=>!x.classList.contains('has-note')));
a.equal(typeof w.classroomSync,'undefined');console.log('PASS empty/positive-only stats, shared note and immediate highlight/clear, no Firebase');dom.window.close();})().catch(e=>{console.error(e);process.exit(1)});
