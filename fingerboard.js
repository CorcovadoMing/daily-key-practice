/* Clean cello fingerboard note-position diagrams for scale practice.
 * Standard open strings: C2 G2 D3 A3. Circles show left-hand fingers (0 = open string, ? = not specified).
 * A schematic semitone spacing is used for legibility; physical distances are not to scale.
 * Computed default routes minimize hand shifts within bounded playable hand states.
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
  const PRACTICE_OCTAVES=2;
  let stringOrder='CGDA';

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

  // Read-only triad projection of the existing two-octave scale spelling.
  function arpeggioNotes(mode,key,direction){
    const indices=direction==='up'?[0,2,4,7,9,11,14]:[0,3,5,7,10,12,14];
    const scale=scaleNotes(mode,key,direction,2);
    return indices.map((index,i)=>({...scale[index],order:i+1}));
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
      finger:p.f,group:p.f===0?'open':p.group,positionLabel:p.f===0?'空弦':p.positionLabel,
      ...(p.f===0?{}:p.technique==='naturalHarmonic'?{technique:p.technique,harmonic:p.harmonic}:{anchor:p.anchor,shape:p.shape,displayExtended:p.displayExtended}),custom:false}:{...fallback,finger:null,group:'unverified',custom:false};
    const custom=map[String(midi)];
    if(!custom||!Number.isInteger(custom.s)||custom.s<0||custom.s>3)return base;
    const semi=midi-OPEN[custom.s].midi;
    if(semi<0||semi>24)return base;
    const same=Boolean(p&&p.s===custom.s);
    const finger=semi===0?0:([1,2,3,4].includes(custom.f)?custom.f:
      same?p.f:null);
    return {string:custom.s,stringName:OPEN[custom.s].name,semitones:semi,
      finger,group:'custom',positionLabel:'老師／學生修改（把位未核對）',custom:true};
  }

  // A reviewed one-off movement cue survives only while BOTH physical notes
  // still match its reviewed string/finger, including saved/custom edits.
  function resolvedShiftCue(midi,map,presets){
    const p=presets[String(midi)],cue=p?.shiftCue;
    if(!cue)return null;
    const changed=(custom,s,f)=>custom&&(custom.s!==s||(custom.f!=null&&custom.f!==f));
    if(changed(map[String(midi)],p.s,p.f)||changed(map[String(cue.toMidi)],cue.s,cue.f))return null;
    const current=notePlacement(midi,map,presets),next=notePlacement(cue.toMidi,map,presets);
    return current.string===p.s&&current.finger===p.f&&
      next.string===cue.s&&next.finger===cue.f?cue:null;
  }

  // Chart supplied by Ming, Slack1794717734.119329. Photo-sampled colors;
  // position is assigned only from a reviewed hand anchor, never pitch alone.
  const CHART_POSITIONS=[null,
    ['半把位','#5872a5'],['第一把位','#688d62'],
    ['上第一把位／下第二把位','#b06261'],['上第二把位','#7a4c7d'],
    ['第三把位','#403f47'],['上第三把位／下第四把位','#3c3d35'],
    ['第四把位','#593237'],['上第四把位／下第五把位','#262127'],
    ['第五把位','#335582'],['第六把位','#446038'],
    ['上第六把位','#562c2f'],['第七把位','#2a202b'],['上第七把位','#262e43']
  ];
  const POSITION_COLORS={open:'#ffffff',
    unverified:'#8f9a97',custom:'#be476c',harmonic:'#426f9e',
    ...Object.fromEntries(CHART_POSITIONS.flatMap((p,i)=>p?[[`position-${i}`,p[1]]]:[]))};
  function contrastInk(hex){
    const rgb=hex.slice(1).match(/../g).map(c=>parseInt(c,16)/255)
      .map(v=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4));
    const l=rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
    return (l+.05)/.05>=1.05/(l+.05)?'#000000':'#ffffff';
  }
  function pointStyling(position){
    let group,label,extended=false;
    const chart=Number.isInteger(position.anchor)?CHART_POSITIONS[position.anchor]:null;
    if(position.semitones===0){group='open';label='空弦';}
    else if(position.custom||position.group==='custom'){group='custom';label='老師／學生修改（把位未核對）';}
    else if(position.technique==='naturalHarmonic'||position.group==='harmonic'){group='harmonic';label=position.positionLabel||'泛音（不指定一般把位）';}
    else if(chart&&[1,2,3,4].includes(position.finger)&&position.group!=='unverified'){
      extended=position.displayExtended||position.shape==='extended'||position.shape==='backwardExtended'||position.group==='extended';
      group=`position-${position.anchor}`;
      label=(extended?'擴增':'')+chart[0]+(extended&&position.shape==='backwardExtended'?'（向後擴增）':'');
    }else{group='unverified';label='把位尚未核對';}
    const borderColor=contrastInk(POSITION_COLORS[group]);
    return {finger:position.finger,group,label,extended,borderColor,textColor:group==='open'?'#34483a':'#ffffff',
      textStroke:group!=='open'&&borderColor==='#000000'?'#18251b':'none'};
  }
  function bMinorAccent(context,position){
    if(context?.mode!=='minor'||context.key?.[0]!=='B'||position.custom||
      ['custom','unverified','harmonic'].includes(position.group))return null;
    if(context.arpeggio)return position.string===3&&position.semitones===14&&
      position.anchor===12&&position.shape==='normal'&&position.finger===3?'#247873':null;
    return context.octaves===2&&position.anchor===11&&position.shape==='extended'&&position.finger>0?'#a45b38':null;
  }
  function makeLegend(diagram=null){
    const points=diagram?.querySelectorAll?.('[data-position-group]')||[];
    const used=new Set([...points].map(p=>p.getAttribute('data-position-group')+(p.getAttribute('data-position-extended')==='true'?':extended':'')));
    const aside=element('aside',{class:'cello-fb-legend','aria-label':'把位顏色圖例'});
    aside.append(element('div',{class:'cello-legend-title'},'指板顏色圖例'));
    const entries=[['open','空弦（不屬把位）'],
      ...CHART_POSITIONS.flatMap((p,i)=>p?[[`position-${i}`,p[0]],[`position-${i}:extended`,'擴增'+p[0]]]:[]),['harmonic','自然泛音（不屬一般把位）'],['custom','老師／學生修改（把位未核對）'],
      ['unverified','把位尚未核對']];
    for(const [entry,label]of entries.filter(([g])=>used.has(g))){
      const [group,variant]=entry.split(':'),extended=variant==='extended';
      const item=element('div',{class:'cello-legend-item'});
      item.style.whiteSpace='normal';item.style.overflowWrap='anywhere';item.style.fontSize='11px';
      const marker=element('span',{class:'cello-legend-dot '+group,'data-legend-position':entry});
      marker.style.background=POSITION_COLORS[group]||POSITION_COLORS['position-2'];
      const accent=[...points].find(p=>p.getAttribute('data-position-group')===group&&(p.getAttribute('data-position-extended')==='true')===extended&&p.hasAttribute('data-position-accent'))?.getAttribute('data-position-accent');
      if(accent){marker.style.background=accent;marker.setAttribute('data-position-accent',accent);}
      if(extended){marker.style.border='1.5px solid '+contrastInk(accent||POSITION_COLORS[group]);}item.append(marker,element('span',{},label));aside.append(item);
    }
    aside.hidden=used.size===0;return aside;
  }
  function plottedRoute(mode,key,direction,octaves,annotations,arpeggio){
    const scale=scaleNotes(mode,key,direction,octaves);
    const notes=arpeggio?arpeggioNotes(mode,key,direction):scale;
    const sourceDirection=arpeggio||mode==='major'?'up':direction;
    const map=decodeMap(sourceDirection==='up'?annotations.upMap:annotations.downMap);
    const presets=window.CelloFingeringOptimizer?.get(mode,key,direction,notes,arpeggio)||
      window.CelloFingeringPresets?.get(mode,key,sourceDirection,
        sourceDirection===direction?scale:scaleNotes(mode,key,sourceDirection,octaves))||{};
    const plotted=notes.map(note=>{
      const position=notePlacement(note.midi,map,presets);
      return {...note,position,style:pointStyling(position),shiftCue:resolvedShiftCue(note.midi,map,presets)};
    });
    return {notes,map,presets,plotted};
  }

  function visiblePlan(mode,key,annotations={},arpeggio=false) {
    const up=plottedRoute(mode,key,'up',PRACTICE_OCTAVES,annotations,arpeggio).plotted;
    // Major and arpeggio have a single visible board. The ascent is the source
    // of truth for both, even if stale hidden major down edits exist.
    const shared=arpeggio||mode==='major';
    const down=shared?up.slice().reverse():plottedRoute(mode,key,'down',PRACTICE_OCTAVES,annotations,arpeggio).plotted;
    const points=[...up,...down.slice(1)];
    const slots=points.map((p,i)=>{
      const v=p.position, previous=points[i-1], cue=previous?.shiftCue;
      const known=v.group!=='unverified' && v.finger!==null && Number.isInteger(v.string);
      const plan=known?{string:v.stringName,finger:v.finger,reviewed:true,
        fingersReviewed:Number.isInteger(v.finger)&&!v.technique,source:v.custom?'confirmed-edit':'visible-board'}:null;
      // Only a rendered explicit direction-specific cue, never inferred from
      // anchor distance, color, or a digit change. No extension flag is invented.
      const edge=known && (i<up.length || !shared) && i!==up.length && cue?.toMidi===p.midi
        ? {from:i-1,reviewed:true,shift:true}:null;
      return {midi:p.midi,name:p.name,octave:Math.floor(staffStep(p)/7),direction:i<up.length?'up':'down',plan,edge};
    });
    return {source:'confirmed/visible plan',revision:JSON.stringify([mode,key[0],arpeggio,slots]),slots};
  }

  function chartSVG(mode,key,direction,octaves,annotations={},interaction=null,remoteDrafts=[],reverseStrings=false,arpeggio=false){
    const {notes,map,presets,plotted}=plottedRoute(mode,key,direction,octaves,annotations,arpeggio);
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
    const xPositions=reverseStrings?[294,210,126,42]:[42,126,210,294], end=top+maxPosition*step+22;
    const svg=svgNode('svg',{
      viewBox:'0 0 370 '+height,
      role:'img',
      'aria-label':key[0]+(mode==='major'?'大調':'古典旋律小調')+
        (arpeggio?'琶音':'音階')+(direction==='up'?'上行':'下行')+'大提琴指板音位圖',
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
    svg.append(svgNode('line',{x1:30,y1:68,x2:306,y2:68,stroke:'#34483a','stroke-width':5,'stroke-linecap':'round'}));
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
      const color=isOpen&&style.group!=='extended'?'#34483a':POSITION_COLORS[style.group];
      const explicit=[1,2,3,4].includes(note.position.finger);
      const modified=note.position.custom===true;
      const point=svgNode('g',interaction?{
        role:'button',tabindex:'0',class:'cello-fb-note','data-midi':note.midi,
        'aria-label':'選擇第'+note.order+'音 '+note.name+'，編輯同音高弦位及指號',
        'aria-pressed':String(interaction.selectedMidi===note.midi)
      }:{});
      point.setAttribute('data-position-group',style.group);
      point.setAttribute('data-position-extended',String(Boolean(style.extended)));
      point.append(svgNode('title',{},
        '第'+note.order+'音 '+note.name+'，'+note.position.stringName+'弦'+
        (isOpen?'，空弦':'，'+style.label+(explicit?'，第'+style.finger+'指':''))+
        (note.shiftCue?'；'+note.shiftCue.description:'')));
      point.append(svgNode('circle',{
        cx:x,cy:y,r:15.5,fill:isOpen?'#f7f9f6':color,
        stroke:isOpen?color:style.extended?style.borderColor:'#ffffff','stroke-width':isOpen?3:style.extended?1.5:2.1,'stroke-dasharray':'none'
      }));
      const accent=bMinorAccent({mode,key,octaves,arpeggio},note.position);
      if(accent){point.setAttribute('data-position-accent',accent);point.querySelector('circle').setAttribute('fill',accent);}
      point.append(svgNode('text',{
        x:note.shiftCue?.placement==='inside'?x-3:x,y:y+4.5,'text-anchor':'middle','font-size':12.5,
        'font-weight':800,fill:isOpen?color:style.textColor,stroke:style.textStroke,'stroke-width':.9,'paint-order':'stroke'
      },isOpen?'0':explicit?String(style.finger):'?'));
      if(note.shiftCue){
        const below=note.shiftCue.placement==='below',inside=note.shiftCue.placement==='inside';
        point.append(svgNode('text',{x:below?x:inside?x+2:x+7,y:below?y+29:y+4.5,
          'text-anchor':below?'middle':'start','font-size':9,'font-weight':700,
          fill:inside?style.textColor:'#273c2e',stroke:inside?style.textStroke:'none','stroke-width':.8,'paint-order':'stroke',class:'cello-shift-cue',role:'img','aria-label':note.shiftCue.description,
          'data-shift-to':note.shiftCue.toMidi},note.shiftCue.symbol));
      }
      if(!isOpen){
        point.append(svgNode('text',{
          x:x+(note.shiftCue&& !['below','inside'].includes(note.shiftCue.placement)?39:21),y:y+1,'font-size':13,
          'font-weight':note.order===1||note.order===notes.length?800:650,
          fill:'#273c2e'
        },note.name));
        if(note.position.technique==='naturalHarmonic'){
          point.append(svgNode('circle',{cx:x+25,cy:y-19,r:3.2,fill:'none',stroke:'#273c2e',
            'stroke-width':1.3,class:'cello-harmonic-mark',role:'img',
            'aria-label':'自然泛音：第3指輕觸A弦二分之一，發聲A4'}));
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

  // User practice always uses the complete two-octave route.
  // Key signatures apply globally; explicit accidentals carry per written octave
  // across this unbarred exercise, including melodic-minor descent cancellations. Sixteenth-note groups use four-note beams, without asserting a time signature.
  function staffStep(note){
    const letters='CDEFGAB',letter=note.name[0];
    let accidental=0;
    for(const c of note.name.slice(1))accidental+=c==='♯'||c==='#'?1:c==='♭'||c==='b'?-1:c==='𝄪'?2:0;
    const octave=Math.round((note.midi-PITCH[letter]-accidental)/12)-1;
    return octave*7+letters.indexOf(letter);
  }
  function scoreAccidentals(sequence,signature){
    const letters=signature>=0?'FCGDAEB':'BEADGCF',base={};
    for(const letter of letters.slice(0,Math.abs(signature)))base[letter]=signature>0?'♯':'♭';
    const active=new Map();
    return sequence.map(note=>{
      const key=staffStep(note),written=note.name.slice(1)||'♮';
      const previous=active.has(key)?active.get(key):(base[note.name[0]]||'♮');
      active.set(key,written);return written===previous?null:written;
    });
  }
  function scoreNotes(mode,key,arpeggio=false){
    const up=arpeggio?arpeggioNotes(mode,key,'up'):scaleNotes(mode,key,'up',PRACTICE_OCTAVES);
    const down=arpeggio?arpeggioNotes(mode,key,'down'):scaleNotes(mode,key,'down',PRACTICE_OCTAVES);
    return [...up,...down.slice(1)];
  }
  function makeScore(mode,key,arpeggio=false,sequence=scoreNotes(mode,key,arpeggio)){
    const peakIndex=(sequence.length+1)/2;
    const spacing=arpeggio?64:29;
    const signature=key[1],startX=70+Math.abs(signature)*8,width=928+Math.abs(signature)*8;
    const accidentals=scoreAccidentals(sequence,signature);
    const wrap=element('div',{class:'cello-scale-score',tabindex:'0','aria-label':(arpeggio?'琶音':'音階')+'上下行五線譜，可左右捲動'});
    const svg=svgNode('svg',{viewBox:`0 0 ${width} 185`,width,height:185,role:'img','aria-label':key[0]+(mode==='major'?'大調':'旋律小調')+(arpeggio?'琶音':'音階')+(arpeggio?'，低音譜號，上下行，全部四分音符':'，低音譜號，上下行十六分音符，末音四分音符')});
    svg.append(svgNode('title',{},'調號與必要臨時記號'));
    for(let i=0;i<5;i++)svg.append(svgNode('line',{x1:14,x2:width-15,y1:110-i*10,y2:110-i*10,stroke:'#777','stroke-width':0.8}));
    // Bass-clef curve and dots anchor the F3 line, avoiding music-font dependency.
    const clef=svgNode('g',{transform:'translate(4 16) scale(.8)'});
    clef.append(svgNode('path',{d:'M 22 82 C 22 63 55 64 51 84 C 49 99 34 108 23 111 C 38 101 45 89 43 78 C 42 70 31 69 28 77',fill:'#222'}));
    clef.append(svgNode('circle',{cx:26,cy:79,r:4,fill:'#222'}));
    for(const y of [75,85])clef.append(svgNode('circle',{cx:57,cy:y,r:2,fill:'#222'}));
    svg.append(clef);
    // Compact glyph-specific spacing (0.8 staff spaces), not text-font advance widths.
    // Reference: LilyPond key-signature-interface; preserve bass-clef pitch positions.
    const signatureY=signature>=0?[80,95,75,90,105,85,100]:[100,85,105,90,110,95,115];
    for(let i=0;i<Math.abs(signature);i++){
      const mark=svgNode('g',{class:'scale-key-signature',transform:`translate(${58+i*8} ${signatureY[i]})`,'data-symbol':signature>0?'♯':'♭'});
      if(signature>0){
        mark.append(svgNode('path',{d:'M -2 -10 V 11 M 2 -11 V 10',stroke:'#222','stroke-width':1,fill:'none'}));
        mark.append(svgNode('path',{d:'M -4 -4 L 4 -6 L 4 -3 L -4 -1 Z M -4 3 L 4 1 L 4 4 L -4 6 Z',fill:'#222'}));
      }else{
        mark.append(svgNode('path',{d:'M -2 -16 L -2 4 Q 6 0 3 -4 Q 1 -7 -2 -2',stroke:'#222','stroke-width':1.4,fill:'none'}));
      }
      svg.append(mark);
    }
    const noteGroups=[];
    sequence.forEach((note,i)=>{
      const x=startX+i*spacing,y=110-(staffStep(note)-18)*5;
      for(let ly=120;ly<=y;ly+=10)svg.append(svgNode('line',{x1:x-11,x2:x+11,y1:ly,y2:ly,stroke:'#444','stroke-width':1}));
      for(let ly=60;ly>=y;ly-=10)svg.append(svgNode('line',{x1:x-11,x2:x+11,y1:ly,y2:ly,stroke:'#444','stroke-width':1}));
      const g=svgNode('g',{'data-midi':note.midi,'data-note':note.name,'data-duration':arpeggio||i===sequence.length-1?'4':'16'});
      g.append(svgNode('title',{},note.name+' · MIDI '+note.midi));
      if(accidentals[i])g.append(svgNode('text',{class:'scale-accidental',x:x-18,y:y+5,'text-anchor':'middle','font-family':'Georgia, serif','font-size':18,fill:'#222'},accidentals[i]));
      g.append(svgNode('ellipse',{cx:x,cy:y,rx:5.8,ry:3.7,transform:'rotate(-20 '+x+' '+y+')',fill:'#222'}));
      noteGroups.push(g);
    });
    // Four-note visual groups; no meter or barlines are imposed on the exercise.
    const groupSize=arpeggio?1:4;
    for(let start=0;start<sequence.length;start+=groupSize){
      const group=sequence.slice(start,start+groupSize).map((note,j)=>({x:startX+(start+j)*spacing,y:110-(staffStep(note)-18)*5}));
      const down=group.reduce((sum,n)=>sum+n.y,0)/group.length<90;
      const beamY=down?Math.max(...group.map(n=>n.y))+32:Math.min(...group.map(n=>n.y))-32;
      const stemX=n=>n.x+(down?-5:5);
      const slope=Math.max(-0.08,Math.min(0.08,(group.at(-1).y-group[0].y)/Math.max(1,group.at(-1).x-group[0].x)));
      const beamAt=n=>beamY+slope*(n.x-group[0].x)+(down?Math.max(0,-slope*(group.at(-1).x-group[0].x)):Math.min(0,-slope*(group.at(-1).x-group[0].x)));
      // The stem belongs to the note rather than its shared neutral beam.
      group.forEach((n,j)=>noteGroups[start+j].append(svgNode('line',
        {class:'scale-stem',x1:stemX(n),x2:stemX(n),y1:n.y,y2:beamAt(n),stroke:'#222','stroke-width':1.25})));
      if(group.length>1){
        const left=stemX(group[0]),right=stemX(group.at(-1));
        for(let level=0;level<2;level++){
          const y=beamAt(group[0])+(down?-6:6)*level;
          const yAt=x=>y+slope*(x-left);
          svg.append(svgNode('line',{class:'scale-beam','data-level':level+1,x1:left,x2:right,y1:y,y2:yAt(right),stroke:'#222','stroke-width':3.5}));
          // The two rails each give a note the area between adjacent stem
          // midpoints. End notes own up to the edge of the beam. This keeps
          // the accent visible without recoloring an adjacent note's area.
          group.forEach((n,j)=>{
            const x=stemX(n);
            const x1=j?(stemX(group[j-1])+x)/2:left;
            const x2=j+1<group.length?(x+stemX(group[j+1]))/2:right;
            noteGroups[start+j].append(svgNode('line',{class:'scale-beam-local','data-level':level+1,x1,x2,y1:yAt(x1),y2:yAt(x2),'stroke-width':3.5,stroke:'none','aria-hidden':'true'}));
          });
        }
      } // The final tonic keeps its stem but has no flags: a quarter note.
    }
    svg.append(...noteGroups);
    for(const [x,label] of [[startX,'上行'],[startX+peakIndex*spacing,'下行']]){
      svg.append(svgNode('text',{x,y:164,'font-size':12,fill:'#647461'},label));
      svg.append(svgNode('path',{d:`M${x+32} 160h14m-6-6 6 6-6 6`,fill:'none',stroke:'#647461','stroke-width':1.6,'stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'}));
    }
    wrap.append(svg);return wrap;
  }

  function create(mode,key,initialAnnotations={},onSave=null,onPreview=null,arpeggioOptions={}){
    const id=(mode==='major'?'major-':'minor-')+key[0];
    // Arpeggio maps never consume scale overrides, including legacy upMap.
    let annotations={...initialAnnotations};
    let arpeggioAnnotations={...(arpeggioOptions.annotations||{})};
    const mapFor=dir=>dir==='arpeggio'?(arpeggioAnnotations.upMap||''):(annotations[dir+'Map']||'');
    const saveFor=dir=>dir==='arpeggio'?arpeggioOptions.onSave:onSave;
    const sourceDir=dir=>dir==='arpeggio'?'up':dir;
    const root=element('div',{class:'cello-fingerboard'});
    const toolbar=element('div',{class:'cello-fb-toolbar'});
    const boards=element('div',{class:'cello-fb-two-up'});
    const panels={};
    let remoteDrafts=[],remoteArpeggioDrafts=[];
    // A single transaction stages any number of note edits for one direction.
    // Only clicking Confirm (or Save in the leave dialog) persists the map.
    const edit={dir:null,midi:null,original:{},pending:{},undo:[],showMore:false};
    let tracking=false,pointer=null;

    function clone(map){return JSON.parse(JSON.stringify(map));}
    function signature(map){
      return JSON.stringify(Object.entries(map).sort(([a],[b])=>Number(a)-Number(b)));
    }
    function isDirty(){return edit.dir!==null&&signature(edit.original)!==signature(edit.pending);}
    function notes(dir){return dir==='arpeggio'?arpeggioNotes(mode,key,'up'):scaleNotes(mode,key,dir,PRACTICE_OCTAVES);}
    function defaultPosition(dir,midi){
      const ref=(window.CelloFingeringOptimizer||window.CelloFingeringPresets)?.get(mode,key,sourceDir(dir),notes(dir),dir==='arpeggio')||{};
      return notePlacement(midi,{},ref);
    }
    function proposedPosition(dir,midi){
      const ref=(window.CelloFingeringOptimizer||window.CelloFingeringPresets)?.get(mode,key,sourceDir(dir),notes(dir),dir==='arpeggio')||{};
      const map=edit.dir===dir?edit.pending:decodeMap(mapFor(dir));
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
      if(tracking||typeof saveFor(edit.dir)!=='function')return;
      tracking=true;
      document.addEventListener('pointerdown',onPointerDown,true);
      document.addEventListener('pointermove',onPointerMove,true);
      document.addEventListener('pointerup',onPointerUp,true);
      document.addEventListener('pointercancel',onPointerCancel,true);
      document.addEventListener('scroll',onScroll,true);
      document.addEventListener('keydown',onKeydown,true);
    }
    function announceDraft(finishedDirection=null){
      if(edit.dir===null){
        const clear=finishedDirection==='arpeggio'?arpeggioOptions.onPreview:onPreview;
        if(finishedDirection!==null&&typeof clear==='function')clear(null);
        return;
      }
      const preview=edit.dir==='arpeggio'?arpeggioOptions.onPreview:onPreview;
      if(typeof preview!=='function')return;
      const changed=Object.keys({...edit.original,...edit.pending}).filter(k=>
        JSON.stringify(edit.original[k])!==JSON.stringify(edit.pending[k])).map(Number);
      preview({direction:sourceDir(edit.dir),selectedMidi:edit.midi,
        previewMap:JSON.stringify(edit.pending),changed});
    }
    function closeEditor(){
      const finishedDirection=edit.dir;
      edit.dir=null;edit.midi=null;edit.original={};edit.pending={};
      edit.undo=[];edit.showMore=false;
      stopTracking();
      render();
      announceDraft(finishedDirection);
    }
    function saveSession(){
      if(edit.dir===null)return;
      if(!isDirty()){closeEditor();return;}
      if(!saveAllowed()){
        const bad=invalidNotes();
        const warning=panels[edit.dir].hint;
        warning.hidden=false;warning.textContent=bad.length?
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
      if(dir==='arpeggio')arpeggioAnnotations.upMap=value;
      else annotations[dir+'Map']=value;
      closeEditor();
      saveFor(dir)(sourceDir(dir),value,previous,false);
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
        edit.dir=dir;edit.original=clone(decodeMap(mapFor(dir)));
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

    for(const dir of ['up','down','arpeggio']){
      const section=element('section',{class:'cello-fb-direction',
        'aria-label':mode==='major'&&dir==='up'?'音階指板，上下行相同':dir==='up'?'上行音階':'下行音階'});
      const heading=element('h4',{class:'cello-fb-direction-heading'});
      const viewport=element('div',{class:'cello-fb-viewport'});
      const editor=element('div',{class:'cello-inline-editor',
        'aria-label':(dir==='arpeggio'?'琶音':dir==='up'?'上行':'下行')+'批次編輯音符'});
      editor.hidden=true;
      const status=element('div',{class:'cello-inline-status'});
      const hint=element('p',{class:'cello-inline-warning',role:'alert'});hint.hidden=true;
      editor.setAttribute('aria-description','可以連續修改多個音符，最後一次確認；點空白處可選擇儲存或放棄。');
      const range=element('button',{type:'button',class:'cello-inline-range',
        'aria-pressed':'false'},'顯示更多把位');
      const stringChoices=element('div',{class:'cello-inline-choices'});
      const fingerChoices=element('div',{class:'cello-inline-choices'});
      const actions=element('div',{class:'cello-inline-actions'});
      const back=element('button',{type:'button',class:'cello-inline-undo'},'上一步');
      const restoreSelected=element('button',{type:'button',class:'cello-inline-restore-selected',
        title:'將目前選取的粉紅色修改音符還原移動優先預設，並保留其他音'},'復原選取的修改');
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
      // Keep saved down-map data and collaboration state intact, but show only
      // the requested ascending board for major scales.
      section.hidden=mode==='major'&&dir==='down';
      boards.append(section);
      panels[dir]={heading,viewport,editor,status,hint,stringChoices,
        fingerChoices,range,back,restoreSelected,reset,save,memo,legend,section};
    }
    function appendPlayableScore(parent, arpeggio=false){
      const sequence=scoreNotes(mode,key,arpeggio);
      const score=makeScore(mode,key,arpeggio,sequence);
      parent.append(element('h3',{class:'music-section-title exercise-score-title'},(arpeggio?'琶音':'音階')),score);
      if(window.CelloScalePractice){
        const expected=sequence.map(note=>({...note,octave:Math.floor(staffStep(note)/7)}));
        const practice=window.CelloScalePractice.card(score,expected,
          view=>window.CelloScalePractice.controller?.toggle(view),arpeggio?'arpeggio':'scale',id,
          ()=>edit.dir===null?visiblePlan(mode,key,arpeggio?arpeggioAnnotations:annotations,arpeggio):null);
        parent.append(practice.element);
      }
    }
    const scaleBlock=element('section',{class:'music-exercise-block scale-exercise','aria-label':'音階'});
    const scoreSection=element('div',{class:'score-section'});
    appendPlayableScore(scoreSection);
    const boardSection=element('details',{class:'fingerboard-section layout-disclosure exercise-disclosure'});
    boardSection.append(element('summary',{},'音階指板與指法'),
      toolbar,boards);
    scaleBlock.append(scoreSection,boardSection);

    const arpeggioSection=element('section',{class:'music-exercise-block arpeggio-section','aria-label':'琶音'});
    const arpeggioScore=element('div',{class:'score-section'});
    appendPlayableScore(arpeggioScore,true);
    const arpeggioBoard=element('details',{class:'arpeggio-fingerboard layout-disclosure exercise-disclosure'});
    const arpeggioBoards=element('div',{class:'cello-fb-two-up'});
    arpeggioBoard.append(element('summary',{},'琶音指板與指法'),arpeggioBoards);
    // Reuse the scale transaction UI, but give arpeggios independent storage.
    arpeggioBoards.append(panels.arpeggio.section);
    if(arpeggioOptions.localOnly)arpeggioBoard.append(
      element('p',{class:'fingering-note'},'琶音修改只儲存在此瀏覽器，不與教室同步。'));
    arpeggioSection.append(arpeggioScore,arpeggioBoard);

    // Both sections remain mounted. Moving to the other score does not hide
    // an active Stop button or discard a graph or a pending fingering edit.
    const exerciseNav=element('nav',{class:'exercise-nav','aria-label':'切換譜面位置'});
    const exerciseLinks={};
    for(const [kind,label,section,score] of [['scale','音階',scaleBlock,scoreSection],['arpeggio','琶音',arpeggioSection,arpeggioScore]]){
      const jump=element('button',{class:'exercise-jump',type:'button'},label);
      jump.addEventListener('click',()=>{
        const target=score.querySelector('.cello-scale-score');
        target?.focus({preventScroll:true});
        section.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'});
      });
      exerciseLinks[kind]=jump;
      exerciseNav.append(jump);
    }
    const activeStop=element('button',{class:'exercise-jump exercise-active-stop',type:'button'},'停止目前收音');
    activeStop.addEventListener('click',()=>{
      const active=root.querySelector('.scale-practice:is([data-phase="listening"],[data-phase="pending"])');
      const button=active?.querySelector('.scale-practice-button');
      if(!button)return;
      exerciseLinks[active.dataset.practiceKind]?.focus({preventScroll:true});
      button.click();
    });
    exerciseNav.append(activeStop);
    root.append(exerciseNav,scaleBlock,arpeggioSection,dialog);

    function renderDirection(dir){
      const pane=panels[dir],editing=edit.dir===dir,isArpeggio=dir==='arpeggio';
      const asymmetric=false; // 054: all major scales use the approved ascent and exact reverse.
      pane.section.hidden=mode==='major'&&dir==='down'&&!asymmetric;
      pane.viewport.setAttribute('aria-label',isArpeggio?'琶音指板，上下行相同':mode==='major'&&!asymmetric?'音階指板，上下行相同':dir==='up'?'上行音階':'下行音階'+(asymmetric?'，唯讀，沿用已儲存的共用自訂指法':''));
      pane.section.setAttribute('aria-label',pane.viewport.getAttribute('aria-label'));
      const saved=decodeMap(mapFor(isArpeggio?dir:mode==='major'?'up':dir));
      if(isArpeggio||(mode==='major'&&!asymmetric&&dir==='up'))pane.heading.textContent='上下行相同';
      else pane.heading.innerHTML=(dir==='up'?'<svg class="ui-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 19V5m-6 6 6-6 6 6"/></svg> 上行':'<svg class="ui-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 5v14m-6-6 6 6 6-6"/></svg> 下行');
      if((isArpeggio?remoteArpeggioDrafts:remoteDrafts).some(remote=>remote.direction===sourceDir(dir))){
        pane.heading.append(element('span',{class:'cello-fb-remote-label'},'（其他人編輯中）'));
      }
      if(Object.keys(saved).length||(!isArpeggio&&(dir==='up'?annotations.up:annotations.down))){
        pane.heading.append(element('span',{class:'cello-fb-changed'},'（已修改）'));
      }
      const memo=isArpeggio?'':dir==='up'?annotations.up:annotations.down;
      pane.memo.textContent=memo||'';pane.memo.hidden=!memo;
      const value=editing?(Object.keys(edit.pending).length?JSON.stringify(edit.pending):''):
        mapFor(dir);
      pane.viewport.replaceChildren(chartSVG(mode,key,sourceDir(dir),PRACTICE_OCTAVES,
        isArpeggio?{upMap:value}:{...annotations,[dir+'Map']:value},
        typeof saveFor(dir)==='function'&&!(asymmetric&&dir==='down')?{
          selectedMidi:editing?edit.midi:null,
          originalMap:editing?JSON.stringify(edit.original):null,
          confirmedMap:mapFor(dir),
          select:midi=>begin(dir,midi),
          chooseString:s=>chooseString(s),showMore:editing&&edit.showMore
        }:null,isArpeggio?remoteArpeggioDrafts:remoteDrafts,stringOrder==='ADGC',isArpeggio));
      const legend=makeLegend(pane.viewport);pane.legend.replaceWith(legend);pane.legend=legend;
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
        '';
      pane.hint.hidden=!invalid;
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
      standardOrder.setAttribute('aria-pressed',String(stringOrder!=='ADGC'));
      reverseOrder.setAttribute('aria-pressed',String(stringOrder==='ADGC'));
      renderDirection('up');renderDirection('down');renderDirection('arpeggio');
    }
    const orderGroup=element('div',{class:'cello-fb-group','aria-label':'指板弦排列，由左至右'});
    function addOrder(order){
      const button=element('button',{type:'button',class:'cello-fb-button','aria-label':'弦排列由左至右 '+order},order);
      button.addEventListener('click',()=>{
        stringOrder=order;render();
        document.querySelectorAll('.cello-fingerboard').forEach(board=>{if(board!==root)board.refreshStringOrder?.();});
      });
      orderGroup.append(button);return button;
    }
    const standardOrder=addOrder('CGDA'),reverseOrder=addOrder('ADGC');
    toolbar.append(orderGroup);
    root.refreshStringOrder=()=>render();
    root.isEditing=()=>edit.dir!==null;
    root.requestLeave=next=>exitEditor(next);
    root.setRemoteArpeggioDrafts=incoming=>{
      const next=Array.isArray(incoming)?incoming.filter(Boolean).slice(0,8):[];
      if(JSON.stringify(next)===JSON.stringify(remoteArpeggioDrafts))return;
      remoteArpeggioDrafts=next;
      renderDirection('arpeggio');
    };
    root.setRemoteDrafts=(incoming)=>{
      const next=Array.isArray(incoming)?incoming.filter(Boolean).slice(0,8):[];
      if(JSON.stringify(remoteDrafts)===JSON.stringify(next))return;
      remoteDrafts=next;
      renderDirection('up');renderDirection('down');renderDirection('arpeggio');
    };
    root.updateArpeggioAnnotations=(incoming)=>{
      const next={...(incoming||{})};
      if(JSON.stringify(next)===JSON.stringify(arpeggioAnnotations))return;
      arpeggioAnnotations=next;
      renderDirection('arpeggio');
    };
    root.updateAnnotations=(incoming)=>{
      const value=incoming&&typeof incoming==='object'?incoming:{};
      if(JSON.stringify(value)===JSON.stringify(annotations))return;
      annotations={...value};
      renderDirection('up');renderDirection('down');renderDirection('arpeggio');
    };
    render();
    return root;
  }

  window.CelloFingerboard={
    create,
    // Pure helpers exported for automated pitch and placement checks.
    arpeggioNotes,chartSVG,visiblePlan,scoreAccidentals,staffStep,makeScore,scoreNotes,scaleNotes,positionFor,pitchClass,decodeMap,pointStyling,POSITION_COLORS,CHART_POSITIONS,contrastInk,makeLegend,notePlacement,resolvedShiftCue,bMinorAccent
  };
})();

/* START practice history module */
(function(root, factory) {
  root.CelloPracticeHistory = factory();
})(globalThis, function() {
  'use strict';

  const PREFIX = 'cello-practice-intonation:v1:';
  const LIMIT = 50;
  const EPSILON = 1e-7;
  const MAX_COUNT = Number.MAX_SAFE_INTEGER;
  const validSlot = x => Number.isInteger(x) && Math.abs(x) <= LIMIT;
  const validCount = x => Number.isSafeInteger(x) && x > 0;
  const fresh = count => Array.from({length: count}, () => new Map());

  function keyFor(scope, kind, target) {
    if (typeof scope !== 'string' || !scope.trim() || !['scale', 'arpeggio'].includes(kind) ||
        !Array.isArray(target) || !target.length) return null;
    const ordered = Array.from(target, note => typeof note === 'number' ? note : note?.midi);
    if (!ordered.every(midi => Number.isInteger(midi) && midi >= 0 && midi <= 127)) return null;
    return PREFIX + JSON.stringify([scope, kind, ordered]);
  }

  // Quantize like the live lap histogram, without moving points across tuner color bands.
  function bucket(cents) {
    if (!Number.isFinite(cents) || Math.abs(cents) > LIMIT + EPSILON) return null;
    const magnitude = Math.abs(cents);
    const rounded = Math.min(LIMIT, Math.round(magnitude));
    const bandFloor = magnitude > 20 + EPSILON ? 21 : magnitude > 10 + EPSILON ? 11 : 0;
    return Math.max(rounded, bandFloor) * (cents < 0 ? -1 : 1);
  }

  function appendPoints(bins, points) {
    const result = bins.map(slot => new Map(slot));
    for (let i = 0; i < result.length; i++) {
      const cent = bucket(points?.[i]);
      if (cent === null) continue;
      result[i].set(cent, Math.min(MAX_COUNT, (result[i].get(cent) || 0) + 1));
    }
    return result;
  }

  function validKey(key, count) {
    if (typeof key !== 'string' || !key.startsWith(PREFIX) || !Number.isInteger(count) || count < 1) return false;
    try {
      const [scope, kind, target] = JSON.parse(key.slice(PREFIX.length));
      return keyFor(scope, kind, target) === key && target.length === count;
    } catch {
      return false;
    }
  }

  const DRAFT_KEY = PREFIX + 'latest-local';
  const validId = id => typeof id === 'string' && /^[a-zA-Z0-9-]{1,96}$/.test(id);
  const nonnegative = n => Number.isSafeInteger(n) && n >= 0;
  const sum = (a, b) => b > MAX_COUNT - a ? MAX_COUNT : a + b;

  function decodeSlots(slots, count) {
    if (!Array.isArray(slots) || slots.length !== count) throw new Error();
    return slots.map(slot => {
      if (!Array.isArray(slot) || slot.length > LIMIT * 2 + 1) throw new Error();
      const bin = new Map();
      for (const pair of slot) {
        if (!Array.isArray(pair) || pair.length !== 2) throw new Error();
        const [cent, n] = pair;
        if (!validSlot(cent) || !validCount(n) || bin.has(cent)) throw new Error();
        bin.set(cent, n);
      }
      return bin;
    });
  }

  function sortedSlots(bins) {
    return bins.map(slot => Array.from(slot.entries()).sort((a, b) => a[0] - b[0]));
  }

  function addBins(target, source) {
    if (!Array.isArray(source) || source.length !== target.length) throw new Error();
    let any = false;
    for (let i = 0; i < target.length; i++) {
      if (!(source[i] instanceof Map)) throw new Error();
      for (const [measured, count] of source[i]) {
        const cent = bucket(measured);
        if (cent === null || !validCount(count)) throw new Error();
        const slot = target[i];
        slot.set(cent, sum(slot.get(cent) || 0, count));
        any = true;
      }
    }
    return any;
  }

  function read(storage, key) {
    try {
      return {ok: true, raw: storage.getItem(key)};
    } catch {
      return {ok: false, reason: 'unavailable'};
    }
  }

  function write(storage, key, payload) {
    try {
      storage.setItem(key, JSON.stringify(payload));
      return {ok: true};
    } catch {
      return {ok: false, reason: 'write-failed'};
    }
  }

  function load(storage, key, count) {
    if (!validKey(key, count)) return {ok: false, reason: 'invalid-key'};
    const item = read(storage, key);
    if (!item.ok) return item;
    if (item.raw === null) return {ok: true, bins: fresh(count), exists: false};
    try {
      const {v, slots, lastDraftId} = JSON.parse(item.raw);
      if (v !== 1 || (lastDraftId !== undefined && !validId(lastDraftId))) throw new Error();
      const bins = decodeSlots(slots, count);
      return {ok: true, bins, exists: bins.some(slot => slot.size > 0), lastDraftId};
    } catch {
      return {ok: false, reason: 'invalid-data'};
    }
  }

  function save(storage, key, bins, draftId) {
    if (!Array.isArray(bins) || (draftId !== undefined && !validId(draftId))) {
      return {ok: false, reason: 'invalid-attempt'};
    }
    const current = load(storage, key, bins.length);
    if (!current.ok) return current;
    if (draftId !== undefined && current.lastDraftId === draftId) return {...current, duplicate: true};
    try {
      if (!addBins(current.bins, bins)) return {ok: false, reason: 'empty-attempt'};
    } catch {
      return {ok: false, reason: 'invalid-attempt'};
    }
    // Refuse a stale tab once another exercise or attempt has replaced its draft.
    // Read immediately before the write; localStorage has no cross-tab transaction.
    if (draftId !== undefined) {
      const latest = loadDraft(storage, key, bins.length);
      if (!latest.ok) return latest;
      if (!latest.exists || latest.draft.id !== draftId || !latest.draft.pending) {
        return {ok: false, reason: 'stale-draft'};
      }
    }
    const lastDraftId = draftId ?? current.lastDraftId;
    const saved = write(storage, key, {v: 1, slots: sortedSlots(current.bins), lastDraftId});
    return saved.ok ? {...current, exists: true, lastDraftId} : saved;
  }

  function newDraftId() {
    try {
      const id = globalThis.crypto?.randomUUID?.();
      if (validId(id)) return id;
    } catch {}
    return Array.from({length: 4}, () => Math.random().toString(36).slice(2) || '0').join('-');
  }

  function normalizeDraft(draft, count) {
    if (!draft || !validId(draft.id) || !Array.isArray(draft.values) || draft.values.length !== count ||
        !['loop', 'single'].includes(draft.mode) || !nonnegative(draft.laps) || !nonnegative(draft.passed) ||
        draft.passed > draft.laps || !nonnegative(draft.progress) || draft.progress > count ||
        typeof draft.pending !== 'boolean') throw new Error();
    const values = Array.from(draft.values, n => {
      if (n !== null && bucket(n) === null) throw new Error();
      return n;
    });
    const result = {id: draft.id, values, mode: draft.mode, laps: draft.laps, passed: draft.passed,
      progress: draft.progress, pending: draft.pending};
    const coach=draft.coach;
    if(coach && ['SwiftF0','現有偵測'].includes(coach.engine) && Number.isFinite(coach.reference) &&
      coach.reference>=430 && coach.reference<=450) result.coach={engine:coach.engine,reference:coach.reference};
    return result;
  }

  // Optional finalized trace is part of the single draft, never a separate
  // storage key. Tuples store time/cents/score slot/lap/segment, not audio.
  const TREND_MS = 120000, TREND_CAP = 2564;
  function normalizeTrend(raw,draft,count,encoded=false) {
    if(!raw || !draft.coach || !draft.values.some(Number.isFinite) ||
      raw.reference!==draft.coach.reference || (encoded && (raw.draftId!==draft.id ||
        raw.mode!==draft.mode || raw.engine!==draft.coach.engine))) return;
    const {start,end}=raw, points=encoded?raw.points:raw.data;
    if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<start||
      end-start>TREND_MS+1e-7||!Array.isArray(points)||!points.length||points.length>TREND_CAP) return;
    const data=[];
    let before=null;
    for(const p of points){
      if(encoded ? !Array.isArray(p)||p.length!==5 : !p) return;
      const [ms,cents,slot,lap,segment]=encoded?p:[p.ms,p.cents,p.slot,p.lap,p.segment];
      if(!Number.isFinite(ms)||ms<start||ms>end || !Number.isFinite(cents)||Math.abs(cents)>50+1e-7 ||
        !nonnegative(slot)||slot>=count||!nonnegative(lap)||lap<1||lap-1>draft.laps||!nonnegative(segment)||!segment ||
        (before&&(ms<=before.ms||lap<before.lap||segment<before.segment||
          (segment===before.segment&&(lap!==before.lap||slot!==before.slot)))))return;
      const point={ms,cents,slot,lap,segment};
      data.push(point);before=point;
    }
    if(encoded)return {start,end,reference:raw.reference,data};
    return {draftId:draft.id,mode:draft.mode,engine:draft.coach.engine,reference:raw.reference,start,end,
      points:data.map(p=>[p.ms,p.cents,p.slot,p.lap,p.segment])};
  }

  function currentDraftId(storage) {
    const item = read(storage, DRAFT_KEY);
    if (!item.ok) return item;
    if (item.raw === null) return {ok:true,id:null};
    try {
      const current = JSON.parse(item.raw);
      if (current.v !== 1 || !validId(current.id) || !validKey(current.scope,current.values?.length)) throw new Error();
      return {ok:true,id:current.id};
    } catch {
      return {ok:false,reason:'invalid-draft'};
    }
  }

  function saveDraft(storage, key, draft, options = {}) {
    const count = draft?.values?.length;
    if (!validKey(key, count)) return {ok: false, reason: 'invalid-key'};
    if (!storage) return {ok: false, reason: 'unavailable'};
    let snapshot;
    try {
      snapshot = normalizeDraft(draft, count);
      const trend=normalizeTrend(draft.trend,snapshot,count);
      if(trend)snapshot.trend=trend;
      for (const name of ['history', 'attemptHistory']) {
        if (draft[name] == null) continue;
        const bins = fresh(count);
        addBins(bins, draft[name]);
        snapshot[name] = sortedSlots(bins);
      }
    } catch {
      return {ok: false, reason: 'invalid-draft'};
    }
    if (options.expectedId !== undefined) {
      const latest = currentDraftId(storage);
      if (!latest.ok) return latest;
      if (latest.id !== options.expectedId) return {ok:false,reason:'stale-draft'};
    }
    if (options.ifCurrent) {
      const latest = loadDraft(storage, key, count);
      if (!latest.ok) return latest;
      if (!latest.exists || latest.draft.id !== snapshot.id) return {ok: false, reason: 'stale-draft'};
    }
    let saved=write(storage, DRAFT_KEY, {v: 1, scope: key, ...snapshot});
    // If trace size exhausts local quota, keep the original dot-chart backup.
    // A failed trace write must not block the existing draft behavior.
    if(!saved.ok && snapshot.trend){
      delete snapshot.trend;
      saved=write(storage, DRAFT_KEY, {v: 1, scope: key, ...snapshot});
      if(saved.ok)return {...saved,trendSaved:false};
    }
    return snapshot.trend&&saved.ok?{...saved,trendSaved:true}:saved;
  }

  function loadDraft(storage, key, count) {
    if (!validKey(key, count)) return {ok: false, reason: 'invalid-key'};
    const item = read(storage, DRAFT_KEY);
    if (!item.ok) return item;
    if (item.raw === null) return {ok: true, exists: false};
    try {
      const snapshot = JSON.parse(item.raw);
      if (snapshot.v !== 1 || !validKey(snapshot.scope, snapshot.values?.length)) throw new Error();
      if (snapshot.scope !== key) return {ok: true, exists: false};
      const draft = normalizeDraft(snapshot, count);
      const trend=normalizeTrend(snapshot.trend,draft,count,true);
      if(trend)draft.trend=trend;
      for (const name of ['history', 'attemptHistory']) {
        if (snapshot[name] !== undefined) draft[name] = decodeSlots(snapshot[name], count);
      }
      if (draft.pending) {
        const saved = load(storage, key, count);
        if (saved.ok && saved.lastDraftId === draft.id) draft.pending = false;
      }
      return {ok: true, exists: true, draft};
    } catch {
      return {ok: false, reason: 'invalid-draft'};
    }
  }

  function removeDraft(storage, key, count) {
    if (!validKey(key, count)) return {ok: false, reason: 'invalid-key'};
    const current = loadDraft(storage, key, count);
    if (!current.ok || !current.exists) return current;
    try {
      storage.removeItem(DRAFT_KEY);
      return {ok: true};
    } catch {
      return {ok: false, reason: 'write-failed'};
    }
  }

  return {keyFor, bucket, appendPoints, load, save, newDraftId, currentDraftId, saveDraft, loadDraft, removeDraft};
});
/* END practice history module */
