// Run: JSDOM_MODULE=/path/to/jsdom node qa/arpeggio-editor.cjs
const {JSDOM}=require(process.env.JSDOM_MODULE||'jsdom');
const fs=require('fs'),a=require('node:assert/strict');
const dom=new JSDOM('',{runScripts:'outside-only'}),w=dom.window;
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
w.HTMLDialogElement.prototype.close=function(){this.open=false;};
for(const f of ['fingerboard.js','fingering-presets.js'])w.eval(fs.readFileSync(f,'utf8'));
const F=w.CelloFingerboard,key=['C',0,'C D E F G A B'];
let scales=[],arps=[],previews=[];
const legacy={upMap:JSON.stringify({40:{s:0,f:4}}),downMap:'legacy-down',up:'memo'};
const root=F.create('major',key,legacy,(...v)=>scales.push(v),v=>previews.push(v),
 {annotations:{},localOnly:true,onSave:(...v)=>arps.push(v)});
w.document.body.append(root);
const arp=root.querySelector('.arpeggio-section'),scale=root.querySelector('.fingerboard-section:not(.arpeggio-section)');
const note=(section,midi)=>section.querySelector('.cello-fb-note[data-midi="'+midi+'"]');
const finger=n=>[...arp.querySelectorAll('.cello-inline-finger')].find(b=>b.textContent===String(n)).click();
const button=cls=>arp.querySelector('.cello-inline-'+cls).click();
a.equal(arp.querySelectorAll('.cello-fb-note').length,7);
a.ok(note(arp,40));
a.notEqual(note(arp,40).textContent,note(scale,40).textContent,'legacy scale edit must not color or alter arpeggio');
note(arp,40).dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
a.equal(root.isEditing(),true);finger(1);
a.equal(arps.length,0);a.equal(scales.length,0);
button('save');
a.equal(arps.length,1);a.equal(scales.length,0);
a.equal(JSON.parse(arps[0][1])[40].f,1);a.equal(arps[0][0],'up');
a.ok(previews.every(v=>v===null),'arpeggio draft never leaks as a scale draft');
a.equal(root.isEditing(),false);
a.ok(arp.querySelector('.cello-fb-changed'));
// Reset remains staged and undoable, with safe leave/keep/discard.
note(arp,40).dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
button('reset');a.equal(arps.length,1);
button('undo');a.equal(arp.querySelector('.cello-inline-save').disabled,true);
finger(2);let navigated=false;root.requestLeave(()=>navigated=true);
a.equal(root.querySelector('dialog').open,true);
root.querySelector('.cello-leave-keep').click();a.equal(navigated,false);a.equal(root.isEditing(),true);
root.requestLeave(()=>navigated=true);root.querySelector('.cello-leave-discard').click();
a.equal(navigated,true);a.equal(arps.length,1);
note(arp,40).dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
button('reset');button('save');a.equal(arps.at(-1)[1],'');a.equal(scales.length,0);
// Switching from a dirty arpeggio to scale must require confirmation, not discard.
note(arp,40).dispatchEvent(new w.MouseEvent('click',{bubbles:true}));finger(1);
note(scale,40).dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
a.equal(root.querySelector('dialog').open,true);
root.querySelector('.cello-leave-save').click();a.equal(arps.length,3);
a.equal(scale.querySelector('.cello-inline-editor').hidden,false);
root.requestLeave();a.equal(root.isEditing(),false);
// Reload saved arpeggio map, retain scale/old down maps, independent reset.
const saved={upMap:arps.at(-1)[1]};
const reload=F.create('major',key,legacy,()=>{},null,{annotations:saved,onSave:()=>{}});
a.ok(reload.querySelector('.arpeggio-section .cello-fb-changed'));
a.equal(JSON.stringify(legacy),JSON.stringify({upMap:'{"40":{"s":0,"f":4}}',downMap:'legacy-down',up:'memo'}));
// Classroom scale updates and previews do not replace local arpeggio overrides.
const before=arp.querySelector('.cello-fb-viewport').innerHTML;
root.updateAnnotations({upMap:'{"40":{"s":0,"f":1}}'});
root.setRemoteDrafts([{direction:'up',selectedMidi:40,previewMap:'{"40":{"s":0,"f":2}}',changed:[40]}]);
a.equal(arp.querySelector('.cello-fb-viewport').innerHTML,before);
a.match(arp.textContent,/不與教室同步/);
// Arpeggio remains two octaves when scale changes to one.
[...root.querySelectorAll('.cello-fb-button')].find(b=>b.textContent==='1 八度').click();
a.equal(arp.querySelectorAll('.cello-fb-note').length,7);
console.log('Arpeggio edit/confirm/reset/undo/leave/independent maps/classroom isolation/reload: passed');
