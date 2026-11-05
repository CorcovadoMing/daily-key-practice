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

  // Suggested fingerings, based on common closed-hand and 1–2 extension
  // patterns and classical 1st-to-4th / higher-position scale practice.
  // These are editable starting points, not prescribed fingerings from an etude.
  const POSITION_COLORS={
    open:'#ffffff',
    half:'#428b9a',
    first:'#348569',
    extended:'#c99236',
    shifting:'#795bb2',
    high:'#426f9e'
  };
  const BASE_LABELS={
    1:'半把位',2:'第一把位',3:'第一半把位',4:'第二把位',
    5:'第三把位',6:'第三半把位',7:'第四把位',
    8:'第四半把位',9:'第五把位',10:'第五半把位',
    11:'第六把位',12:'第七把位'
  };
  const DEFAULT_FINGERING={
    1:[1,1,false], 2:[1,2,false], 3:[2,2,false],
    4:[3,2,false], 5:[4,2,false], 6:[4,2,true],
    7:[1,7,false], 8:[2,7,false], 9:[3,7,false],
    10:[4,7,false], 11:[4,7,true],
    12:[1,12,false],13:[2,12,false],14:[3,12,false]
  };
  function groupFor(base,extended=false){
    if(extended)return 'extended';
    if(base===1)return 'half';
    if(base===2)return 'first';
    if(base>=8)return 'high';
    return 'shifting';
  }
  function suggestionFor(semi,customFinger=null){
    if(semi===0)return {finger:0,group:'open',hand:'open',label:'空弦',extended:false};
    const predefined=DEFAULT_FINGERING[semi]||[
      ((semi-15)%3+3)%3+1, Math.max(12,semi-((semi-15)%3+3)%3), false
    ];
    let [finger,base,extended]=predefined;
    if([1,2,3,4].includes(customFinger) && customFinger!==finger){
      const offsets=[
        [0,1,2,3], // closed fingering
        [0,2,3,4]  // extended between fingers 1 and 2
      ];
      const candidates=[];
      for(let ext=0;ext<=1;ext++){
        const possibleBase=semi-offsets[ext][customFinger-1];
        if(possibleBase<1||possibleBase>12)continue;
        if(possibleBase>=8&&customFinger===4)continue; // higher-neck technique usually uses 1-3
        candidates.push({base:possibleBase,extended:Boolean(ext),score:
          Math.abs(possibleBase-base)+(ext?.35:0)+(possibleBase>=8&&customFinger===3?0:.0)});
      }
      candidates.sort((a,b)=>a.score-b.score);
      if(candidates.length){base=candidates[0].base;extended=candidates[0].extended;}
      finger=customFinger;
    }
    const label=BASE_LABELS[base]||'高把位';
    return {
      finger,base,group:groupFor(base,extended),hand:String(base),
      label:label+(extended?'延伸':''),extended
    };
  }
  function pointStyling(position){
    return suggestionFor(position.semitones,position.finger);
  }
  function makeLegend(){
    const aside=element('aside',{class:'cello-fb-legend','aria-label':'把位顏色圖例'});
    const title=element('div',{class:'cello-legend-title'},'指板顏色圖例');
    aside.append(title);
    const entries=[
      ['open','空弦'],['half','半把位'],['first','第一把位'],
      ['extended','延伸把位'],['shifting','其他換把位'],['high','高把位']
    ];
    for(const [group,label] of entries){
      const item=element('div',{class:'cello-legend-item'});
      const marker=element('span',{class:'cello-legend-dot '+group});
      marker.style.background=POSITION_COLORS[group];
      item.append(marker,element('span',{},label));
      aside.append(item);
    }
    const shift=element('div',{class:'cello-legend-item'});
    shift.append(element('span',{class:'cello-legend-shift'},'↗'),element('span',{},'換把起點'));
    aside.append(shift);
    aside.append(element('p',{class:'cello-legend-note'},'顏色依參考指法的把位分類；同音可有不同指法，老師可在下方修改。'));
    return aside;
  }

  function chartSVG(mode,key,direction,octaves,annotations={}){
    const notes=scaleNotes(mode,key,direction,octaves);
    const map=decodeMap(direction==='up'?annotations.upMap:annotations.downMap);
    let lastHand=null;
    const plotted=notes.map(note=>{
      const position=notePlacement(note.midi,map);
      const style=pointStyling(position);
      const shift=style.hand!=='open' && lastHand!==null && style.hand!==lastHand;
      if(style.hand!=='open')lastHand=style.hand;
      return {...note,position,style,shift};
    });
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
      const isOpen=note.position.semitones===0,style=note.style;
      const color=isOpen?'#34483a':POSITION_COLORS[style.group];
      const explicit=[1,2,3,4].includes(note.position.finger);
      const point=svgNode('g');
      point.append(svgNode('title',{},
        '第'+note.order+'音 '+note.name+'，'+note.position.stringName+'弦'+
        (isOpen?'，空弦':'，'+style.label+'，參考第'+style.finger+'指')+
        (note.shift?'（這裡建議換把）':'')));
      if(note.shift){
        point.append(svgNode('circle',{cx:x,cy:y,r:20.5,fill:'none',
          stroke:'#3d3658','stroke-width':2.2,'stroke-dasharray':'3 3'}));
        point.append(svgNode('text',{x:x-24,y:y-12,'font-size':15,
          'font-weight':800,fill:'#514476'},'↗'));
      }
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
        point.append(svgNode('text',{
          x:x+21,y:y+16,'font-size':10,'font-weight':750,
          fill:explicit?'#654589':'#777f87'
        },'('+style.finger+')'));
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
    const chart=element('div',{class:'cello-fb-body'});
    chart.append(viewport,makeLegend());
    root.append(toolbar,chart);

    function render(){
      up.setAttribute('aria-pressed',String(direction==='up'));
      down.setAttribute('aria-pressed',String(direction==='down'));
      one.setAttribute('aria-pressed',String(octaves===1));
      two.setAttribute('aria-pressed',String(octaves===2));
      viewport.replaceChildren(chartSVG(mode,key,direction,octaves,annotations));

    }
    render();
    return root;
  }

  window.CelloFingerboard={
    create,
    // Pure helpers exported for automated pitch and placement checks.
    scaleNotes,positionFor,pitchClass,decodeMap,suggestionFor,pointStyling,POSITION_COLORS,makeLegend
  };
})();
