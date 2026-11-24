const test=require('node:test'),a=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const html=fs.readFileSync('index.html','utf8'),prefix='daily-key-practice:experimental:';
function setup(entries={}){const m=new Map(Object.entries(entries)),storage={get length(){return m.size},key:i=>[...m.keys()][i],getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};const c={localStorage:storage};vm.runInNewContext(html.slice(html.indexOf('const studentNoteKey='),html.indexOf('function refreshNoteButton'))+';this.read=readStudentNote;this.key=studentNoteKey',c);return {c,m};}
test('lossless deterministic merge and dedup across legacy browser scopes',()=>{const id='major-0',x=setup({[prefix+'student-note:personal:'+id]:'A',[prefix+'cumulative-note:'+id]:'B',[prefix+'student-note:z:'+id]:'C',[prefix+'student-note:a:'+id]:'A'});const v=x.c.read(id);a.equal(v,'【個人練習】\nA\n\n【累積練習】\nB\n\n【原教室 z】\nC');a.equal(x.c.read(id),v);a.equal(x.m.get(prefix+'student-note:z:'+id),'C');});
test('clear and save never resurrect legacy notes after reload',()=>{const id='minor-1',x=setup({[prefix+'student-note:personal:'+id]:'old'});a.equal(x.c.read(id),'old');x.m.delete(x.c.key(id));const y=setup(Object.fromEntries(x.m));a.equal(y.c.read(id),'');y.m.set(y.c.key(id),'new');a.equal(y.c.read(id),'new');});
test('all browser notes remain local and both surfaces refresh',()=>{a.ok(html.includes("document.querySelectorAll('[data-note-key]')"));a.ok(html.includes('openStudentNote(picker.value,open,cumulativeNoteKey(picker.value))'));a.ok(html.includes('noteButton.innerHTML=NOTE_ICON'));});

test('the major and minor key title rows place separate notes next to the title, expander at right',()=>{
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
  const [,content]=main.children,[row]=content.children,[title,note]=row.children;
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
 a.match(html,/\.key-title-row\{display:flex;flex-wrap:wrap/);
});
