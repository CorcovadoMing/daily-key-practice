/* Clean cello fingerboard note-position diagrams for scale practice.
 * Standard open strings: C2 G2 D3 A3. Circles show left-hand fingers (0 = open string, ? = not specified).
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

  function chartSVG(mode,key,direction,octaves,annotations={},interaction=null,remoteDrafts=[]){
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
    const ghosts=Array.isArray(remoteDrafts)?remoteDrafts.filter(d=>d?.direction===direction).slice(0,6):[];
    // Keep the previous location visible while a new string position is staged.
    const originGhosts=[],ghostPositions=[],replacedByRemote=new Set(),knownOrigins=new Set();
    const addOrigin=(note,position)=>{
      const identity=note.midi+':'+position.string;
      if(knownOrigins.has(identity))return;
      knownOrigins.add(identity);
      originGhosts.push({note,position});
      ghostPositions.push(position.semitones);
    };
    if(interaction?.originalMap!=null){
      const original=decodeMap(interaction.originalMap);
      for(const note of plotted){
        const prior=notePlacement(note.midi,original,presets);
        if(prior.string!==note.position.string)addOrigin(note,prior);
      }
    }
    const confirmedMap=interaction?.confirmedMap!==undefined?
      decodeMap(interaction.confirmedMap):map;
    for(const remote of ghosts){
      const proposed=decodeMap(remote.previewMap);
      const pitches=[...(Array.isArray(remote.changed)?remote.changed:[]),remote.selectedMidi];
      for(const midi of pitches){
        const note=plotted.find(item=>item.midi===midi);
        if(!note)continue;
        const next=notePlacement(midi,proposed,presets);
        if(next.semitones>=0&&next.semitones<=24)ghostPositions.push(next.semitones);
        const prior=notePlacement(midi,confirmedMap,presets);
        if(prior.string!==next.string){
          addOrigin(note,prior);
          if(interaction?.originalMap==null)replacedByRemote.add(midi);
        }
      }
    }
    const maxPosition=Math.max(7,...plotted.map(item=>item.position.semitones),...nearby,
      ...ghostPositions,interaction?.showMore?24:0);
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

    // Faded origin marks are visual only and never counted as extra scale notes.
    for(const {note,position} of originGhosts){
      const x=xPositions[position.string],y=top+position.semitones*step;
      const marker=svgNode('g',{'pointer-events':'none',opacity:.68,'aria-hidden':'true'});
      marker.append(svgNode('circle',{cx:x,cy:y,r:16,
        fill:'#edf1ed',stroke:'#8fa69a','stroke-width':2.2,'stroke-dasharray':'4 3'}));
      marker.append(svgNode('text',{x,y:y+4.5,'text-anchor':'middle',
        'font-size':12,'font-weight':750,fill:'#648072'},String(note.order)));
      marker.append(svgNode('text',{x:x+14,y:y-13,'font-size':10,
        'font-weight':800,fill:'#6e8c7b'},'原'));
      svg.append(marker);
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
      if(replacedByRemote.has(note.midi))continue;
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
      },isOpen?'0':explicit?String(style.finger):'?'));
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
    // Translucent origin circles show where a note came from; pink indicates
    // its unconfirmed destination and blue outlines the selected pitch.
    for(const remote of ghosts){
      const previewMap=decodeMap(remote.previewMap);
      for(const midi of Array.isArray(remote.changed)?remote.changed:[]){
        const note=plotted.find(n=>n.midi===midi);
        if(!note)continue;
        const pos=notePlacement(midi,previewMap,presets);
        const x=xPositions[pos.string],y=top+pos.semitones*step;
        if(pos.semitones>maxPosition)continue;
        svg.append(svgNode('circle',{
          cx:x,cy:y,r:18,fill:'rgba(207,71,116,0.11)',
          stroke:'#ce5078','stroke-width':2.4,'stroke-dasharray':'3 3',
          'pointer-events':'none'
        }));
        if(replacedByRemote.has(midi)){
          svg.append(svgNode('text',{
            x,y:y+4.5,'text-anchor':'middle','font-size':12,
            'font-weight':850,fill:'#bd3c6b','pointer-events':'none'
          },Number.isInteger(pos.finger)?String(pos.finger):'?'));
        }
        if(Number.isInteger(pos.finger)){
          svg.append(svgNode('text',{
            x:x+23,y:y+14,'font-size':13,'font-weight':850,fill:'#bd3c6b',
            opacity:.78,'pointer-events':'none'
          },'('+pos.finger+')'));
        }
      }
      const picked=plotted.find(n=>n.midi===remote.selectedMidi);
      if(picked){
        const pos=notePlacement(picked.midi,previewMap,presets);
        const x=xPositions[pos.string],y=top+pos.semitones*step;
        svg.append(svgNode('rect',{x:x-24,y:y-24,width:48,height:48,rx:9,
          fill:'none',stroke:'#5773b4','stroke-width':2.5,
          'stroke-dasharray':'6 4','pointer-events':'none'
        }));
      }
    }
    return svg;
  }

  // Fixed two-octave scale, independent of the fingerboard octave toggle.
  // Every pitch carries an explicit accidental: no hidden carry across octaves
  // or the melodic-minor descent. These are pitch illustrations, not rhythm.
  function staffStep(note){
    const letters='CDEFGAB',letter=note.name[0];
    let accidental=0;
    for(const c of note.name.slice(1))accidental+=c==='♯'||c==='#'?1:c==='♭'||c==='b'?-1:c==='𝄪'?2:0;
    const octave=Math.round((note.midi-PITCH[letter]-accidental)/12)-1;
    return octave*7+letters.indexOf(letter);
  }
  function makeScore(mode,key){
    const sequence=[...scaleNotes(mode,key,'up',2),...scaleNotes(mode,key,'down',2).slice(1)];
    const wrap=element('div',{class:'cello-scale-score',tabindex:'0','aria-label':'兩個八度上下行五線譜，可橫向捲動'});
    const svg=svgNode('svg',{viewBox:'0 0 1220 185',width:1220,height:185,role:'img','aria-label':key[0]+(mode==='major'?'大調':'旋律小調')+'，低音譜號，兩個八度上下行'});
    svg.append(svgNode('title',{},'兩個八度上行與下行，逐音標示升降記號；向右捲動查看全行'));
    for(let i=0;i<5;i++)svg.append(svgNode('line',{x1:14,x2:1205,y1:110-i*10,y2:110-i*10,stroke:'#81917f','stroke-width':1}));
    // Bass-clef curve and dots anchor the F3 line, avoiding music-font dependency.
    svg.append(svgNode('path',{d:'M 22 82 C 22 63 55 64 51 84 C 49 99 34 108 23 111 C 38 101 45 89 43 78 C 42 70 31 69 28 77',fill:'#34483a'}));
    svg.append(svgNode('circle',{cx:26,cy:79,r:4,fill:'#34483a'}));
    for(const y of [75,85])svg.append(svgNode('circle',{cx:57,cy:y,r:2,fill:'#34483a'}));
    sequence.forEach((note,i)=>{
      const x=88+i*39,y=110-(staffStep(note)-18)*5;
      for(let ly=120;ly<=y;ly+=10)svg.append(svgNode('line',{x1:x-11,x2:x+11,y1:ly,y2:ly,stroke:'#60725e'}));
      for(let ly=60;ly>=y;ly-=10)svg.append(svgNode('line',{x1:x-11,x2:x+11,y1:ly,y2:ly,stroke:'#60725e'}));
      const g=svgNode('g',{'data-midi':note.midi,'data-note':note.name});
      g.append(svgNode('title',{},note.name+' · MIDI '+note.midi));
      g.append(svgNode('text',{x:x-18,y:y+5,'text-anchor':'middle','font-size':17,fill:'#34483a'},note.name.slice(1)||'♮'));
      g.append(svgNode('ellipse',{cx:x,cy:y,rx:6,ry:4,transform:'rotate(-20 '+x+' '+y+')',fill:'#fffffc',stroke:'#34483a','stroke-width':2}));
      svg.append(g);
    });
    svg.append(svgNode('text',{x:88,y:164,'font-size':12,fill:'#647461'},'上行 →'));
    svg.append(svgNode('text',{x:88+15*39,y:164,'font-size':12,fill:'#647461'},'下行 →'));
    wrap.append(svg);return wrap;
  }

  function create(mode,key,initialAnnotations={},onSave=null,onPreview=null){
    const id=(mode==='major'?'major-':'minor-')+key[0];
    let annotations={...initialAnnotations};
    const root=element('div',{class:'cello-fingerboard'});
    const toolbar=element('div',{class:'cello-fb-toolbar'});
    const octaveGroup=element('div',{class:'cello-fb-group','aria-label':'音階八度數'});
    const boards=element('div',{class:'cello-fb-two-up'});
    const panels={};
    let remoteDrafts=[];
    // A single transaction stages any number of note edits for one direction.
    // Only clicking Confirm (or Save in the leave dialog) persists the map.
    const edit={dir:null,midi:null,original:{},pending:{},undo:[],showMore:false};
    let tracking=false,pointer=null;

    function clone(map){return JSON.parse(JSON.stringify(map));}
    function signature(map){
      return JSON.stringify(Object.entries(map).sort(([a],[b])=>Number(a)-Number(b)));
    }
    function isDirty(){return edit.dir!==null&&signature(edit.original)!==signature(edit.pending);}
    function notes(dir){return scaleNotes(mode,key,dir,choices.get(id)||2);}
    function defaultPosition(dir,midi){
      const ref=window.CelloFingeringPresets?.get(mode,key,dir,notes(dir))||{};
      return notePlacement(midi,{},ref);
    }
    function proposedPosition(dir,midi){
      const ref=window.CelloFingeringPresets?.get(mode,key,dir,notes(dir))||{};
      const map=edit.dir===dir?edit.pending:decodeMap(annotations[dir+'Map']);
      return notePlacement(midi,map,ref);
    }
    function selectedNote(){return edit.dir===null?null:notes(edit.dir).find(n=>n.midi===edit.midi);}
    function invalidNotes(){
      if(edit.dir===null)return [];
      return Object.entries(edit.pending).filter(([pitch,pos])=>{
        if(!pos||!Number.isInteger(pos.s)||pos.s<0||pos.s>3)return true;
        const semitone=Number(pitch)-OPEN[pos.s].midi;
        return semitone<0||semitone>24||(semitone===0?pos.f!==0:![1,2,3,4].includes(pos.f));
      });
    }
    function saveAllowed(){return isDirty()&&invalidNotes().length===0&&JSON.stringify(edit.pending).length<=1800;}
    function stopTracking(){
      if(!tracking)return;
      tracking=false;pointer=null;
      document.removeEventListener('pointerdown',onPointerDown,true);
      document.removeEventListener('pointermove',onPointerMove,true);
      document.removeEventListener('pointerup',onPointerUp,true);
      document.removeEventListener('pointercancel',onPointerCancel,true);
      document.removeEventListener('scroll',onScroll,true);
      document.removeEventListener('keydown',onKeydown,true);
    }
    function startTracking(){
      if(tracking||typeof onSave!=='function')return;
      tracking=true;
      document.addEventListener('pointerdown',onPointerDown,true);
      document.addEventListener('pointermove',onPointerMove,true);
      document.addEventListener('pointerup',onPointerUp,true);
      document.addEventListener('pointercancel',onPointerCancel,true);
      document.addEventListener('scroll',onScroll,true);
      document.addEventListener('keydown',onKeydown,true);
    }
    function announceDraft(){
      if(typeof onPreview!=='function')return;
      if(edit.dir===null){onPreview(null);return;}
      const changed=Object.keys({...edit.original,...edit.pending}).filter(k=>
        JSON.stringify(edit.original[k])!==JSON.stringify(edit.pending[k])).map(Number);
      onPreview({direction:edit.dir,selectedMidi:edit.midi,
        previewMap:JSON.stringify(edit.pending),changed});
    }
    function closeEditor(){
      edit.dir=null;edit.midi=null;edit.original={};edit.pending={};
      edit.undo=[];edit.showMore=false;
      stopTracking();
      render();
      announceDraft();
    }
    function saveSession(){
      if(edit.dir===null)return;
      if(!isDirty()){closeEditor();return;}
      if(!saveAllowed()){
        const bad=invalidNotes();
        const warning=panels[edit.dir].hint;
        warning.textContent=bad.length?
          '仍有 '+bad.length+' 個音未設定有效指號；請選擇指號後儲存。':
          '這次修改超過可儲存的長度，請減少修改。';
        if(bad.length)edit.midi=Number(bad[0][0]);
        renderDirection(edit.dir);
        return;
      }
      const dir=edit.dir,value=Object.keys(edit.pending).length?JSON.stringify(edit.pending):'';
      const previous=JSON.stringify(edit.original);
      // The caller merges this transaction's per-note delta into the latest
      // room map so simultaneous changes to different pitches are preserved.
      annotations[dir+'Map']=value;
      closeEditor();
      onSave(dir,value,previous,false);
    }
    function exitEditor(next=null){
      if(edit.dir===null){if(next)next();return;}
      // Pointer-up may already have opened the leave dialog before a card
      // click fires. Update its continuation rather than opening it twice.
      if(dialog.open){pendingAfterExit=next;return;}
      if(isDirty()){
        pendingAfterExit=next;
        dialog.showModal();
        return;
      }
      closeEditor();
      if(next)next();
    }
    let pendingAfterExit=null;
    const dialog=element('dialog',{class:'cello-leave-dialog',
      'aria-label':'未儲存的指法修改'});
    const dialogTitle=element('h3',{},'有尚未確認的修改');
    const dialogText=element('p',{},'要放棄目前暫存的修改，還是儲存修改？');
    const dialogActions=element('div',{class:'cello-leave-actions'});
    const discard=element('button',{type:'button',class:'cello-leave-discard'},'放棄修改');
    const saveExit=element('button',{type:'button',class:'cello-leave-save'},'儲存修改');
    const keep=element('button',{type:'button',class:'cello-leave-keep'},'繼續編輯');
    function afterExit(){const fn=pendingAfterExit;pendingAfterExit=null;if(fn)fn();}
    discard.addEventListener('click',()=>{
      dialog.close();closeEditor();afterExit();
    });
    saveExit.addEventListener('click',()=>{
      if(!saveAllowed()){
        dialog.close();pendingAfterExit=null;saveSession();return;
      }
      dialog.close();saveSession();afterExit();
    });
    keep.addEventListener('click',()=>{dialog.close();pendingAfterExit=null;});
    dialog.addEventListener('cancel',()=>{pendingAfterExit=null;});
    dialogActions.append(discard,saveExit,keep);
    dialog.append(dialogTitle,dialogText,dialogActions);

    function protectedTarget(target){
      return !!(root.contains(target)&&target?.closest?.(
        '.cello-fb-note, .cello-fb-alt, .cello-inline-editor, .cello-fb-button, .cello-leave-dialog'));
    }
    // Decide on pointerup, never pointerdown: a finger swipe is scrolling,
    // not a tap on blank space. Pointercancel/scroll also cancel the gesture.
    function onPointerDown(e){
      if(edit.dir===null||dialog.open)return;
      pointer={id:e.pointerId,x:e.clientX,y:e.clientY,target:e.target,moved:false};
    }
    function onPointerMove(e){
      if(!pointer||e.pointerId!==pointer.id)return;
      if(Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>12)pointer.moved=true;
    }
    function onScroll(){if(pointer)pointer.moved=true;}
    function onPointerCancel(e){if(pointer&&e.pointerId===pointer.id)pointer=null;}
    function onPointerUp(e){
      if(!pointer||e.pointerId!==pointer.id)return;
      const gesture=pointer;pointer=null;
      if(gesture.moved||Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)>12)return;
      if(protectedTarget(gesture.target)||protectedTarget(e.target))return;
      exitEditor();
    }
    function onKeydown(e){
      if(e.key==='Escape'&&edit.dir!==null&&!dialog.open){
        e.preventDefault();exitEditor();
      }
    }

    function begin(dir,midi){
      if(edit.dir!==null&&edit.dir!==dir){
        exitEditor(()=>begin(dir,midi));
        return;
      }
      if(edit.dir===null){
        edit.dir=dir;edit.original=clone(decodeMap(annotations[dir+'Map']));
        edit.pending=clone(edit.original);edit.undo=[];edit.showMore=false;
        startTracking();
      }
      // Selecting a different note never discards staged modifications.
      edit.midi=midi;
      render();
      announceDraft();
    }
    function applyChange(s,f){
      if(edit.dir===null||edit.midi===null)return;
      const midi=edit.midi,semi=midi-OPEN[s].midi;
      if(semi<0||semi>24)return;
      const base=defaultPosition(edit.dir,midi);
      const changed=clone(edit.pending);
      if(s===base.string&&f===base.finger){
        delete changed[String(midi)];
      }else{
        changed[String(midi)]={s,f};
      }
      if(signature(changed)===signature(edit.pending))return;
      edit.undo.push({map:clone(edit.pending),midi});
      edit.pending=changed;
      renderDirection(edit.dir);
      announceDraft();
    }
    function chooseString(s){
      if(edit.dir===null||edit.midi===null)return;
      const midi=edit.midi,semis=midi-OPEN[s].midi;
      if(semis<0||semis>24)return;
      const current=proposedPosition(edit.dir,midi);
      const finger=semis===0?0:([1,2,3,4].includes(current.finger)?current.finger:null);
      applyChange(s,finger);
    }
    function chooseFinger(f){
      if(edit.dir===null||edit.midi===null||![1,2,3,4].includes(f))return;
      const pos=proposedPosition(edit.dir,edit.midi);
      if(edit.midi===OPEN[pos.string].midi)return;
      applyChange(pos.string,f);
    }
    function undo(){
      if(edit.dir===null||!edit.undo.length)return;
      const prior=edit.undo.pop();edit.pending=prior.map;edit.midi=prior.midi;
      renderDirection(edit.dir);
      announceDraft();
    }
    function resetSelected(){
      if(edit.dir===null||edit.midi===null)return;
      const midi=String(edit.midi);
      if(!Object.prototype.hasOwnProperty.call(edit.pending,midi))return;
      // This is one undoable operation in the same global batch stack.
      edit.undo.push({map:clone(edit.pending),midi:edit.midi});
      const changed=clone(edit.pending);
      delete changed[midi];
      edit.pending=changed;
      renderDirection(edit.dir);
      announceDraft();
    }
    function resetAll(){
      if(edit.dir===null||Object.keys(edit.pending).length===0)return;
      // Reset is a staged, undoable batch operation, just like changing one
      // note. No saved fingering changes until the user confirms the edit.
      edit.undo.push({map:clone(edit.pending),midi:edit.midi});
      edit.pending={};
      renderDirection(edit.dir);
      announceDraft();
    }

    for(const dir of ['up','down']){
      const section=element('section',{class:'cello-fb-direction',
        'aria-label':dir==='up'?'上行音階':'下行音階'});
      const heading=element('h4',{class:'cello-fb-direction-heading'});
      const viewport=element('div',{class:'cello-fb-viewport'});
      const editor=element('div',{class:'cello-inline-editor',
        'aria-label':(dir==='up'?'上行':'下行')+'批次編輯音符'});
      editor.hidden=true;
      const status=element('div',{class:'cello-inline-status'});
      const hint=element('p',{class:'cello-inline-hint'},
        '可以連續修改多個音符，最後一次確認；點空白處可選擇儲存或放棄。');
      const range=element('button',{type:'button',class:'cello-inline-range',
        'aria-pressed':'false'},'顯示更多把位');
      const stringChoices=element('div',{class:'cello-inline-choices'});
      const fingerChoices=element('div',{class:'cello-inline-choices'});
      const actions=element('div',{class:'cello-inline-actions'});
      const back=element('button',{type:'button',class:'cello-inline-undo'},'上一步');
      const restoreSelected=element('button',{type:'button',class:'cello-inline-restore-selected',
        title:'將目前選取的粉紅色修改音符還原 Werner 預設，並保留其他音'},'復原選取的修改');
      const reset=element('button',{type:'button',class:'cello-inline-reset',
        title:'暫時將整個方向還原預設；可按「上一步」撤銷，按「確認修改」才儲存'},'復原所有修改');
      const save=element('button',{type:'button',class:'cello-inline-save'},'確認修改');
      back.addEventListener('click',undo);
      restoreSelected.addEventListener('click',resetSelected);
      reset.addEventListener('click',resetAll);
      save.addEventListener('click',saveSession);
      range.addEventListener('click',()=>{edit.showMore=!edit.showMore;renderDirection(dir);});
      actions.append(back,restoreSelected,reset,save);
      editor.append(status,hint,range,stringChoices,fingerChoices,actions);
      const legend=makeLegend();
      const memo=element('div',{class:'fingering-note'});
      memo.hidden=true;
      section.append(heading,viewport,editor,legend,memo);
      boards.append(section);
      panels[dir]={heading,viewport,editor,status,hint,stringChoices,
        fingerChoices,range,back,restoreSelected,reset,save,memo};
    }
    root.append(makeScore(mode,key),toolbar,boards,dialog);

    function renderDirection(dir){
      const pane=panels[dir],editing=edit.dir===dir;
      const saved=decodeMap(annotations[dir+'Map']);
      pane.heading.textContent=dir==='up'?'↑ 上行':'↓ 下行';
      if(remoteDrafts.some(remote=>remote.direction===dir)){
        pane.heading.append(element('span',{class:'cello-fb-remote-label'},'（其他人編輯中）'));
      }
      if(Object.keys(saved).length||(dir==='up'?annotations.up:annotations.down)){
        pane.heading.append(element('span',{class:'cello-fb-changed'},'（已修改）'));
      }
      const memo=dir==='up'?annotations.up:annotations.down;
      pane.memo.textContent=memo||'';pane.memo.hidden=!memo;
      const value=editing?(Object.keys(edit.pending).length?JSON.stringify(edit.pending):''):
        annotations[dir+'Map']||'';
      pane.viewport.replaceChildren(chartSVG(mode,key,dir,choices.get(id)||2,
        {...annotations,[dir+'Map']:value},
        typeof onSave==='function'?{
          selectedMidi:editing?edit.midi:null,
          originalMap:editing?JSON.stringify(edit.original):null,
          confirmedMap:annotations[dir+'Map']||'',
          select:midi=>begin(dir,midi),
          chooseString:s=>chooseString(s),showMore:editing&&edit.showMore
        }:null,remoteDrafts));
      pane.editor.hidden=!editing;
      if(!editing)return;
      const count=Object.keys(edit.pending).length;
      const diff=Object.keys({...edit.original,...edit.pending}).filter(k=>
        JSON.stringify(edit.original[k])!==JSON.stringify(edit.pending[k])).length;
      const invalid=invalidNotes().length;
      pane.status.textContent='暫存 '+diff+' 個音的修改'+
        (invalid?' · '+invalid+' 個音待設定指號':'');
      pane.hint.textContent=invalid?
        '請先為未設定指號的音選擇 1～4 指，再確認整批修改。':
        '可連續改多個音；上一步只撤銷最後一個操作。';
      pane.range.textContent=edit.showMore?'收起高把位':'顯示更多把位';
      pane.range.setAttribute('aria-pressed',String(edit.showMore));
      pane.back.disabled=edit.undo.length===0;
      pane.restoreSelected.disabled=edit.midi===null||
        !Object.prototype.hasOwnProperty.call(edit.pending,String(edit.midi));
      pane.reset.disabled=Object.keys(edit.pending).length===0;
      pane.save.disabled=!isDirty()||invalid>0;
      pane.stringChoices.replaceChildren();
      pane.fingerChoices.replaceChildren();
      const note=selectedNote();
      if(!note){
        pane.stringChoices.append(element('span',{class:'cello-inline-label'},'點選要修改的音符'));
        return;
      }
      const current=proposedPosition(dir,note.midi);
      const semi=note.midi-OPEN[current.string].midi;
      const noteLabel=element('div',{class:'cello-inline-label'},
        '選取：第 '+note.order+' 音 '+note.name+' · '+OPEN[current.string].name+' 弦');
      pane.stringChoices.append(noteLabel);
      for(let s=0;s<OPEN.length;s++){
        const offset=note.midi-OPEN[s].midi;
        if(offset<0||offset>24)continue;
        const btn=element('button',{type:'button',class:'cello-inline-choice',
          'aria-pressed':String(current.string===s)},
          OPEN[s].name+' 弦'+(offset===0?' · 空弦':' · '+offset+' 半音'));
        btn.addEventListener('click',()=>chooseString(s));
        pane.stringChoices.append(btn);
      }
      if(semi===0){
        pane.fingerChoices.append(element('span',{class:'cello-inline-open'},'空弦 · 指號 0'));
      }else{
        pane.fingerChoices.append(element('span',{class:'cello-inline-label'},'左手指號'));
        for(let finger=1;finger<=4;finger++){
          const btn=element('button',{type:'button',class:'cello-inline-finger',
            'aria-pressed':String(current.finger===finger)},String(finger));
          btn.addEventListener('click',()=>chooseFinger(finger));
          pane.fingerChoices.append(btn);
        }
      }
    }
    function render(){
      const count=choices.get(id)||2;
      one.setAttribute('aria-pressed',String(count===1));
      two.setAttribute('aria-pressed',String(count===2));
      renderDirection('up');renderDirection('down');
    }
    function addButton(label,count){
      const btn=element('button',{type:'button',class:'cello-fb-button'},label);
      btn.addEventListener('click',()=>{
        // Switching octaves retains the current pending multi-note transaction.
        choices.set(id,count);
        if(edit.dir!==null&&edit.midi!==null&&!notes(edit.dir).some(n=>n.midi===edit.midi)){
          edit.midi=null;
        }
        render();
      });
      octaveGroup.append(btn);return btn;
    }
    const one=addButton('1 八度',1),two=addButton('2 八度',2);
    toolbar.append(octaveGroup);
    if(!choices.has(id))choices.set(id,2);
    root.isEditing=()=>edit.dir!==null;
    root.requestLeave=next=>exitEditor(next);
    root.setRemoteDrafts=(incoming)=>{
      const next=Array.isArray(incoming)?incoming.filter(Boolean).slice(0,8):[];
      if(JSON.stringify(remoteDrafts)===JSON.stringify(next))return;
      remoteDrafts=next;
      renderDirection('up');renderDirection('down');
    };
    root.updateAnnotations=(incoming)=>{
      const value=incoming&&typeof incoming==='object'?incoming:{};
      if(JSON.stringify(value)===JSON.stringify(annotations))return;
      annotations={...value};
      renderDirection('up');renderDirection('down');
    };
    render();
    return root;
  }

  window.CelloFingerboard={
    create,
    // Pure helpers exported for automated pitch and placement checks.
    staffStep,makeScore,scaleNotes,positionFor,pitchClass,decodeMap,pointStyling,POSITION_COLORS,makeLegend,notePlacement
  };
})();
