const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const load=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const html=load('index.html'),fingerboard=load('fingerboard.js');
class Node {
  constructor(tag){this.tagName=tag;this.children=[];this.attrs={};this.style={};this.listeners={};}
  setAttribute(k,v){this.attrs[k]=String(v);}
  getAttribute(k){return this.attrs[k]??null;}
  hasAttribute(k){return k in this.attrs;}
  append(...nodes){for(const n of nodes){if(n.parentNode)n.parentNode.children=n.parentNode.children.filter(child=>child!==n);n.parentNode=this;this.children.push(n);}}
  replaceChildren(...nodes){this.children=[];this.append(...nodes);}
  replaceWith(node){const parent=this.parentNode;const i=parent.children.indexOf(this);node.parentNode=parent;parent.children[i]=node;}
  addEventListener(k,fn){this.listeners[k]=fn;}
  insertAdjacentHTML(){}
  querySelectorAll(selector){
    let match;
    if(selector.startsWith('[')){const k=selector.slice(1,-1);match=n=>n.hasAttribute(k);}
    else if(selector.startsWith('.'))match=n=>(n.getAttribute('class')||n.className||'').split(' ').includes(selector.slice(1));
    else match=n=>n.tagName===selector;
    return this.children.flatMap(n=>[...(match(n)?[n]:[]),...n.querySelectorAll(selector)]);
  }
  querySelector(selector){return this.querySelectorAll(selector)[0]??null;}
}
function view(){
  const window={},document={createElement:t=>new Node(t),createElementNS:(_,t)=>new Node(t),querySelectorAll:()=>[]};
  const ctx=vm.createContext({window,document});
  for(const name of ['fingering-presets.js','fingerboard.js','fingerboard-editor.js'])vm.runInContext(load(name),ctx);
  return {window,api:window.CelloFingerboard};
}
test('live-scale and arpeggio boards render complete two-octave paths without an octave control',()=>{
  const {window,api}=view(),targets=[];
  window.CelloScalePractice={card(_,target,__ ,kind){targets.push({kind,target});return {element:new Node('practice-test')};}};
  for(const [mode,key] of [
    ['major',['C',0,'C D E F G A B']],
    ['minor',['B',2,'B C♯ D E F♯ G♯ A♯ B','B C♯ D E F♯ G A B']]
  ]){
    const root=api.create(mode,key,{up:'keep my notes'},()=>{});
    const charts=root.querySelectorAll('.cello-fb-svg');
    assert.deepEqual(charts.map(c=>c.querySelectorAll('[data-position-group]').length),[15,15,7]);
    assert.ok(!root.querySelectorAll('button').some(b=>/八度/.test(b.textContent||'')));
    assert.deepEqual(root.querySelectorAll('.exercise-score-title').map(n=>n.textContent),['音階','琶音']);
    assert.deepEqual(targets.splice(0).map(({kind,target})=>[kind,target.length,Math.max(...target.map(n=>n.midi))-Math.min(...target.map(n=>n.midi))]),[['scale',29,24],['arpeggio',13,24]]);
    assert.equal(root.querySelectorAll('.fingering-note')[0].textContent,'keep my notes');
  }
});
test('teacher route keeps complete notes and prior hidden-direction annotations',()=>{
  const {api}=view();
  const key=['C',0,'C D E F G A B'],upMap='{"40":{"s":0,"f":4}}',downMap='{"40":{"s":0,"f":3}}';
  const teacher=api.createEditor('major',key,{upMap,downMap},'down');
  assert.equal(teacher.element.querySelectorAll('.teacher-note-pill').length,15);
  assert.ok(!teacher.element.querySelectorAll('button').some(b=>/八度/.test(b.textContent||'')));
  assert.equal(teacher.getValue().upMap,upMap);
  assert.equal(teacher.getValue().downMap,downMap);
});
test('only footer repeats privacy once; microphone failure, active result and local model download still explained',()=>{
  assert.equal((html.match(/不會上傳/g)||[]).length,1);
  assert.match(html,/<footer[\s\S]*class="local-audio-note"[^>]*>聲音與音準分析只在本機處理，不會上傳。/);
  assert.doesNotMatch(html+fingerboard,/兩個八度|\b[12] 八度/);
  for(const text of ['等待麥克風授權','無法讀取麥克風','收音中 · A4','已自動停止收音','首次使用需下載約 350 MB']){
    assert.ok(html.includes(text),text);
  }
});
