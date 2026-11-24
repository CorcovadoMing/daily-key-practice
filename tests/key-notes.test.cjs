const test=require('node:test'),a=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const html=fs.readFileSync('index.html','utf8'),prefix='daily-key-practice:experimental:';
function setup(entries={}){const m=new Map(Object.entries(entries)),storage={get length(){return m.size},key:i=>[...m.keys()][i],getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};const c={localStorage:storage};vm.runInNewContext(html.slice(html.indexOf('const studentNoteKey='),html.indexOf('function refreshNoteButton'))+';this.read=readStudentNote;this.key=studentNoteKey',c);return {c,m};}
test('lossless deterministic merge and dedup across legacy browser scopes',()=>{const id='major-0',x=setup({[prefix+'student-note:personal:'+id]:'A',[prefix+'cumulative-note:'+id]:'B',[prefix+'student-note:z:'+id]:'C',[prefix+'student-note:a:'+id]:'A'});const v=x.c.read(id);a.equal(v,'【個人練習】\nA\n\n【累積練習】\nB\n\n【原教室 z】\nC');a.equal(x.c.read(id),v);a.equal(x.m.get(prefix+'student-note:z:'+id),'C');});
test('clear and save never resurrect legacy notes after reload',()=>{const id='minor-1',x=setup({[prefix+'student-note:personal:'+id]:'old'});a.equal(x.c.read(id),'old');x.m.delete(x.c.key(id));const y=setup(Object.fromEntries(x.m));a.equal(y.c.read(id),'');y.m.set(y.c.key(id),'new');a.equal(y.c.read(id),'new');});
test('all browser notes remain local and both surfaces refresh',()=>{a.ok(html.includes("document.querySelectorAll('[data-note-key]')"));a.ok(html.includes('openPracticeNotes(open)'));a.ok(html.includes('noteButton.innerHTML=NOTE_ICON'));});

test('the major and minor key headers place the accessible notes action below the tonic and before key details',()=>{
 const calls=[];
 const node=()=>({children:[],dataset:{},events:{},append(...x){this.children.push(...x)},addEventListener(k,f){this.events[k]=f},setAttribute(k,v){(this.attrs??={})[k]=v}});
 const box={document:{createElement:node},MAJOR_KEYS:[['C']],MINOR_KEYS:[['A']],selectedId:m=>m+'-0',
   NOTE_ICON:'',refreshNoteButton(n){n.setAttribute('aria-label',n.dataset.noteLabel+'新增個人練習筆記')},
   requestCardAction(f){f()},toggleCardExpansion(id){calls.push(['expand',id])},toggleComplete(){},
   openStudentNote(id,n){calls.push(['note',id,n])},relativeKeyLabel(){},scaleNameSummary(){},visibleFingerings:()=>({}),
   window:{CelloFingerboard:{create:()=>({setRemoteArpeggioDrafts(){},setRemoteDrafts(){}})}},sharedRoom:null,
   state:{arpeggioFingerings:{}},boardInstances:new Map(),cardInstances:new Map(),roomArpeggioPreviews:{},roomEditingPreviews:{}};
 const source=html.slice(html.indexOf('function createCard('),html.indexOf('function mergeFingeringMap('));
 vm.runInNewContext(source,box);
 for(const [mode,name] of [['major','C 大調'],['minor','A 小調']]){
  const card=box.createCard(mode,0,[mode+'-0']),[header]=card.children,[main,expand]=header.children;
  const [,content]=main.children,[row,detailsRow]=content.children,[title]=row.children,[note,details]=detailsRow.children;
  a.equal(row.children.length,1);
  a.equal(detailsRow.className,'key-details-row');
  a.match(details.innerHTML,/class="key-relative"[\s\S]*class="key-secondary"/);
  a.equal(card.dataset.keyMode,mode);a.match(card.className,/done/);
  a.equal(title.textContent,name);a.equal(note.attrs['aria-label'],name+'，新增個人練習筆記');
  a.equal(title.children.length,0);a.equal(expand.className,'key-expand');
  note.events.click();a.deepEqual(calls.pop(),['note',mode+'-0',note]);
  title.events.click();a.deepEqual(calls.pop(),['expand',mode+'-0']);
  expand.events.click();a.deepEqual(calls.pop(),['expand',mode+'-0']);
 }
 a.match(html,/data-key-mode=major[^\n]*--key-card-accent:#57789b/);
 a.match(html,/data-key-mode=minor[^\n]*--key-card-accent:#805c91/);
 a.match(html,/data-appearance=dark[^\n]*data-key-mode=major[^\n]*--key-card-accent:#87aacd/);
 a.match(html,/data-appearance=dark[^\n]*data-key-mode=minor[^\n]*--key-card-accent:#b49ac6/);
 a.doesNotMatch(html,/--key-card-tint/);
 a.match(html,/\.key-card\[data-key-mode\]>\.key-card-heading\{\s*box-shadow:inset 6px 0 var\(--key-card-accent\)\s*\}/);
 a.match(html,/\.key-title:focus-visible/);
 a.match(html,/\.key-details-row\{display:grid;grid-template-columns:44px minmax\(0,1fr\)/);
});

test('all-notes modal lists only saved keys, edits inline, guards unsaved edits and adds by search to shared storage',()=>{
 const store=new Map([['major-0','Existing\nContent']]),calls=[];
 const node=(tag)=>({tag,children:[],attrs:{},events:{},dataset:{},append(...nodes){this.children.push(...nodes)},
  replaceChildren(){this.children=[];},setAttribute(k,v){this.attrs[k]=v;},getAttribute(k){return this.attrs[k];},click(){this.events.click();},addEventListener(k,f){this.events[k]=f;},
  focus(){calls.push(this);},showModal(){this.open=true;},close(){this.open=false;this.events.close?.();},remove(){this.removed=true;}});
 const body=node('body'),button=node('button');
 const ctx={document:{body,createElement:node,querySelectorAll:()=>[]},readStudentNote:id=>store.get(id)||'',
  studentNoteKey:id=>id,selectedId:(m,i)=>m+'-'+i,keyName:(m,i)=>i===0?'C':i===1?'D♭':'K'+i,
  localStorage:{setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)}};
 vm.runInNewContext(html.slice(html.indexOf('function saveStudentNote('),html.indexOf('function openStudentNote(')),ctx);
 const deep=(n,p)=>p(n)?n:n.children.map(x=>deep(x,p)).find(Boolean);
 ctx.openPracticeNotes(button);
 const modal=body.children[0],list=modal.children[1];
 a.equal(modal.open,true);
 a.equal(list.children.filter(n=>n.className==='practice-note-summary').length,2); // one saved, one add section
 a.equal(list.children[0].children[0].textContent,'C 大調');
 a.equal(list.children[0].children[1].textContent,'Existing\nContent');
 a.equal(deep(modal,n=>n.tag==='select'),undefined);
 deep(modal,n=>n.textContent==='編輯').events.click();
 const draft=deep(modal,n=>n.tag==='textarea');draft.value='Edited';
 a.equal(deep(modal,n=>n.textContent==='新增筆記'),undefined);
 let prevented=0;modal.events.cancel({preventDefault(){prevented++;}});
 a.equal(prevented,1);a.equal(store.get('major-0'),'Existing\nContent');
 deep(modal,n=>n.textContent==='儲存筆記').events.click();
 a.equal(store.get('major-0'),'Edited');
 a.equal(deep(modal,n=>n.textContent==='D♭ 大調'),undefined);
 deep(modal,n=>n.textContent==='新增筆記').events.click();
 const search=deep(modal,n=>n.id==='practice-note-key-search');
 a.equal(deep(modal,n=>n.textContent==='D♭ 大調'),undefined);
 search.value='降 D 大調';search.events.input();
 a.equal(deep(modal,n=>n.textContent==='D♭ 小調'),undefined);
 a.equal(store.has('major-1'),false);
 search.events.keydown({key:'Enter',isComposing:true});
 a.equal(deep(modal,n=>n.tag==='textarea'),undefined);
 search.events.keydown({key:'Enter',preventDefault(){}});

 deep(modal,n=>n.tag==='textarea').value='Added by search';
 deep(modal,n=>n.textContent==='儲存筆記').events.click();
 a.equal(store.get('major-1'),'Added by search');
 a.equal(list.children.filter(n=>n.className==='practice-note-summary').length,3);
 deep(modal,n=>n.attrs['aria-label']==='編輯 D♭ 大調 筆記').events.click();
 const actions=deep(modal,n=>n.className==='student-note-actions');
 a.deepEqual(actions.children.map(x=>x.textContent),['清空內容','取消','儲存筆記']);
 a.equal(actions.children[2].className,'room-action primary');
 actions.children[0].click();
 a.equal(deep(modal,n=>n.tag==='textarea').value,'');
 a.equal(store.get('major-1'),'Added by search');
 actions.children[1].click();
 a.equal(store.get('major-1'),'Added by search');
 deep(modal,n=>n.attrs['aria-label']==='編輯 D♭ 大調 筆記').click();
 deep(modal,n=>n.textContent==='清空內容').click();
 deep(modal,n=>n.textContent==='儲存筆記').events.click();
 a.equal(store.has('major-1'),false);
 deep(modal,n=>n.textContent==='關閉').events.click();
 a.equal(calls.at(-1),button);
});
