/* Clean cello fingerboard note-position diagrams for scale practice.
 * Standard open strings: C2 G2 D3 A3. Circles show scale order, NOT left-hand fingers.
 * A schematic semitone spacing is used for legibility; physical distances are not to scale.
 * Per-note string choices favor the highest possible open string / lowest stopped position.
 */
(function(){
  'use strict';

  const NS='http://www.w3.org/2000/svg';
  const OPEN=[
    {name:'C',midi:36},
    {name:'G',midi:43},
    {name:'D',midi:50},
    {name:'A',midi:57}
  ];
  const PITCH={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
  const STEPS={
    major:[0,2,4,5,7,9,11],
    melodic:[0,2,3,5,7,9,11],
    natural:[0,2,3,5,7,8,10]
  };
  const choices=new Map();

  function pitchClass(name){
    let value=PITCH[name[0]];
    if(value===undefined)throw new Error('Invalid tonic: '+name);
    for(const char of name.slice(1)){
      if(char==='♯'||char==='#')value++;
      if(char==='♭'||char==='b')value--;
      if(char==='𝄪')value+=2;
    }
    return (value%12+12)%12;
  }

  function scaleNotes(mode,key,direction,octaves){
    const root=36+pitchClass(key[0]);
    const noteNames=mode==='major'?key[2].split(' '):
      (direction==='up'?key[2]:key[3]).split(' ');
    const intervals=mode==='major'?STEPS.major:
      direction==='up'?STEPS.melodic:STEPS.natural;
    const sequence=[];
    for(let octave=0;octave<octaves;octave++){
      for(let degree=0;degree<7;degree++){
        sequence.push({name:noteNames[degree],midi:root+octave*12+intervals[degree]});
      }
    }
    sequence.push({name:noteNames[0],midi:root+octaves*12});
    if(direction==='down')sequence.reverse();
    return sequence.map((note,i)=>({...note,order:i+1}));
  }

  function positionFor(midi){
    const candidates=OPEN.map((string,index)=>({
      string:index,
      stringName:string.name,
      semitones:midi-string.midi
    })).filter(entry=>entry.semitones>=0&&entry.semitones<=24);
    if(!candidates.length)throw new Error('Outside supported cello range: '+midi);
    // Prefer a less-shifted placement on the higher string.
    candidates.sort((a,b)=>a.semitones-b.semitones);
    return candidates[0];
  }

  function element(tag,attrs={},text){
    const node=document.createElement(tag);
    for(const [name,value] of Object.entries(attrs))node.setAttribute(name,String(value));
    if(text!==undefined)node.textContent=text;
    return node;
  }

  function svgNode(tag,attrs={},text){
    const node=document.createElementNS(NS,tag);
    for(const [name,value] of Object.entries(attrs))node.setAttribute(name,String(value));
    if(text!==undefined)node.textContent=text;
    return node;
  }

  function decodeMap(value){
    if(!value || typeof value!=='string')return {};
    try{
      const data=JSON.parse(value);
      return data && typeof data==='object' && !Array.isArray(data)?data:{};
    }catch{return {};}
  }

  function notePlacement(midi,map,presets={}){
    const p=presets[String(midi)],fallback=positionFor(midi);
    const base=p?{string:p.s,stringName:OPEN[p.s].name,semitones:midi-OPEN[p.s].midi,
      finger:p.f,group:p.group,custom:false}:{...fallback,finger:null,group:'unverified',custom:false};
    const custom=map[String(midi)];
    if(!custom||!Number.isInteger(custom.s)||custom.s<0||custom.s>3)return base;
    const semi=midi-OPEN[custom.s].midi;
    if(semi<0||semi>24)return base;
    const same=Boolean(p&&p.s===custom.s);
    const finger=semi===0?0:([1,2,3,4].includes(custom.f)?custom.f:
      same?p.f:null);
    return {string:custom.s,stringName:OPEN[custom.s].name,semitones:semi,
      finger,group:same?p.group:'custom',custom:true};
  }

  // Presentation colors do not assert a particular hand position for
  // unverified notes. Only the user's photographed fingerings set groups.
  const POSITION_COLORS={
    open:'#ffffff',
    half:'#428b9a',
    first:'#348569',
    extended:'#c99236',
    shifting:'#795bb2',
    high:'#426f9e',
    unverified:'#8f9a97',
    custom:'#be476c'
  };
  function pointStyling(position){
    const group=position.semitones===0?'open':(position.group||'unverified');
    const label={open:'空弦',half:'半把位',first:'第一把位',
      extended:'延伸手型',shifting:'其他把位',high:'高把位',
      custom:'已修改',unverified:'照片尚未核對'}[group]||'照片尚未核對';
    return {finger:position.finger,group,label};
  }
  function makeLegend(){
    const aside=element('aside',{class:'cello-fb-legend','aria-label':'把位顏色圖例'});
    const title=element('div',{class:'cello-legend-title'},'指板顏色圖例');
    aside.append(title);
    const entries=[
      ['open','空弦'],['half','半把位'],['first','第一把位'],
      ['extended','延伸把位'],['shifting','其他把位'],['high','高把位'],
      ['custom','老師／學生修改']
    ];
    for(const [group,label] of entries){
      const item=element('div',{class:'cello-legend-item'});
      const marker=element('span',{class:'cello-legend-dot '+group});
      marker.style.background=POSITION_COLORS[group];
      item.append(marker,element('span',{},label));
      aside.append(item);
    }
    return aside;
  }

  function chartSVG(mode,key,direction,octaves,annotations={},interaction=null){
    const notes=scaleNotes(mode,key,direction,octaves);
    const map=decodeMap(direction==='up'?annotations.upMap:annotations.downMap);
    const presets=window.CelloFingeringPresets?.get(mode,key,direction,notes)||{};
    const plotted=notes.map(note=>{
      const position=notePlacement(note.midi,map,presets);
      return {...note,position,style:pointStyling(position)};
    });
    // While editing, reveal nearby equivalent pitches on other strings.
    // Very high alternatives remain available in the buttons below.
    const editableMidi=interaction?.selectedMidi;
    const nearby=editableMidi===null||editableMidi===undefined?[]:
      OPEN.map(item=>editableMidi-item.midi).filter(n=>n>=0&&n<=14);
    const maxPosition=Math.max(7,...plotted.map(item=>item.position.semitones),...nearby);
    const top=68,step=35,height=top+maxPosition*step+47;
    const xPositions=[42,126,210,294], end=top+maxPosition*step+22;
    const svg=svgNode('svg',{
      viewBox:'0 0 370 '+height,
      role:'img',
      'aria-label':key[0]+(mode==='major'?'大調':'古典旋律小調')+
        (direction==='up'?'上行':'下行')+octaves+'個八度大提琴指板音位圖',
      class:'cello-fb-svg'
    });
    svg.append(svgNode('title',{},key[0]+' '+(direction==='up'?'上行':'下行')+'指板音位'));
    svg.append(svgNode('rect',{x:18,y:56,width:333,height:end-56+3,rx:12,fill:'#f7f9f6'}));
    for(let i=0;i<OPEN.length;i++){
      const x=xPositions[i],thickness=1.4+(3-i)*.34;
      svg.append(svgNode('line',{x1:x,y1:69,x2:x,y2:end,stroke:'#a8b9aa','stroke-width':thickness}));
      svg.append(svgNode('text',{x,y:36,'text-anchor':'middle','font-size':15,'font-weight':800,fill:'#34513d'},OPEN[i].name));
      svg.append(svgNode('text',{x,y:49,'text-anchor':'middle','font-size':9,fill:'#889a8e'},'弦'));
    }
    svg.append(svgNode('line',{x1:xPositions[0]-12,y1:68,x2:xPositions[3]+12,y2:68,stroke:'#34483a','stroke-width':5,'stroke-linecap':'round'}));
    // Subtle position guides. Not literal physical frets (a cello has no frets).
    for(const fret of [4,7,12,17,24]){
      if(fret>=maxPosition)continue;
      const y=top+fret*step;
      svg.append(svgNode('line',{x1:24,y1:y,x2:340,y2:y,stroke:'#e3eae2','stroke-width':1,'stroke-dasharray':'3 6'}));
    }

    if(interaction && editableMidi!==null && editableMidi!==undefined){
      const active=plotted.find(n=>n.midi===editableMidi);
      if(active){
        for(let s=0;s<OPEN.length;s++){
          const semi=editableMidi-OPEN[s].midi;
          if(semi<0||semi>maxPosition||s===active.position.string)continue;
          const x=xPositions[s],y=top+semi*step;
          const target=svgNode('g',{role:'button',tabindex:'0',
            class:'cello-fb-alt',
            'aria-label':'將音符換到'+OPEN[s].name+'弦，同音高位置'});
          target.append(svgNode('circle',{cx:x,cy:y,r:11,fill:'#d6f1da',
            stroke:'#428455','stroke-width':2,'stroke-dasharray':'2 2'}));
          target.append(svgNode('text',{x,y:y+4,'text-anchor':'middle',
            'font-size':13,'font-weight':850,fill:'#356f44'},'+'));
          target.append(svgNode('circle',{cx:x,cy:y,r:19,
            fill:'transparent','pointer-events':'all'}));
          target.addEventListener('click',()=>interaction.chooseString(s));
          target.addEventListener('keydown',event=>{
            if(event.key==='Enter'||event.key===' '){
              event.preventDefault();interaction.chooseString(s);
            }
          });
          svg.append(target);
        }
      }
    }

    for(const note of plotted){
      const x=xPositions[note.position.string],y=top+note.position.semitones*step;
      const isOpen=note.position.semitones===0,style=note.style;
      const color=isOpen?'#34483a':POSITION_COLORS[style.group];
      const explicit=[1,2,3,4].includes(note.position.finger);
      const modified=note.position.custom===true;
      const point=svgNode('g',interaction?{
        role:'button',tabindex:'0',class:'cello-fb-note',
        'aria-label':'選擇第'+note.order+'音 '+note.name+'，編輯同音高弦位及指號',
        'aria-pressed':String(interaction.selectedMidi===note.midi)
      }:{});
      point.append(svgNode('title',{},
        '第'+note.order+'音 '+note.name+'，'+note.position.stringName+'弦'+
        (isOpen?'，空弦':'，'+style.label+(explicit?'，第'+style.finger+'指':''))));
      point.append(svgNode('circle',{
        cx:x,cy:y,r:15.5,fill:isOpen?'#f7f9f6':color,
        stroke:isOpen?'#34483a':'#ffffff','stroke-width':isOpen?3:2.1
      }));
      point.append(svgNode('text',{
        x,y:y+4.5,'text-anchor':'middle','font-size':12.5,
        'font-weight':800,fill:isOpen?'#34483a':'#ffffff'
      },String(note.order)));
      if(!isOpen){
        point.append(svgNode('text',{
          x:x+21,y:y+1,'font-size':13,
          'font-weight':note.order===1||note.order===notes.length?800:650,
          fill:'#273c2e'
        },note.name));
        if(explicit){
          if(modified)point.append(svgNode('rect',{
            x:x+18,y:y+4,width:28,height:17,rx:5,fill:'#fff0f5',
            stroke:'#d15c80','stroke-width':1
          }));
          point.append(svgNode('text',{
            x:x+21,y:y+16,'font-size':modified?12:10,
            'font-weight':modified?900:750,
            fill:modified?'#a82055':'#675879'
          },'('+style.finger+')'));
        }
      }
      if(interaction){
        // An invisible touch target makes the same displayed marker usable on phones.
        point.append(svgNode('circle',{cx:x,cy:y,r:23,fill:'transparent',
          stroke:'none','pointer-events':'all'}));
        if(interaction.selectedMidi===note.midi){
          point.append(svgNode('circle',{cx:x,cy:y,r:20,fill:'none',
            stroke:'#d28747','stroke-width':3,'pointer-events':'none'}));
        }
        point.addEventListener('click',()=>interaction.select(note.midi));
        point.addEventListener('keydown',event=>{
          if(event.key==='Enter'||event.key===' '){
            event.preventDefault();interaction.select(note.midi);
          }
        });
      }
      svg.append(point);
    }
    return svg;
  }

  function create(mode,key,initialAnnotations={},onSave=null){
    const id=(mode==='major'?'major-':'minor-')+key[0];
    let annotations={...initialAnnotations};
    const octaves=choices.get(id)||2;
    const root=element('div',{class:'cello-fingerboard'});
    const toolbar=element('div',{class:'cello-fb-toolbar'});
    const octaveGroup=element('div',{class:'cello-fb-group','aria-label':'音階八度數'});
    const boards=element('div',{class:'cello-fb-two-up'});
    const panels={},selected={up:null,down:null},draft={up:null,down:null};

    function notes(dir){return scaleNotes(mode,key,dir,choices.get(id)||2);}
    function reference(dir,midi){
      const proposals=window.CelloFingeringPresets?.get(mode,key,dir,notes(dir))||{};
      return notePlacement(midi,{},proposals);
    }
    function current(dir,midi){
      const proposals=window.CelloFingeringPresets?.get(mode,key,dir,notes(dir))||{};
      return notePlacement(midi,decodeMap(annotations[dir+'Map']),proposals);
    }
    function selectedNote(dir){return notes(dir).find(n=>n.midi===selected[dir]);}

    function selectNote(dir,midi){
      if(typeof onSave!=='function')return;
      if(selected[dir]!==midi){
        const pos=current(dir,midi);
        draft[dir]={s:pos.string,f:pos.finger,reset:false};
      }
      selected[dir]=midi;
      renderDirection(dir);
    }
    function chooseString(dir,s){
      const midi=selected[dir],entry=draft[dir];
      if(midi===null||!entry)return;
      const semi=midi-OPEN[s].midi;
      if(semi<0||semi>24)return;
      entry.s=s;
      entry.f=semi===0?0:([1,2,3,4].includes(entry.f)?entry.f:null);
      entry.reset=false;
      renderDirection(dir);
    }
    function chooseFinger(dir,f){
      const entry=draft[dir],midi=selected[dir];
      if(!entry||midi===null||midi===OPEN[entry.s].midi||![1,2,3,4].includes(f))return;
      entry.f=f;entry.reset=false;
      renderDirection(dir);
    }
    function restore(dir){
      const midi=selected[dir];
      if(midi===null)return;
      const orig=reference(dir,midi);
      draft[dir]={s:orig.string,f:orig.finger,reset:true};
      renderDirection(dir);
    }
    function confirm(dir){
      const midi=selected[dir],entry=draft[dir];
      if(midi===null||!entry)return;
      const semi=midi-OPEN[entry.s].midi;
      if(semi<0||semi>24||(semi>0&&![1,2,3,4].includes(entry.f)))return;
      const previous=decodeMap(annotations[dir+'Map']);
      const next={...previous};
      const base=reference(dir,midi);
      if(entry.reset||(entry.s===base.string&&entry.f===base.finger)){
        delete next[String(midi)];
      }else{
        next[String(midi)]={s:entry.s,f:semi===0?0:entry.f};
      }
      const value=Object.keys(next).length?JSON.stringify(next):'';
      if(value.length>1800)return;
      annotations={...annotations,[dir+'Map']:value};
      selected[dir]=null;draft[dir]=null;
      renderDirection(dir);
      onSave(dir,value);
    }

    for(const dir of ['up','down']){
      const section=element('section',{class:'cello-fb-direction',
        'aria-label':dir==='up'?'上行音階':'下行音階'});
      const heading=element('h4',{class:'cello-fb-direction-heading'});
      const viewport=element('div',{class:'cello-fb-viewport'});
      const editor=element('div',{class:'cello-inline-editor',
        'aria-label':(dir==='up'?'上行':'下行')+'直接編輯音符'});
      editor.hidden=true;
      const status=element('div',{class:'cello-inline-status'});
      const hint=element('p',{class:'cello-inline-hint'},
        '點圖上的綠色＋位置，或選擇下方同音高弦位，再設定指號。按確認才會儲存。');
      const stringChoices=element('div',{class:'cello-inline-choices'});
      const fingerChoices=element('div',{class:'cello-inline-choices'});
      const actions=element('div',{class:'cello-inline-actions'});
      const reset=element('button',{type:'button',class:'cello-inline-reset',
        title:'將選中的音符恢復成原本的 Werner 指法，按確認後儲存'},'復原');
      const save=element('button',{type:'button',class:'cello-inline-save'},'確認修改');
      reset.addEventListener('click',()=>restore(dir));
      save.addEventListener('click',()=>confirm(dir));
      actions.append(reset,save);
      editor.append(status,hint,stringChoices,fingerChoices,actions);
      const legend=makeLegend();
      const memo=element('div',{class:'fingering-note'});
      memo.hidden=true;
      section.append(heading,viewport,editor,legend,memo);
      boards.append(section);
      panels[dir]={heading,viewport,editor,status,stringChoices,fingerChoices,
        save,memo};
    }

    function renderDirection(dir){
      const pane=panels[dir],notesForDir=notes(dir);
      if(selected[dir]!==null&&!notesForDir.some(n=>n.midi===selected[dir])){
        selected[dir]=null;draft[dir]=null;
      }
      const saved=decodeMap(annotations[dir+'Map']);
      pane.heading.textContent=dir==='up'?'↑ 上行':'↓ 下行';
      if(Object.keys(saved).length||(dir==='up'?annotations.up:annotations.down)){
        pane.heading.append(element('span',{class:'cello-fb-changed'},'（已修改）'));
      }
      const memo=dir==='up'?annotations.up:annotations.down;
      pane.memo.textContent=memo||'';
      pane.memo.hidden=!memo;
      const preview={...saved};
      const chosen=selected[dir],entry=draft[dir];
      if(chosen!==null&&entry){
        if(entry.reset)delete preview[String(chosen)];
        else preview[String(chosen)]={s:entry.s,f:entry.f};
      }
      const picture={...annotations,[dir+'Map']:Object.keys(preview).length?
        JSON.stringify(preview):''};
      pane.viewport.replaceChildren(chartSVG(mode,key,dir,choices.get(id)||2,
        picture,typeof onSave==='function'?{
          selectedMidi:chosen,select:midi=>selectNote(dir,midi),
          chooseString:s=>chooseString(dir,s)
        }:null));
      pane.editor.hidden=chosen===null;
      if(chosen===null)return;
      const note=selectedNote(dir);
      if(!note||!entry)return;
      const semi=chosen-OPEN[entry.s].midi;
      pane.status.textContent='第 '+note.order+' 音 · '+note.name+
        '  ｜  '+OPEN[entry.s].name+' 弦'+
        (semi===0?'（空弦）':' · '+semi+' 個半音位置');
      pane.stringChoices.replaceChildren();
      for(let s=0;s<OPEN.length;s++){
        const offset=chosen-OPEN[s].midi;
        if(offset<0||offset>24)continue;
        const btn=element('button',{type:'button',class:'cello-inline-choice',
          'aria-pressed':String(entry.s===s)},
          OPEN[s].name+' 弦'+(offset===0?' · 空弦':' · '+offset+' 半音'));
        btn.addEventListener('click',()=>chooseString(dir,s));
        pane.stringChoices.append(btn);
      }
      pane.fingerChoices.replaceChildren();
      if(semi===0){
        pane.fingerChoices.append(element('span',{class:'cello-inline-open'},
          '空弦 · 指號 0'));
      }else{
        pane.fingerChoices.append(element('span',{class:'cello-inline-label'},
          '左手指號'));
        for(let finger=1;finger<=4;finger++){
          const btn=element('button',{type:'button',class:'cello-inline-finger',
            'aria-pressed':String(entry.f===finger)},String(finger));
          btn.addEventListener('click',()=>chooseFinger(dir,finger));
          pane.fingerChoices.append(btn);
        }
      }
      pane.save.disabled=semi>0&&![1,2,3,4].includes(entry.f);
    }

    function render(){
      const count=choices.get(id)||2;
      one.setAttribute('aria-pressed',String(count===1));
      two.setAttribute('aria-pressed',String(count===2));
      renderDirection('up');
      renderDirection('down');
    }
    function addButton(label,count){
      const btn=element('button',{type:'button',class:'cello-fb-button'},label);
      btn.addEventListener('click',()=>{choices.set(id,count);render();});
      octaveGroup.append(btn);
      return btn;
    }
    const one=addButton('1 八度',1);
    const two=addButton('2 八度',2);
    toolbar.append(octaveGroup);
    root.append(toolbar,boards);
    if(!choices.has(id))choices.set(id,octaves);
    render();
    return root;
  }

  window.CelloFingerboard={
    create,
    // Pure helpers exported for automated pitch and placement checks.
    scaleNotes,positionFor,pitchClass,decodeMap,pointStyling,POSITION_COLORS,makeLegend,notePlacement
  };
})();
