(function installCelloEditor(){
  'use strict';
  const fb=window.CelloFingerboard;
  if(!fb)throw new Error('Load fingerboard.js before fingerboard-editor.js');
  const NS='http://www.w3.org/2000/svg';
  const OPEN=[{name:'C',midi:36},{name:'G',midi:43},{name:'D',midi:50},{name:'A',midi:57}];
  const XX=[42,126,210,294], NUT=68, STEP=30;
  function el(tag,cls='',txt){
    const n=document.createElement(tag);
    if(cls)n.className=cls;
    if(txt!==undefined)n.textContent=txt;
    return n;
  }
  function sv(tag,attributes={},txt){
    const node=document.createElementNS(NS,tag);
    for(const [k,v] of Object.entries(attributes))node.setAttribute(k,String(v));
    if(txt!==undefined)node.textContent=txt;
    return node;
  }
  function validated(input){
    const obj=fb.decodeMap(input),output={};
    for(const [pitch,loc]of Object.entries(obj)){
      const midi=Number(pitch);
      if(!Number.isInteger(midi)||midi<36||midi>100||!loc||!Number.isInteger(loc.s)||loc.s<0||loc.s>3)continue;
      const semis=midi-OPEN[loc.s].midi;
      if(semis<0||semis>24)continue;
      output[midi]={s:loc.s,f:semis===0?0:([1,2,3,4].includes(loc.f)?loc.f:null)};
    }
    return output;
  }
  function createEditor(mode,key,annotations={},lockedDirection=null){
    const maps={up:validated(annotations.upMap),down:validated(annotations.downMap)};
    let direction=lockedDirection==='down'?'down':'up',octaves=2,maxFret=14,selected=0;
    const root=el('div','teacher-fingerboard');
    const toolbar=el('div','teacher-tools');
    const directionGroup=el('div','cello-fb-group');
    const octaveGroup=el('div','cello-fb-group');
    const rangeGroup=el('div','cello-fb-group');
    const noteStrip=el('div','teacher-note-strip');
    const help=el('p','teacher-editor-help','先點選上方的音符，再點指板上亮起的同音高位置；也可以直接拖動音符到其他弦位。');
    const stage=el('div','teacher-fb-scroll');
    const info=el('div','teacher-note-status');
    const fingers=el('div','teacher-finger-choices');
    const reset=el('button','teacher-reset','重設目前方向的指板配置');
    reset.type='button';
    const foot=el('p','teacher-editor-help','○ 空心點＝空弦，正好落在粗弦枕線上。位置圓點是半音音位示意，大提琴沒有品絲；換弦僅允許同音高。');

    function button(parent,label,action){
      const b=el('button','cello-fb-button',label);
      b.type='button';
      b.addEventListener('click',action);
      parent.append(b);
      return b;
    }
    const upButton=button(directionGroup,'↑ 上行',()=>{direction='up';selected=0;render();});
    const downButton=button(directionGroup,'↓ 下行',()=>{direction='down';selected=0;render();});
    const oneButton=button(octaveGroup,'1 八度',()=>{octaves=1;selected=0;render();});
    const twoButton=button(octaveGroup,'2 八度',()=>{octaves=2;selected=0;render();});
    const rangeButton=button(rangeGroup,'顯示更高把位',()=>{
      maxFret=maxFret===14?24:14;
      render();
    });
    if(!lockedDirection)toolbar.append(directionGroup);
    toolbar.append(octaveGroup,rangeGroup);
    root.append(toolbar,noteStrip,help,stage,fb.makeLegend(),info,fingers,reset,foot);

    function notes(){return fb.scaleNotes(mode,key,direction,octaves);}
    function selection(){return notes()[selected]||null;}
    function placement(note){
      const m=maps[direction][String(note.midi)];
      if(m && Number.isInteger(m.s)&&m.s>=0&&m.s<4){
        const semi=note.midi-OPEN[m.s].midi;
        if(semi>=0&&semi<=24){
          const ref=window.CelloFingeringPresets?.get(mode,key,direction,notes())?.[String(note.midi)];
          const same=Boolean(ref&&ref.s===m.s);
          const f=semi===0?0:([1,2,3,4].includes(m.f)?m.f:
            same?ref.f:null);
          return {s:m.s,semi,f,group:same?ref.group:'custom',modified:true};
        }
      }
      const refs=window.CelloFingeringPresets?.get(mode,key,direction,notes())||{};
      const proposal=refs[String(note.midi)];
      if(proposal)return {s:proposal.s,semi:note.midi-OPEN[proposal.s].midi,f:proposal.f,
        group:proposal.group,modified:false};
      const pos=fb.positionFor(note.midi);
      return {s:pos.string,semi:pos.semitones,f:pos.semitones===0?0:null,group:'unverified',modified:false};
    }
    function possible(note,s){
      if(!note)return null;
      const semi=note.midi-OPEN[s].midi;
      return semi>=0&&semi<=maxFret?semi:null;
    }
    function place(s){
      const n=selection(),semi=possible(n,s);
      if(semi===null)return;
      const prev=maps[direction][String(n.midi)];
      maps[direction][String(n.midi)]={s,f:semi===0?0:(prev&&prev.s===s&&[1,2,3,4].includes(prev.f)?prev.f:null)};
      render();
    }
    function assignFinger(f){
      const n=selection();
      if(!n)return;
      const pos=placement(n);
      if(pos.semi===0)return;
      maps[direction][String(n.midi)]={s:pos.s,f};
      render();
    }
    function board(){
      const ns=notes();
      const height=NUT+maxFret*STEP+44;
      const doc=sv('svg',{viewBox:`0 0 370 ${height}`,class:'teacher-svg','aria-label':'編輯'+key[0]+'的音階指板',role:'group'});
      doc.append(sv('rect',{x:17,y:56,width:338,height:height-64,rx:13,fill:'#f7f9f6'}));
      for(let s=0;s<4;s++){
        doc.append(sv('line',{x1:XX[s],y1:NUT,x2:XX[s],y2:height-18,stroke:'#aabdad','stroke-width':2+(3-s)*.35}));
        doc.append(sv('text',{x:XX[s],y:29,'text-anchor':'middle',fill:'#36543e','font-weight':800,'font-size':15},OPEN[s].name));
        doc.append(sv('text',{x:XX[s],y:44,'text-anchor':'middle',fill:'#96a49a','font-size':10},'弦'));
      }
      for(const semi of [4,7,12,17,24]){
        if(semi>maxFret)continue;
        const y=NUT+semi*STEP;
        doc.append(sv('line',{x1:26,y1:y,x2:344,y2:y,stroke:'#dce8df','stroke-width':1,'stroke-dasharray':'4 5'}));
        if(semi===12)doc.append(sv('text',{x:9,y:y+4,'font-size':10,fill:'#93a697'},'8'));
      }
      doc.append(sv('line',{x1:XX[0]-16,y1:NUT,x2:XX[3]+16,y2:NUT,stroke:'#34483a','stroke-width':5,'stroke-linecap':'round'}));

      // Every approximate half-step on all strings is displayed. Valid drop targets
      // are green for the currently selected note; invalid pitches stay faint.
      const chosen=selection();
      for(let s=0;s<4;s++){
        for(let semi=0;semi<=maxFret;semi++){
          const pitch=OPEN[s].midi+semi,valid=Boolean(chosen&&pitch===chosen.midi);
          const x=XX[s],y=NUT+semi*STEP;
          const g=sv('g',{role:valid?'button':'img','aria-label':`${OPEN[s].name}弦距空弦${semi}半音${valid?'，可選擇此位置':''}`});
          if(valid)g.setAttribute('tabindex','0');
          g.append(sv('circle',{cx:x,cy:y,r:valid?9:3.8,fill:valid?'#a0d6aa':'#cddbd0',stroke:valid?'#518363':'none','stroke-width':1.6}));
          if(valid){
            const hit=sv('circle',{cx:x,cy:y,r:15,fill:'transparent'});
            g.append(hit);
            g.addEventListener('click',()=>place(s));
            g.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();place(s);}});
          }
          doc.append(g);
        }
      }
      for(let i=0;i<ns.length;i++){
        const n=ns[i],pos=placement(n),x=XX[pos.s],y=NUT+pos.semi*STEP;
        const style=fb.pointStyling({semitones:pos.semi,finger:pos.f,group:pos.group});
        if(pos.semi>maxFret)continue;
        const isOpen=pos.semi===0,isSelected=i===selected;
        const g=sv('g',{role:'button',tabindex:'0','aria-label':`第${n.order}音 ${n.name}；${OPEN[pos.s].name}弦；${isOpen?'空弦':pos.semi+'半音位置'}`,class:'teacher-note-marker'});
        g.append(sv('title',{},`第${n.order}音 ${n.name}`));
        if(isSelected)g.append(sv('circle',{cx:x,cy:y,r:23,fill:'none',stroke:'#78a888','stroke-width':3}));
        const color=isOpen?'#34483a':fb.POSITION_COLORS[style.group];
        g.append(sv('circle',{cx:x,cy:y,r:15.5,fill:isOpen?'#f7f9f6':color,stroke:isOpen?color:'#ffffff','stroke-width':isOpen?3:2}));
        g.append(sv('text',{x,y:y+4.5,'text-anchor':'middle','font-size':12,'font-weight':850,fill:isOpen?'#34483a':'#ffffff'},n.order));
        // Match the read-only chart: open-string points show only their number.
        if(!isOpen){
          g.append(sv('text',{x:x+20,y:y+1,'font-size':13,'font-weight':750,fill:'#263e2e'},n.name));
          if([1,2,3,4].includes(style.finger)){
            if(pos.modified)g.append(sv('rect',{x:x+17,y:y+4,width:28,height:17,
              rx:5,fill:'#fff0f5',stroke:'#d15c80','stroke-width':1}));
            g.append(sv('text',{x:x+20,y:y+16,'font-size':pos.modified?12:10,
              'font-weight':pos.modified?900:700,
              fill:pos.modified?'#a82055':'#675879'},'('+style.finger+')'));
          }
        }
        doc.append(g);
        let drag=null;
        function point(event){
          const rect=doc.getBoundingClientRect();
          return {x:(event.clientX-rect.left)*370/rect.width,y:(event.clientY-rect.top)*height/rect.height};
        }
        g.addEventListener('pointerdown',event=>{
          event.preventDefault();
          const start=point(event);
          selected=i;
          drag={id:event.pointerId,start};
          if(g.setPointerCapture)g.setPointerCapture(event.pointerId);
        });
        g.addEventListener('pointermove',event=>{
          if(!drag||event.pointerId!==drag.id)return;
          const current=point(event);
          g.setAttribute('transform',`translate(${current.x-drag.start.x} ${current.y-drag.start.y})`);
        });
        g.addEventListener('pointerup',event=>{
          if(!drag||event.pointerId!==drag.id)return;
          const last=point(event),distance=Math.hypot(last.x-drag.start.x,last.y-drag.start.y);
          drag=null;
          selected=i;
          if(distance>9){
            let closest=null;
            for(let t=0;t<4;t++){
              const semi=possible(n,t);
              if(semi===null)continue;
              const dist=Math.hypot(last.x-XX[t],last.y-(NUT+semi*STEP));
              if(dist<27&&(!closest||dist<closest.dist))closest={s:t,dist};
            }
            if(closest){place(closest.s);return;}
          }
          render();
        });
        g.addEventListener('pointercancel',()=>{drag=null;render();});
        g.addEventListener('keydown',event=>{
          if(event.key==='Enter'||event.key===' '){event.preventDefault();selected=i;render();}
        });
        g.addEventListener('click',event=>event.stopPropagation());
      }
      return doc;
    }
    function render(){
      const ns=notes();
      if(selected>=ns.length)selected=ns.length-1;
      if(!lockedDirection){
        upButton.setAttribute('aria-pressed',String(direction==='up'));
        downButton.setAttribute('aria-pressed',String(direction==='down'));
      }
      oneButton.setAttribute('aria-pressed',String(octaves===1));
      twoButton.setAttribute('aria-pressed',String(octaves===2));
      rangeButton.setAttribute('aria-pressed',String(maxFret===24));
      rangeButton.textContent=maxFret===24?'只顯示低把位':'顯示更高把位';
      noteStrip.replaceChildren();
      for(let i=0;i<ns.length;i++){
        const n=ns[i];
        const b=el('button','teacher-note-pill',n.order+' '+n.name);
        b.type='button';
        b.setAttribute('aria-pressed',String(selected===i));
        b.addEventListener('click',()=>{selected=i;render();});
        noteStrip.append(b);
      }
      stage.replaceChildren(board());
      const n=selection();
      const p=placement(n);
      const selectedStyle=fb.pointStyling({semitones:p.semi,finger:p.f,group:p.group});
      info.textContent=`目前選擇：第 ${n.order} 音 ${n.name} · ${OPEN[p.s].name} 弦${p.semi===0?'（空弦）':'，'+selectedStyle.label+([1,2,3,4].includes(selectedStyle.finger)?'、第 '+selectedStyle.finger+' 指':'（尚未核對指法）')}`;
      fingers.replaceChildren(el('span','teacher-finger-label','左手指號'));
      if(p.semi===0){
        fingers.append(el('span','teacher-open-label','空弦 0 · 不需要按指'));
      }else{
        const values=[null,1,2,3,4];
        for(const f of values){
          const b=el('button','teacher-finger-button',f===null?'未指定':String(f));
          b.type='button';
          b.setAttribute('aria-pressed',String(p.f===f));
          b.addEventListener('click',()=>assignFinger(f));
          fingers.append(b);
        }
      }
    }
    reset.addEventListener('click',()=>{maps[direction]={};selected=0;render();});
    render();
    return {
      element:root,
      getValue(){
        return {
          upMap:Object.keys(maps.up).length?JSON.stringify(maps.up):'',
          downMap:Object.keys(maps.down).length?JSON.stringify(maps.down):''
        };
      }
    };
  }
  fb.createEditor=createEditor;
})();
