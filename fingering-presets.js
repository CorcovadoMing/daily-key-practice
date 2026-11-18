/* Werner fingerings only: 12 full major ascending sequences confirmed by
 * user against their photo; descending is precisely the reversed sequence.
 * 0 = actual open string C/G/D/A, 1-4 = left-hand finger.
 * Strings and hand-position colors are inferred from confirmed finger numbers,
 * open-string pitches and contiguous note patterns, NOT independently checked
 * against every string placement in the user's sheet.
 * All 12 minor sequences are now also user-confirmed (29 digits each).
 */
(function(){
'use strict';
const OPEN=[36,43,50,57];
const MAJOR_FINGERS={
  "C": "013401340124012",
  "G": "013401340124134",
  "D": "124012401340134",
  "A": "124012401341243",
  "E": "124124124124134",
  "B": "124124124124123",
  "F♯": "124124124124134",
  "F": "401240124012134",
  "B♭": "240124012124123",
  "E♭": "240124012124134",
  "A♭": "124124124124134",
  "D♭": "124124124124134"
};
const MAJOR_STRINGS={
  "C": "000011112222333",
  "G": "111122223333333",
  "D": "000111122223333",
  "A": "111222233333333",
  "E": "000111222222333",
  "B": "111222333333333",
  "F♯": "000111222333333",
  "F": "011112222333333",
  "B♭": "112222333333333",
  "E♭": "001111222222333",
  "A♭": "111111222333333",
  "D♭": "000000111222333"
};
/* 29 digits: 15 ascending + 14 descending (apex not repeated).
 * These exact digits were confirmed by the user from Werner's minor-scale page.
 * String positions below are inferred rather than individually verified.
 */
const MINOR_FINGERS={
  "A": "13401240124124342142104210431",
  "E": "24012412412413421421310431042",
  "B": "24012412412412321421310431042",
  "F♯": "13412412401313424310421042131",
  "D": "13401240124013421042104210431",
  "G": "01240134012413421421042104210",
  "C": "01240134012413421421042104210",
  "C♯": "13412412412413421421421431431",
  "G♯": "13412412412413421421421431431",
  "F": "13412412412413421421421431431",
  "B♭": "13412412412412321421421431431",
  "E♭": "13412412412413421421421431431"
};
/* Note: F minor high B-flat/C and C minor high B/C (up),
 * and the corresponding descending B-flat/C, stay on the D string
 * following the preceding D-string hand position rather than switching
 * to the A string. Finger numbers are unchanged.
 */
const MINOR_STRINGS={
  "A": "11122223333333333333332222111",
  "E": "00111122222233333222222111100",
  "B": "11222233333333333333333222211",
  "F♯": "00011122233333333333222211100",
  "D": "00011112222333333322221111000",
  "G": "11112222333333333333322221111",
  "C": "00001111222222222222211110000",
  "C♯": "00001111122233332222111000000",
  "G♯": "11112222233333333333222111111",
  "F": "00011122222233333222222111000",
  "B♭": "11122223333333333333332222111",
  "E♭": "00011112222233333222221111000"
};
const MELODIC_UP=[0,2,3,5,7,9,11];
const NATURAL_DOWN=[0,2,3,5,7,8,10];
function positionGroup(ascending,fingers,strings,index){
  const s=Number(strings[index]),f=Number(fingers[index]);
  const semi=ascending[index].midi-OPEN[s];
  if(f===0)return 'open';
  if(semi>=12)return 'high';
  for(let i=Math.max(0,index-2);i<=Math.min(index,ascending.length-3);i++){
    if(fingers.slice(i,i+3)!=='124' ||
       strings[i]!==strings[i+1]||strings[i+1]!==strings[i+2])continue;
    if(ascending[i+1].midi-ascending[i].midi===2 &&
       ascending[i+2].midi-ascending[i+1].midi===2)return 'extended';
  }
  if(semi===1)return 'half';
  return semi>=7?'shifting':'first';
}
function majorPreset(key,direction,notes){
  const fingers=MAJOR_FINGERS[key[0]],strings=MAJOR_STRINGS[key[0]];
  if(!fingers||!strings)return {};
  if(fingers.length!==15||strings.length!==15)
    throw Error('Major preset must have 15 notes: '+key[0]);
  const ordered=direction==='down'?[...notes].reverse():notes;
  if(ordered.length!==8 && ordered.length!==15)throw Error('Expected 1 or 2 octaves');
  const result={};
  ordered.forEach((n,i)=>{
    const s=Number(strings[i]),f=Number(fingers[i]),semi=n.midi-OPEN[s];
    if(!Number.isInteger(s)||s<0||s>3||semi<0||semi>24||
      !Number.isInteger(f)||f<0||f>4||(f===0)!==(semi===0)){
      throw Error('Invalid major fingering for '+key[0]+' at scale tone '+(i+1));
    }
    result[String(n.midi)]={
      midi:n.midi,s,f,group:positionGroup(ordered,fingers,strings,i),
      source:'user-confirmed-Werner-finger',
      stringSource:'inferred-from-user-fingering-and-open-strings'
    };
  });
  return result;
}
function minorPreset(key,direction,notes){
  const sequence=MINOR_FINGERS[key[0]],strings=MINOR_STRINGS[key[0]];
  if(!sequence||!strings)return {};
  if(sequence.length!==29||strings.length!==29)
    throw Error('Minor scale must have exactly 29 fingerings: '+key[0]);
  if(direction!=='up'&&direction!=='down')throw Error('Invalid direction');
  if(notes.length!==8&&notes.length!==15)throw Error('Only 1 or 2 octaves supported');
  const pitchClass=window.CelloFingerboard.pitchClass(key[0]),root=36+pitchClass;
  const pitches=intervals=>[
    ...intervals.map(x=>root+x),
    ...intervals.map(x=>root+12+x),
    root+24
  ];
  const twoUp=pitches(MELODIC_UP),twoDown=pitches(NATURAL_DOWN).reverse();
  const fullPitches=[...twoUp,...twoDown.slice(1)];
  // The first descending note is the LAST ascending digit.
  const descendingFingers=sequence[14]+sequence.slice(15);
  const descendingStrings=strings[14]+strings.slice(15);
  const allMidi=direction==='up'?twoUp:twoDown;
  const allFingers=direction==='up'?sequence.slice(0,15):descendingFingers;
  const allStrings=direction==='up'?strings.slice(0,15):descendingStrings;
  // Position grouping is computed in ascending pitch order, even for descent.
  const ordered=direction==='up'?allMidi:[...allMidi].reverse();
  const fingersAsc=direction==='up'?allFingers:allFingers.split('').reverse().join('');
  const stringsAsc=direction==='up'?allStrings:allStrings.split('').reverse().join('');
  for(let i=0;i<29;i++){
    const midi=fullPitches[i],finger=Number(sequence[i]),s=Number(strings[i]);
    const semi=midi-OPEN[s];
    if(!Number.isInteger(s)||s<0||s>3||!Number.isInteger(finger)||finger<0||finger>4||
       semi<0||semi>24||(finger===0)!==(semi===0))
      throw Error('Invalid minor string/finger: '+key[0]+' note '+(i+1));
  }
  const expectedMidi=notes.map(n=>n.midi);
  const sourceIndices=notes.length===15?Array.from({length:15},(_,i)=>i):
    direction==='up'?Array.from({length:8},(_,i)=>i):
    Array.from({length:8},(_,i)=>i+7);
  const result={};
  for(let n=0;n<notes.length;n++){
    const i=sourceIndices[n],midi=allMidi[i],s=Number(allStrings[i]);
    // One-octave descent starts at the ascending first-octave apex.
    // Its finger must agree with the last note of that ascending diagram,
    // even when the full two-octave descent uses a different middle register
    // fingering at the same pitch (notably E and B minor).
    const finger=Number(direction==='down'&&notes.length===8&&n===0?
      sequence[7]:allFingers[i]);
    if(midi!==expectedMidi[n])
      throw Error('Minor direction/octave note mismatch: '+key[0]+' '+direction+' note '+(n+1));
    const idx=direction==='up'?i:14-i;
    result[String(midi)]={
      midi,s,f:finger,group:positionGroup(
        ordered.map(midi=>({midi})),fingersAsc,stringsAsc,idx),
      source:'user-confirmed-Werner-minor-finger',
      stringSource:'inferred-from-user-fingering-and-open-strings'
    };
  }
  return result;
}
function get(mode,key,direction,notes){
  return mode==='major'?majorPreset(key,direction,notes):minorPreset(key,direction,notes);
}
window.CelloFingeringPresets={
  get,VERIFIED:{major:MAJOR_FINGERS,minor:MINOR_FINGERS},
  MAJOR_FINGERS,MAJOR_STRINGS,MINOR_FINGERS,MINOR_STRINGS,
  STRING_OPEN:OPEN,source:'user-Werner-photo'
};
})();

/* Experimental computed routes, not a transcription of Werner.
 * Hand anchor is the NORMAL first-finger reference above each open string.
 * A reviewed backward extension reaches finger 1 one semitone below it.
 * Normal 1–4: [0,1,2,3]. Extended 1–4: [0,2,3,4].
 * Above fourth position use fingers 1–3 only. No thumb-position assumptions.
 */
(function(){
'use strict';
const OPEN=[36,43,50,57];
const LABELS=['','半把位','第一把位','上第一／下第二把位','上第二把位','第三把位',
  '上第三／下第四把位','第四把位','上第四／下第五把位','第五把位','第六把位',
  '上第六把位','第七把位','上第七把位'];
const SHAPES={normal:[0,1,2,3],extended:[0,2,3,4],backwardExtended:[-1,1,2,3]};
const cache=new Map();
function candidates(midi,fixed,shapes=['normal','extended']){
  const result=[];
  for(let s=0;s<4;s++){
    const semi=midi-OPEN[s];
    if(semi<0)continue;
    for(let anchor=1;anchor<=13;anchor++)for(const shape of shapes){
      const fingers=anchor>=8?3:4;
      if(semi===0){
        if(!fixed||(fixed.s===s&&fixed.f===0))result.push({midi,s,f:0,anchor,shape});
        continue;
      }
      for(let f=1;f<=fingers;f++)if(semi===anchor+SHAPES[shape][f-1]&&
        (!fixed||(fixed.s===s&&fixed.f===f)))result.push({midi,s,f,anchor,shape});
    }
  }
  return result;
}
function compare(a,b){for(let i=0;i<a.length;i++)if(a[i]!==b[i])return a[i]-b[i];return 0;}
function transition(a,b,direction){
  const sign=direction==='down'?-1:1,ds=b.s-a.s,da=b.anchor-a.anchor;
  // No backwards string crossings or skipped strings. On one string the hand
  // follows pitch direction; crossing an adjacent string may reset the anchor.
  if(ds*sign<0||Math.abs(ds)>1||(ds===0&&da*sign<0)||Math.abs(da)>7)return null;
  // Open notes carry an explicit hand state too. Repositioning during an
  // open note costs a real shift just like repositioning on a stopped note.
  return [Number(da!==0), Number(b.shape!=='normal')+Number(a.shape!==b.shape),
    Math.abs(ds),da*da,b.anchor];
}
function search(notes,direction='up',start=null,fixedMap=null,turnAt=null){
  let layer=[];
  for(let i=0;i<notes.length;i++){
    const next=[];
    for(const p of candidates(notes[i].midi,fixedMap?.[notes[i].midi])){
      if(i===0){
        if(start&&['s','f','anchor','shape'].some(k=>p[k]!==start[k]))continue;
        // Initial hand placement is not a shift; lower/easier shapes break ties.
        next.push({p,cost:[0,Number(p.shape!=='normal'),0,0,p.anchor],previous:null});
      }else{
        let best=null;
        for(const old of layer){
          const add=transition(old.p,p,turnAt!==null&&i>=turnAt?'down':direction);if(!add)continue;
          const cost=old.cost.map((v,j)=>v+add[j]);
          if(!best||compare(cost,best.cost)<0)best={p,cost,previous:old};
        }
        if(best)next.push(best);
      }
    }
    if(!next.length)return null;
    layer=next;
  }
  layer.sort((a,b)=>compare(a.cost,b.cost));
  const route=[];for(let n=layer[0];n;n=n.previous)route.push(n.p);
  return route.reverse();
}
// 046: movement is an adjacent-note EVENT, not the number of named positions.
// Simultaneous string/anchor/shape changes count once as an event; components
// remain available separately. Merely selecting a finger within one frame is free.
function physicalFrame(p){
  // This alias has identical per-finger coordinates. Keep true forward-first
  // at anchor2: opening it is a shape change, NOT a longitudinal shift.
  return p.shape==='extended'&&p.anchor===1?{anchor:2,shape:'backwardExtended'}:
    {anchor:p.anchor,shape:p.shape};
}
function motionCandidates(midi,fixed){
  return [...candidates(midi,fixed).filter(p=>!(p.anchor===1&&p.shape==='extended')),
    ...candidates(midi,fixed,['backwardExtended'])
    .filter(p=>p.anchor===2)];
}
function movementStep(a,b,direction){
  const af=physicalFrame(a),bf=physicalFrame(b);
  if(!transition({...a,...af},{...b,...bf},direction))return null;
  const string=Number(a.s!==b.s),anchor=Number(af.anchor!==bf.anchor),
    shape=Number(af.shape!==bf.shape),distance=Math.abs(bf.anchor-af.anchor);
  const sameFrame=!string&&!anchor&&!shape,halfStep=Math.abs(a.midi-b.midi)===1;
  const fingers=[a.f,b.f].sort((x,y)=>x-y).join('');
  return {events:Number(Boolean(string||anchor||shape)),string,anchor,shape,sameFrame,
    semitone34:Number(sameFrame&&halfStep&&fingers==='34'),
    semitone12:Number(sameFrame&&halfStep&&fingers==='12'),
    components:string+anchor+shape,travel:distance,excursion:distance*distance};
}
function movementCost(p,step,firstFamilyFirst,stretched134=0,mixed134=0){
  const frame=physicalFrame(p),outside=Number(p.f!==0&&frame.anchor!==2),events=step?.events||0;
  return [...(firstFamilyFirst?[outside,events]:[events,outside]),
    stretched134+mixed134,Number(p.f!==0&&frame.shape!=='normal'),step?.semitone34||0,step?.components||0,
    step?.excursion||0,step?.travel||0,p.f?Math.abs(frame.anchor-2):0];
}
function searchMotion(notes,direction='up',start=null,fixedMap=null,turnAt=null,firstFamilyFirst=false,caps=null){
  let layer=[];
  for(let i=0;i<notes.length;i++){
    const next=[];
    for(const p of motionCandidates(notes[i].midi,fixedMap?.[notes[i].midi])){
      if(i===0){
        if(start&&['s','f','anchor','shape'].some(k=>p[k]!==start[k]))continue;
        next.push({p,cost:movementCost(p,null,firstFamilyFirst),previous:null,continuity:false,eventsUp:0,eventsDown:0});
      }else{
        const best=new Map();
        for(const old of layer){
          const step=movementStep(old.p,p,turnAt!==null&&i>=turnAt?'down':direction);
          if(!step)continue;
          const down=turnAt!==null&&i>=turnAt||turnAt===null&&direction==='down';
          const eventsUp=old.eventsUp+(down?0:step.events),eventsDown=old.eventsDown+(down?step.events:0);
          if(caps&&(eventsUp>caps.up||eventsDown>caps.down))continue;
          const pf=physicalFrame(p),of=physicalFrame(old.p),before=old.previous?.p,bf=before&&physicalFrame(before);
          const sameBase=before&&before.s===p.s&&old.p.s===p.s&&bf.anchor===pf.anchor&&of.anchor===pf.anchor;
          const pattern=sameBase?[before.f,old.p.f,p.f].join(''):'';
          const is134=pattern==='134'||pattern==='431';
          const allExtended=sameBase&&bf.shape===of.shape&&of.shape===pf.shape&&pf.shape!=='normal';
          const stretch=Number(is134&&allExtended),mixed=Number(is134&&!allExtended&&
            [bf?.shape,of.shape,pf.shape].some(shape=>shape&&shape!=='normal'));
          const add=movementCost(p,step,firstFamilyFirst,stretch,mixed),cost=old.cost.map((v,j)=>v+add[j]);
          // Keep the preceding finger/frame needed for the next three-note
          // window, plus event budgets. Otherwise DP pruning would be invalid.
          const tail=old.p.s===p.s&&of.anchor===pf.anchor?old.p.f+':'+of.shape:'-';
          const key=tail+(caps?'|'+eventsUp+','+eventsDown:''),prior=best.get(key);
          if(!prior||compare(cost,prior.cost)<0)best.set(key,{p,cost,previous:old,continuity:step.sameFrame,eventsUp,eventsDown});
        }
        next.push(...best.values());
      }
    }
    if(!next.length)return null;
    layer=next;
  }
  layer.sort((a,b)=>compare(a.cost,b.cost));
  const result=[];for(let n=layer[0];n;n=n.previous)result.push(n.p);
  return result.reverse();
}
function movementMetrics(route){
  if(!route)return null;
  const result={events:0,stringChanges:0,anchorShifts:0,shapeChanges:0,components:0,
    travel:0,excursion:0,extensionNotes:0,firstFamilyNotes:0,outsideFirstNotes:0,semitone12:0,semitone34:0,stretched134:0,stretched124:0,mixed134:0,normal134:0};
  route.forEach((p,i)=>{
    const pf=physicalFrame(p);
    if(p.f){if(pf.shape!=='normal')result.extensionNotes++;
      if(pf.anchor===2)result.firstFamilyNotes++;else result.outsideFirstNotes++;}
    if(!i)return;
    const q=route[i-1],qf=physicalFrame(q),string=Number(q.s!==p.s),anchor=Number(qf.anchor!==pf.anchor),
      shape=Number(qf.shape!==pf.shape),distance=Math.abs(pf.anchor-qf.anchor);
    result.events+=Number(Boolean(string||anchor||shape));
    result.stringChanges+=string;result.anchorShifts+=anchor;result.shapeChanges+=shape;
    result.components+=string+anchor+shape;result.travel+=distance;result.excursion+=distance*distance;
    if(!string&&!anchor&&!shape&&Math.abs(p.midi-q.midi)===1){
      const fingers=[p.f,q.f].sort((a,b)=>a-b).join('');
      if(fingers==='12')result.semitone12++;if(fingers==='34')result.semitone34++;
    }
    if(i>=2&&!string&&!anchor){
      const before=route[i-2],bf=physicalFrame(before);
      if(before.s===p.s&&bf.anchor===pf.anchor){
        const pattern=[before.f,q.f,p.f].join(''),is134=pattern==='134'||pattern==='431';
        const same=bf.shape===qf.shape&&qf.shape===pf.shape;
        if(same&&pf.shape!=='normal'){
          if(is134)result.stretched134++;
          if(pattern==='124'||pattern==='421')result.stretched124++;
        }else if(is134){
          if([bf.shape,qf.shape,pf.shape].some(s=>s!=='normal'))result.mixed134++;
          else result.normal134++;
        }
      }
    }
  });
  return result;
}
function acceptFamiliarNearTie(before,after){
  const bm=before.map(movementMetrics),am=after.map(movementMetrics);
  if(am.some((a,i)=>a.events>bm[i].events+1||a.anchorShifts>bm[i].anchorShifts||
    a.travel>bm[i].travel||a.outsideFirstNotes>bm[i].outsideFirstNotes))return false;
  const gain=bm.reduce((n,b,i)=>n+b.outsideFirstNotes-am[i].outsideFirstNotes,0);
  const lessShift=am.some((a,i)=>a.anchorShifts<bm[i].anchorShifts);
  const lessTravel=am.some((a,i)=>a.travel<bm[i].travel);
  return gain>=2&&((lessShift&&lessTravel)||gain>=4);
}
function describe(p){
  const group=p.technique==='naturalHarmonic'?'harmonic':p.f===0?'open':p.shape!=='normal'?'extended':
    p.anchor===1?'half':p.anchor===2?'first':p.anchor>=8?'high':'shifting';
  return {...p,group,positionLabel:p.technique==='naturalHarmonic'?'自然泛音・第3指輕觸弦長1/2':p.f===0?'空弦':LABELS[p.anchor]+
    (p.shape==='backwardExtended'?'・向後擴增把位':p.shape==='extended'?'・擴增把位':''),
    source:p.source||'computed-low-shift-v1',stringSource:'bounded-hand-state-search'};
}
// Presentation only: a contiguous same-string/same-anchor segment that uses
// an extension is colored across stopped notes only. Open 0 has no position.
// Actual shape and shift/extension metrics remain untouched.
function describeSegments(route){
  const result=route.map(describe);
  for(let start=0;start<result.length;){
    let end=start+1;
    while(end<result.length&&result[end].s===result[start].s&&
      result[end].anchor===result[start].anchor&&!result[end].displaySegmentStart)end++;
    if(result.slice(start,end).some(p=>p.f&&p.shape!=='normal')){
      for(let i=start;i<end;i++){
        const p=result[i];if(p.f===0)continue;
        p.displayExtended=true;p.group='extended';
        if(p.shape==='normal')p.positionLabel=LABELS[p.anchor]+'・擴增把位區段';
      }
    }
    start=end;
  }
  return result;
}
// Practice preference: repeated 0/1/2/4 across adjacent strings in one
// ordinary position beats an extended alternative saving only one shift.
// Apply only the owner's reviewed F-major two-octave route, not a blanket
// fingering override for unrelated keys, octaves or arpeggios. The untouched
// minimum-shifts policy remains available for comparison and future review.
function practicePreference(mode,key,octaves,arpeggio,minimum,legacyBounds=true){
  // With no register/connection reason to leave it, use first position.
  // Only this explicitly reviewed C-minor arpeggio is added in 045.
  if(mode==='minor'&&key[0]==='C'&&arpeggio){
    const strings=[0,0,1,1,2,2,3],fingers=[0,2,0,4,1,4,2];
    const preferred=minimum.map((p,i)=>{
      const shape=i===4||i===5?'backwardExtended':'normal';
      const found=candidates(p.midi,{s:strings[i],f:fingers[i]},[shape]).find(q=>q.anchor===2);
      if(!found)throw Error('Invalid reviewed first-position C-minor arpeggio');
      return {...found,source:'reviewed-first-position-minor-arpeggio-v1'};
    });
    if(preferred.some((p,i)=>i&&!transition(preferred[i-1],p,'up')))
      throw Error('Invalid reviewed C-minor arpeggio transition');
    return preferred;
  }
  if(mode!=='major'||key[0]!=='F'||octaves!==2||arpeggio)return minimum;
  const strings=[0,1,1,1,1,2,2,2,2,3,3,3,3,3,3];
  const fingers=legacyBounds?[4,0,1,2,4,0,1,2,4,0,1,3,1,3,4]:
    [4,0,1,2,4,0,1,2,4,0,1,2,4,1,2];
  const anchors=legacyBounds?[2,2,2,2,2,2,2,2,2,1,1,1,5,5,5]:
    [2,2,2,2,2,2,2,2,2,2,2,2,2,7,7];
  const preferred=minimum.map((p,i)=>{
    const shape=!legacyBounds&&i>=9&&i<=12?'backwardExtended':'normal';
    const candidate=candidates(p.midi,{s:strings[i],f:fingers[i]},[shape]).find(q=>
      q.anchor===anchors[i]&&q.shape===shape);
    if(!candidate)throw Error('Invalid reviewed ordinary-shape route');
    return {...candidate,source:legacyBounds?'reviewed-normal-0124-v1':'reviewed-F-124-fourth-position-v1'};
  });
  const before=metrics(minimum),after=metrics(preferred);
  if((legacyBounds&&(after.extensions!==0||before.extensions===0||after.shifts>before.shifts+1))||
    preferred.some((p,i)=>i&&!transition(preferred[i-1],p,'up')))
    throw Error('Reviewed ordinary-shape preference no longer meets its bounds');
  return preferred;
}
function reviewedMinorFirstPosition(notes,direction){
  // Owner-reviewed C melodic ascent / natural descent, with the same apex.
  // Backward extension preserves fingers 2–4 at their normal first position.
  // It is NOT a new candidate shape in the generic minimum-shifts search.
  const up=direction==='up',one=notes.length===8;
  const strings=one?(up?[0,0,0,0,1,1,1,1]:[1,1,1,1,0,0,0,0]):up?[0,0,0,0,1,1,1,1,2,2,2,2,3,3,3]:
    [3,3,2,2,2,2,2,1,1,1,1,0,0,0,0];
  const fingers=one?(up?[0,1,2,4,0,1,3,4]:[4,2,1,0,4,2,1,0]):up?
    [0,1,2,4,0,1,3,4,0,1,2,4,0,1,2]:[2,1,4,4,2,1,0,4,2,1,0,4,2,1,0];
  const backward=one?(up?[]:[2]):up?[9]:[1,3,4,5,9];
  const result=notes.map((note,i)=>{
    const shape=backward.includes(i)?'backwardExtended':'normal';
    const anchor=!one&&!up&&i===2?3:2;
    const found=candidates(note.midi,{s:strings[i],f:fingers[i]},[shape]).find(p=>p.anchor===anchor);
    if(!found)throw Error('Invalid reviewed C-minor first-position route');
    return {...found,source:'reviewed-first-position-minor-v1',...(!one&&!up&&i===2?{
      shiftCue:{toMidi:55,s:2,f:4,symbol:'（↑）',
        description:'同一第4指向弦枕方向移動半音；音高由 A♭3 降至 G3。'}
    }:{})};
  });
  if(result.some((p,i)=>i&&!transition(result[i-1],p,direction)))
    throw Error('Invalid reviewed C-minor transition');
  return result;
}
// 048 individually audited major routes; no global search-weight change.
// Each tuple is [string, finger, normal reference, shape]. Partial patches
// retain every other047 placement. Mirroring happens after validation.
const REVIEWED_048_MAJOR={
  'E|1|false':[[0,1,4,'extended'],[0,2,4,'extended'],[0,4,4,'extended'],[1,1,2,'extended'],[1,2,2,'extended'],[1,4,2,'extended'],[2,1,1,'normal'],[2,2,1,'normal']],
  'B|1|false':[[1,1,4,'extended'],[1,2,4,'extended'],[1,4,4,'extended'],[2,1,2,'extended'],[2,2,2,'extended'],[2,4,2,'extended'],[3,1,1,'normal'],[3,2,1,'normal']],
  'F♯|1|false':[[0,2,4,'extended'],[0,4,4,'extended'],[1,1,3,'normal'],[1,2,3,'normal'],[1,4,3,'normal'],[2,1,2,'backwardExtended'],[2,2,2,'backwardExtended'],[2,3,2,'backwardExtended']],
  'D♭|2|true':[[0,1,2,'backwardExtended'],[0,4,2,'backwardExtended'],[1,1,2,'backwardExtended'],[1,4,3,'normal'],[2,1,3,'normal'],[2,4,3,'normal'],[3,2,3,'normal']],
  'F♯|2|true':[null,[1,1,3,'normal'],[1,4,3,'normal']],
  'A♭|2|true':[null,null,null,null,[3,1,3,'normal'],[3,4,3,'normal']]
};
function reviewedMajor048(key,octaves,arpeggio,up){
  const spec=REVIEWED_048_MAJOR[[key[0],octaves,arpeggio].join('|')];if(!spec)return null;
  const result=up.map((p,i)=>{
    if(!spec[i])return {...p,source:'reviewed-major-048-v1'};
    const [s,f,anchor,shape]=spec[i],found=candidates(p.midi,{s,f},[shape]).find(q=>q.anchor===anchor);
    if(!found)throw Error('Invalid reviewed048 major pitch: '+key[0]+'/'+i);
    return {...found,source:'reviewed-major-048-v1'};
  });
  if(result.some((p,i)=>i&&!movementStep(result[i-1],p,'up')))throw Error('Invalid reviewed048 major transition');
  return result;
}
function route(mode,key,direction,octaves=2,arpeggio=false,policy='preferred'){
  if(!['preferred','reviewed-058','reviewed-055','reviewed-054','reviewed-053','reviewed-052','reviewed-051','reviewed-048','reviewed-047','reviewed-046','reviewed-045','minimum-shifts','minimum-movements','first-family'].includes(policy))
    throw Error('Unknown route policy');
  const reviewed055=policy==='preferred'||policy==='reviewed-058'||policy==='reviewed-055';
  const reviewed054=reviewed055||policy==='reviewed-054';
  const reviewed053=reviewed054||policy==='reviewed-053';
  const reviewed052=reviewed053||policy==='reviewed-052';
  const reviewed048=reviewed052||policy==='reviewed-051'||policy==='reviewed-048';
  const id=[mode,key[0],octaves,arpeggio,policy].join('|');
  if(!cache.has(id)){
    const F=window.CelloFingerboard;
    const upNotes=arpeggio?F.arpeggioNotes(mode,key,'up'):F.scaleNotes(mode,key,'up',octaves);
    const motion=!['minimum-shifts','reviewed-045'].includes(policy);
    const solve=(notes,dir='up',turn=null)=>motion?
      searchMotion(notes,dir,null,null,turn,policy==='first-family'):search(notes,dir,null,null,turn);
    const reviewed=reviewed048||policy==='reviewed-047'||policy==='reviewed-045'||policy==='reviewed-046';
    let up,down;
    if(mode==='major'||arpeggio){
      up=solve(upNotes);
      if(up&&reviewed)up=practicePreference(mode,key,octaves,arpeggio,up,!motion);
      down=up&&[...up].reverse();
    }else{
      const downNotes=F.scaleNotes(mode,key,'down',octaves);
      // Optimize the entire melodic/natural cycle jointly, including the
      // common apex. A cheap ascent must not force a costly descent.
      const cycle=solve([...upNotes,...downNotes.slice(1)],'up',upNotes.length);
      up=cycle?.slice(0,upNotes.length);down=cycle?.slice(upNotes.length-1);
      if(reviewed&&key[0]==='C'&&(octaves===1||octaves===2)){
        up=reviewedMinorFirstPosition(upNotes,'up');
        down=reviewedMinorFirstPosition(downNotes,'down');
      }
    }
    const fsharpLayout=(reviewed048||policy==='reviewed-047')&&mode==='minor'&&key[0]==='F♯'&&octaves===2&&!arpeggio;
    const pinned=fsharpLayout||(mode==='major'&&key[0]==='F'&&octaves===2&&!arpeggio)||
      (mode==='minor'&&key[0]==='C');
    if((reviewed048||policy==='reviewed-047'||policy==='reviewed-046')&&!pinned&&up&&down){
      const caps={up:movementMetrics(up).events+1,down:movementMetrics(down).events+1};
      let alternativeUp,alternativeDown;
      if(mode==='major'||arpeggio){
        alternativeUp=searchMotion(upNotes,'up',null,null,null,true,caps);
        alternativeDown=alternativeUp&&[...alternativeUp].reverse();
      }else{
        const downNotes=F.scaleNotes(mode,key,'down',octaves);
        const cycle=searchMotion([...upNotes,...downNotes.slice(1)],'up',null,null,upNotes.length,true,caps);
        alternativeUp=cycle?.slice(0,upNotes.length);alternativeDown=cycle?.slice(upNotes.length-1);
      }
      if(alternativeUp&&alternativeDown&&acceptFamiliarNearTie([up,down],[alternativeUp,alternativeDown])){
        up=alternativeUp.map(p=>({...p,source:'computed-first-family-near-tie-v1'}));
        down=alternativeDown.map(p=>({...p,source:'computed-first-family-near-tie-v1'}));
      }
    }
    if((reviewed048||policy==='reviewed-047')&&mode==='minor'&&key[0]==='F♯'&&arpeggio&&up){
      // Keep the lower three exactly as selected in046. D-string normal1/4
      // spans three semitones; A-string1/4 spans FIVE and needs a real shift.
      up=up.map((p,i)=>{
        if(i<3)return {...p,source:'reviewed-fsharp-arpeggio-v1'};
        const s=i<5?2:3,f=[1,4,1,4][i-3],anchor=[4,4,4,5][i-3],shape=i<5?'normal':'extended';
        const found=candidates(p.midi,{s,f},[shape]).find(q=>q.anchor===anchor);
        if(!found)throw Error('Invalid reviewed F-sharp arpeggio');
        return {...found,source:'reviewed-fsharp-arpeggio-v1'};
      });
      if(up.some((p,i)=>i&&!transition(up[i-1],p,'up')))throw Error('Invalid F-sharp arpeggio transition');
      down=[...up].reverse().map(p=>({...p}));
      up[5].shiftCue={toMidi:66,s:3,f:4,symbol:'換把半音',placement:'below',
        description:'C♯4第1指到F♯4第4指相差五半音，須另外向琴橋換把半音；不是同一固定擴增手型。'};
      down[0].shiftCue={toMidi:61,s:3,f:1,symbol:'換把半音',placement:'below',
        description:'F♯4第4指到C♯4第1指相差五半音，須另外向弦枕換把半音；不是同一固定擴增手型。'};
    }
    if(reviewed048&&mode==='major'&&up){
      const selected=reviewedMajor048(key,octaves,arpeggio,up);
      if(selected){up=selected;down=[...up].reverse().map(p=>({...p}));}
    }
    if(!up||!down)throw Error('No playable route: '+id);
    // 047 owner review selects the already-existing exact minimum-movement
    // candidate for this one scale: 3/3/3/6 including apex, low G-sharp on C.
    // Do not globally retune the near-tie policy or one-octave/arpeggio routes.
    if(fsharpLayout){
      up=up.map(p=>({...p,source:'reviewed-fsharp-3336-v1'}));
      down=down.map(p=>({...p,source:'reviewed-fsharp-3336-v1'}));
    }
    // 048 owner-confirmed A-string ascending 12124. D-sharp/E-sharp use
    // forward extension at reference6, then F-sharp4 contracts to normal6.
    // Preserve the SAME apex on descent; E-natural2 then stays in that frame.
    // This separates the earlier combined shift/closure into two events.
    if(fsharpLayout&&reviewed048){
      const replace=(p,f,anchor,shape)=>{
        const found=candidates(p.midi,{s:3,f},[shape]).find(q=>q.anchor===anchor);
        if(!found)throw Error('Invalid reviewed F-sharp ascending12124');
        return {...found,source:'reviewed-fsharp-12124-v1'};
      };
      up=up.map((p,i)=>i<12?p:replace(p,[1,2,4][i-12],6,i===14?'normal':'extended'));
      down=down.map((p,i)=>i>1?p:replace(p,i===0?4:2,6,'normal'));
      // Explicit reviewed closure ends the preceding orange segment, even
      // though the normal first-finger reference stays at6.
      up[14].displaySegmentStart=true;down[0].displaySegmentStart=true;
      for(const [r,dir]of[[up,'up'],[down,'down']])
        if(r.some((p,i)=>i&&!movementStep(r[i-1],p,dir)))throw Error('Invalid F-sharp12124 transition');
      if(['midi','s','f','anchor','shape'].some(k=>up.at(-1)[k]!==down[0][k]))
        throw Error('F-sharp12124 apex mismatch');
    }
    if(reviewed052||policy==='reviewed-051'){
      // Only A-key two-octave scale/arpeggio A4 endpoints use this harmonic.
      // The sounding pitch equals open A's second partial. The third finger
      // LIGHTLY touches its midpoint; it is not a stopped normal-position note.
      if(key[0]==='A'&&octaves===2){
        if(mode==='minor'&&!arpeggio){
          up=up.map(p=>{
            if(![64,66,68].includes(p.midi))return p;
            const f={64:1,66:2,68:4}[p.midi];
            const found=candidates(p.midi,{s:3,f},['extended']).find(q=>q.anchor===7);
            if(!found)throw Error('Invalid A-minor harmonic lead-in');
            return {...found,source:'reviewed-a-harmonic-v1'};
          });
        }
        const harmonic=p=>{
          if(p.midi!==69||p.s!==3||p.f!==3)throw Error('Invalid reviewed A harmonic apex');
          return {...p,technique:'naturalHarmonic',harmonic:{partial:2,touchSemitones:12,soundingMidi:69},
            displaySegmentStart:true,source:'reviewed-a-harmonic-v1'};
        };
        // Reference10/normal is retained only as latent movement bookkeeping;
        // display does not assert an ordinary stopped hand position here.
        up[up.length-1]=harmonic(up.at(-1));down[0]=harmonic(down[0]);
      }
      if(mode==='minor'&&key[0]==='C'&&octaves===2&&!arpeggio){
        down=down.map(p=>p.shiftCue?{...p,shiftCue:{...p.shiftCue,symbol:'↑',placement:'inside'}}:p);
      }
    }
    // 052 owner explicitly requests A-major ASCENT only: normal134,
    // forward extended124, then the existing third-finger A4 harmonic.
    // Existing descent and all other major mirrors remain unchanged.
    if(reviewed052&&mode==='major'&&key[0]==='A'&&octaves===2&&!arpeggio){
      up=up.map(p=>{
        if(![64,66,68].includes(p.midi))return {...p,source:'reviewed-a-major-ascent-052-v1'};
        const f={64:1,66:2,68:4}[p.midi];
        const found=candidates(p.midi,{s:3,f},['extended']).find(q=>q.anchor===7);
        if(!found)throw Error('Invalid A-major ascent124');
        return {...found,source:'reviewed-a-major-ascent-052-v1'};
      });
    }
    // 052 owner-reviewed E-major/minor A-string ASCENT 0|1↓|134.
    // First-position B1 shifts a whole tone toward the bridge to C-sharp1;
    // C-sharp/D-sharp/E then share ONE normal upper-second-position frame.
    if(reviewed052&&key[0]==='E'&&octaves===2&&!arpeggio){
      up=up.map(p=>{
        if(p.s!==3)return {...p,source:'reviewed-e-ascent-01134-052-v1'};
        const f={57:0,59:1,61:1,63:3,64:4}[p.midi],anchor=p.midi<=59?2:4;
        const found=candidates(p.midi,{s:3,f},['normal']).find(q=>q.anchor===anchor);
        if(!found)throw Error('Invalid E ascent01134');
        return {...found,source:'reviewed-e-ascent-01134-052-v1',...(p.midi===59?{
          shiftCue:{toMidi:61,s:3,f:1,symbol:'↓',placement:'inside',
            description:'同一第1指連同手型向琴橋方向移動全音；後續1、3、4指同屬正常上第二把位。'}
        }:{})};
      });
    }
    // Four audited E/B-minor ascent closures (one/two octaves). Only the
    // first finger moves one semitone toward the bridge; fingers2-4 stay put.
    // The following normal134 is NOT one continuous extended hand shape.
    if(reviewed052&&mode==='minor'&&['E','B'].includes(key[0])&&!arpeggio){
      for(let i=0;i<up.length-1;i++){
        const a=up[i],b=up[i+1];
        if(a.s!==b.s||a.f!==1||b.f!==1||a.anchor!==2||b.anchor!==2||
          a.shape!=='backwardExtended'||b.shape!=='normal'||b.midi-a.midi!==1)continue;
        up[i]={...a,shiftCue:{toMidi:b.midi,s:b.s,f:b.f,symbol:'↓',placement:'inside',
          description:'同一第1指向琴橋方向移動半音，收回向後擴增；其餘手指不移位，後續回到正常第一把位。'}};
        up[i+1]={...b,displaySegmentStart:true};
      }
    }
    // 053: mirror A-minor ascent DIGITS and strings, not its raised pitches.
    // Natural G/F/E use 4/2/1 in one NORMAL fourth-position contact frame.
    // A4 remains the third-finger natural harmonic, not a stopped-frame note.
    if(reviewed053&&mode==='minor'&&key[0]==='A'&&octaves===2&&!arpeggio){
      down=down.map(p=>{
        if(![67,65,64].includes(p.midi))return p;
        const f={67:4,65:2,64:1}[p.midi];
        const found=candidates(p.midi,{s:3,f},['normal']).find(q=>q.anchor===7);
        if(!found)throw Error('Invalid A-minor natural descending421');
        return {...found,source:'reviewed-a-minor-return-053-v1'};
      });
    }
    // Keep the reviewed F-sharp arpeggio route, but avoid confusing the
    // wide note interval with a 'semitone' movement label in any UI surface.
    if(reviewed053&&mode==='minor'&&key[0]==='F♯'&&arpeggio){
      const clarify=(r,direction)=>r.map(p=>p.shiftCue?{...p,shiftCue:{...p.shiftCue,symbol:'換把',
        description:direction==='up'?'C♯4第1指到F♯4第4指須向琴橋換把；兩音不在同一固定擴增手型。':
          'F♯4第4指到C♯4第1指須向弦枕換把；兩音不在同一固定擴增手型。'}}:p);
      up=clarify(up,'up');down=clarify(down,'down');
    }
    // Owner-selected exception to the generic upper-position1-3 heuristic:
    // A-string G4/A4/B-flat4 fit a complete NORMAL sixth-position134 frame.
    // Do not make high fourth fingers available to the generic candidate set.
    if(reviewed053&&mode==='major'&&key[0]==='B♭'&&octaves===2&&!arpeggio){
      up=up.map(p=>{
        if(![67,69,70].includes(p.midi))return p;
        const f={67:1,69:3,70:4}[p.midi],anchor=10,shape='normal';
        if(p.midi!==OPEN[3]+anchor+SHAPES[shape][f-1])throw Error('Invalid reviewed B-flat normal134');
        return {midi:p.midi,s:3,f,anchor,shape,source:'reviewed-bflat-upper134-053-v1'};
      });
      down=[...up].reverse().map(p=>({...p}));
    }
    // E-minor's C-string E2/F-sharp2 fingers2/4 also fit one complete
    // normal upper-first/lower-second frame. Prefer the owner's chart frame
    // over keeping an unused extended first finger at the lower reference.
    if(reviewed053&&mode==='minor'&&key[0]==='E'&&!arpeggio){
      const normalPair=r=>r.map(p=>{
        if(p.s!==0||!((p.midi===40&&p.f===2)||(p.midi===42&&p.f===4)))return p;
        const found=candidates(p.midi,{s:0,f:p.f},['normal']).find(q=>q.anchor===3);
        if(!found)throw Error('Invalid E-minor upper-first24');
        return {...found,source:'reviewed-e-minor-upper-first24-053-v1'};
      });
      up=normalPair(up);down=normalPair(down);
    }
    // 053: A-key arpeggios use the approved ascending scale's exact
    // degree placements, then reverse them. This does not rewrite either
    // scale descent (A major intentionally retains its own descent).
    if(reviewed053&&key[0]==='A'&&arpeggio){
      const scale=route(mode,key,'up',2,false,policy);
      up=upNotes.map(note=>{
        const p=scale.find(q=>q.midi===note.midi);
        if(!p)throw Error('Missing A-arpeggio scale degree');
        const selected={...p,source:'reviewed-a-scale-derived-arpeggio-053-v1'};
        // Recompute contextual rendering for this shorter route; never
        // carry a scale-only next-note cue onto a different arpeggio leap.
        for(const field of['group','positionLabel','displayExtended','shiftCue'])delete selected[field];
        return selected;
      });
      down=[...up].reverse().map(p=>({...p}));
    }
    // 054: preserve the approved ascent for every major scale and mirror
    // its physical route exactly. Directional cues describe the return leg.
    if(reviewed054&&mode==='major'&&!arpeggio){
      if(key[0]==='E'&&octaves===2){
        up=up.map(p=>p.midi===51?{...p,shiftCue:{toMidi:52,s:2,f:1,symbol:'↓',placement:'inside',
          description:'D♯3至E3同一第1指向琴橋移動，由向後擴增轉為前擴增；後續E3、F♯3、G♯3維持擴增124，並非正常第一把位。'}}:p);
      }
      down=[...up].reverse().map(p=>{const q={...p};delete q.shiftCue;return q;});
      for(let i=0;i<up.length-1;i++){
        const cue=up[i].shiftCue,next=up[i+1];
        if(!cue||cue.toMidi!==next.midi)continue;
        const description=up[i].midi===51?
          'E3至D♯3同一第1指向弦枕移動，由前擴增回到向後擴增手型。':
          'C♯4至B3同一第1指連同手型向弦枕移動全音，回到正常第一把位。';
        down[up.length-2-i].shiftCue={toMidi:up[i].midi,s:up[i].s,f:up[i].f,
          symbol:'↑',placement:'inside',description};
      }
    }
    // 055: only the E-minor arpeggio apex changes to the owner's second
    // finger, in a verified normal upper-third/lower-fourth contact frame.
    if(reviewed055&&mode==='minor'&&key[0]==='E'&&arpeggio){
      const apex=up.at(-1);
      if(apex.midi!==64||apex.s!==3)throw Error('Unexpected E-minor arpeggio apex');
      const found=candidates(apex.midi,{s:3,f:2},['normal']).find(p=>p.anchor===6);
      if(!found)throw Error('Invalid E-minor second-finger apex');
      up[up.length-1]={...found,source:'reviewed-e-minor-arpeggio-apex2-055-v1'};
      down=[...up].reverse().map(p=>({...p}));
    }
    // 055: B-minor upper digits follow the owner's scale13123 and
    // arpeggio1143. Natural-minor return pitches require different frames.
    if(reviewed055&&mode==='minor'&&key[0]==='B'){
      const place=(p,f,anchor,shape)=>{
        const found=candidates(p.midi,{s:3,f},[shape]).find(q=>q.anchor===anchor);
        if(!found)throw Error('Invalid reviewed B-minor upper frame');
        return {...found,source:'reviewed-b-minor-upper-055-v1'};
      };
      if(arpeggio){
        up=up.map(p=>p.midi===62?place(p,1,5,'extended'):p.midi===66?place(p,4,5,'extended'):p);
        down=[...up].reverse().map(p=>({...p}));
      }else if(octaves===2){
        up=up.map(p=>[64,66].includes(p.midi)?place(p,p.midi===64?1:3,7,'normal'):
          [68,70,71].includes(p.midi)?place(p,{68:1,70:2,71:3}[p.midi],11,'extended'):p);
        down=down.map(p=>p.midi===71?place(p,3,11,'extended'):
          [69,67].includes(p.midi)?place(p,p.midi===69?2:1,10,'extended'):p);
      }
    }
    // 055: only high E-flat4 in G-minor's natural two-octave descent.
    // Start the extension at this note; do not relabel preceding normal G/F.
    if(reviewed055&&mode==='minor'&&key[0]==='G'&&octaves===2&&!arpeggio){
      down=down.map(p=>{
        if(p.midi!==63)return p;
        const found=candidates(p.midi,{s:3,f:1},['backwardExtended']).find(q=>q.anchor===7);
        if(!found)throw Error('Invalid G-minor high E-flat first finger');
        return {...found,displaySegmentStart:true,source:'reviewed-g-minor-high-eflat1-055-v1'};
      });
    }
    // 056: owner's latest A-minor arpeggio A-string0143 supersedes the
    // earlier scale-derived0213; only C4/E4 change to one extended frame3.
    if(['preferred','reviewed-058'].includes(policy)&&mode==='minor'&&key[0]==='A'&&arpeggio){
      up=up.map(p=>{
        if(![60,64].includes(p.midi))return p;
        const found=candidates(p.midi,{s:3,f:p.midi===60?1:4},['extended']).find(q=>q.anchor===3);
        if(!found)throw Error('Invalid A-minor arpeggio0143');
        return {...found,source:'reviewed-a-minor-arpeggio0143-056-v1'};
      });
      down=[...up].reverse().map(p=>({...p}));
    }
    // 20261118-002: A-major arpeggio A-string0143 only. C-sharp/E
    // share a normal frame4; preserve open A and the third-finger A4 harmonic.
    if(policy==='preferred'&&mode==='major'&&key[0]==='A'&&arpeggio){
      up=up.map(p=>{
        if(![61,64].includes(p.midi))return p;
        const found=candidates(p.midi,{s:3,f:p.midi===61?1:4},['normal']).find(q=>q.anchor===4);
        if(!found)throw Error('Invalid A-major arpeggio0143');
        return {...found,source:'reviewed-a-major-arpeggio0143-20261118-002'};
      });
      down=[...up].reverse().map(p=>({...p}));
    }
    // 059: owner's spoken review of these four two-octave routes only.
    // Fingerboard sequences are specified low-to-high, including descent.
    // Resolve physical contact frames, never relabel a finger at a wrong pitch.
    if(policy==='preferred'&&octaves===2){
      const place=(p,s,f,anchor,shape='normal')=>{
        const found=candidates(p.midi,{s,f},[shape]).find(q=>q.anchor===anchor);
        if(!found)throw Error('Invalid voice-reviewed059 placement: '+key[0]+'/'+p.midi);
        return {...found,source:'owner-voice-review-059-v1'};
      };
      if(mode==='major'&&arpeggio&&['F','E♭'].includes(key[0])){
        up[up.length-1]=place(up.at(-1),3,2,key[0]==='F'?7:5);
        down=[...up].reverse().map(p=>({...p}));
      }
      if(mode==='major'&&key[0]==='B♭'){
        const spec=arpeggio?{58:[1,2,'backwardExtended'],62:[1,5],65:[4,5],70:[3,11]}:
          {63:[1,6,'extended'],65:[2,6,'extended'],67:[1,10,'extended'],69:[2,10,'extended'],70:[3,10,'extended']};
        up=up.map(p=>spec[p.midi]?place(p,3,...spec[p.midi]):p);
        down=[...up].reverse().map(p=>({...p}));
      }
      if(mode==='major'&&key[0]==='E♭'&&!arpeggio){
        const spec={55:[2,1,5],56:[2,2,5],58:[2,4,5],60:[3,1,3],62:[3,3,3],63:[3,4,3]};
        up=up.map(p=>spec[p.midi]?place(p,...spec[p.midi]):p);
        down=[...up].reverse().map(p=>({...p}));
      }
      if(mode==='minor'&&key[0]==='F♯'){
        if(arpeggio){
          const spec={54:[2,2,3],57:[2,1,7,'extended'],61:[2,4,7,'extended'],66:[3,2,8]};
          up=up.map(p=>spec[p.midi]?place(p,...spec[p.midi]):p);
          down=[...up].reverse().map(p=>({...p}));
        }else{
          const ascent={59:[3,1,2],61:[3,3,2],63:[3,1,6],65:[3,3,6],66:[3,4,6]};
          const descent={62:[3,1,5,'extended'],64:[3,2,5,'extended'],66:[3,4,6],42:[0,1,6],44:[0,3,6]};
          up=up.map(p=>ascent[p.midi]?place(p,...ascent[p.midi]):p);
          down=down.map(p=>descent[p.midi]?place(p,...descent[p.midi]):p);
        }
      }
    }
    // 20261118-003: E-flat arpeggio D-string114; move B-flat3 off A.
    // Keep the lower E-flat first finger and the reviewed top E-flat second.
    if(policy==='preferred'&&mode==='major'&&key[0]==='E♭'&&arpeggio){
      up=up.map(p=>{
        if(![55,58].includes(p.midi))return p;
        const found=candidates(p.midi,{s:2,f:p.midi===55?1:4},['normal']).find(q=>q.anchor===5);
        if(!found)throw Error('Invalid E-flat arpeggio D-string114');
        return {...found,source:'reviewed-eflat-arpeggio114-20261118-003'};
      });
      down=[...up].reverse().map(p=>({...p}));
    }
    // 20261118-005: E-major scale D-string124124, including A3/B3.
    // Two normal contact frames replace the old extension/shift cues.
    if(policy==='preferred'&&mode==='major'&&key[0]==='E'&&octaves===2&&!arpeggio){
      const spec={51:[1,1],52:[2,1],54:[4,1],56:[1,6],57:[2,6],59:[4,6]};
      up=up.map(p=>{
        if(!spec[p.midi])return p;
        const [f,anchor]=spec[p.midi];
        const found=candidates(p.midi,{s:2,f},['normal']).find(q=>q.anchor===anchor);
        if(!found)throw Error('Invalid E-major scale D-string124124');
        return {...found,source:'reviewed-e-major-scale124124-20261118-005'};
      });
      down=[...up].reverse().map(p=>({...p}));
    }
    if(motion){
      const source=policy==='first-family'?'computed-first-family-comparison-v1':'computed-movement-events-v1';
      up=up.map(p=>({...p,source:p.source||source}));down=down.map(p=>({...p,source:p.source||source}));
    }
    cache.set(id,{up:describeSegments(up),down:describeSegments(down)});
  }
  return cache.get(id)[direction].map(p=>({...p}));
}
function get(mode,key,direction,notes,arpeggio=false){
  const octaves=arpeggio?2:(notes.length-1)/7;
  const found=route(mode,key,direction,octaves,arpeggio);
  if(found.length!==notes.length||found.some((p,i)=>p.midi!==notes[i].midi))
    throw Error('Optimized route pitch mismatch');
  return Object.fromEntries(found.map(p=>[String(p.midi),p]));
}
function metrics(route){
  if(!route)return null;
  let shifts=0,travel=0,crossings=0,extensions=0;
  route.forEach((p,i)=>{
    if(p.f&&p.shape!=='normal')extensions++;
    if(i){const q=route[i-1];if(p.anchor!==q.anchor)shifts++;
      travel+=Math.abs(p.anchor-q.anchor);crossings+=Math.abs(p.s-q.s);}
  });
  return {shifts,travel,crossings,extensions};
}
window.CelloFingeringOptimizer={get,route,search,candidates,transition,metrics,searchMotion,motionCandidates,physicalFrame,acceptFamiliarNearTie,movementStep,movementCost,movementMetrics,LABELS,SHAPES};
})();
