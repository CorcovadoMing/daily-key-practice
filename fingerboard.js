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

  function notePlacement(midi,map){
    const fallback=positionFor(midi);
    const custom=map[String(midi)];
    if(!custom || !Number.isInteger(custom.s) || custom.s<0 || custom.s>3)return {...fallback,finger:null};
    const semitones=midi-OPEN[custom.s].midi;
    if(semitones<0 || semitones>24)return {...fallback,finger:null};
    const finger=semitones===0?0:([1,2,3,4].includes(custom.f)?custom.f:null);
    return {string:custom.s,stringName:OPEN[custom.s].name,semitones,finger};
  }

  // Reference only: common first / fourth position finger choices.
  // Higher positions and some extensions depend on the teacher's technique.
  const FINGER_SUGGESTION={1:'1↓',2:'1',3:'2',4:'3',5:'4',7:'1',8:'2',9:'3',10:'4'};
  function displayedFinger(position){
    if(position.semitones===0)return null;
    if([1,2,3,4].includes(position.finger))return String(position.finger);
    return FINGER_SUGGESTION[position.semitones] || '—';
  }

  function chartSVG(mode,key,direction,octaves,annotations={}){
    const notes=scaleNotes(mode,key,direction,octaves);
    const map=decodeMap(direction==='up'?annotations.upMap:annotations.downMap);
    const plotted=notes.map(note=>({...note,position:notePlacement(note.midi,map)}));
    const maxPosition=Math.max(7,...plotted.map(item=>item.position.semitones));
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

    for(const note of plotted){
      const x=xPositions[note.position.string],y=top+note.position.semitones*step;
      const rootOrEnd=note.order===1||note.order===notes.length;
      const color=note.order===1?'#2e7049':rootOrEnd?'#527e5a':'#364c3b';
      const isOpen=note.position.semitones===0;
      const finger=displayedFinger(note.position);
      const label=isOpen?'':note.name;
      const point=svgNode('g');
      point.append(svgNode('title',{},
        '第'+note.order+'音 '+note.name+'，'+note.position.stringName+
        '弦，距空弦 '+note.position.semitones+' 個半音'+(finger?'，參考指號 '+finger:'')));
      point.append(svgNode('circle',{
        cx:x,cy:y,r:15.5,fill:isOpen?'#f7f9f6':color,stroke:isOpen?color:'#ffffff','stroke-width':isOpen?3:2.1
      }));
      point.append(svgNode('text',{
        x,y:y+4.5,'text-anchor':'middle','font-size':12.5,
        'font-weight':800,fill:isOpen?color:'#ffffff'
      },String(note.order)));
      // Open strings are self-evident on the nut: circle and playing-order only.
      // For stopped notes, show note name with a compact fingering beneath.
      if(!isOpen){
        point.append(svgNode('text',{
          x:x+21,y:y+1,'font-size':13,
          'font-weight':rootOrEnd?800:650,fill:'#273c2e'
        },label));
        point.append(svgNode('text',{
          x:x+21,y:y+16,'font-size':10,
          'font-weight':700,fill:note.position.finger?'#654589':'#8b719a'
        },'('+finger+')'));
      }
      svg.append(point);
    }
    return svg;
  }

  function create(mode,key,annotations={}){
    const id=(mode==='major'?'major-':'minor-')+key[0];
    const prev=choices.get(id)||{direction:'up',octaves:2};
    let direction=prev.direction,octaves=prev.octaves;
    const root=element('div',{class:'cello-fingerboard'});
    const toolbar=element('div',{class:'cello-fb-toolbar'});
    const directions=element('div',{class:'cello-fb-group','aria-label':'音階方向'});
    const octavesGroup=element('div',{class:'cello-fb-group','aria-label':'音階八度數'});
    const viewport=element('div',{class:'cello-fb-viewport'});
    const sequence=element('div',{class:'cello-fb-sequence'});
    const note=element('div',{class:'cello-fb-caption'},
      '圓點數字＝演奏順序，不是左手指號。四弦 C–G–D–A，點的位置為示意音位；實際演奏可依老師指法換弦／換把。');

    function addButton(group,label,value,type){
      const button=element('button',{type:'button',class:'cello-fb-button'},label);
      button.addEventListener('click',()=>{
        if(type==='direction')direction=value;
        else octaves=value;
        choices.set(id,{direction,octaves});
        render();
      });
      group.append(button);
      return button;
    }
    const up=addButton(directions,'↑ 上行','up','direction');
    const down=addButton(directions,'↓ 下行','down','direction');
    const one=addButton(octavesGroup,'1 八度',1,'octaves');
    const two=addButton(octavesGroup,'2 八度',2,'octaves');
    toolbar.append(directions,octavesGroup);
    root.append(toolbar,viewport,sequence,note);

    function render(){
      up.setAttribute('aria-pressed',String(direction==='up'));
      down.setAttribute('aria-pressed',String(direction==='down'));
      one.setAttribute('aria-pressed',String(octaves===1));
      two.setAttribute('aria-pressed',String(octaves===2));
      viewport.replaceChildren(chartSVG(mode,key,direction,octaves,annotations));
      const notes=scaleNotes(mode,key,direction,octaves);
      sequence.textContent=notes.map(item=>item.order+' '+item.name).join(' → ');
    }
    render();
    return root;
  }

  window.CelloFingerboard={
    create,
    // Pure helpers exported for automated pitch and placement checks.
    scaleNotes,positionFor,pitchClass,decodeMap
  };
})();
