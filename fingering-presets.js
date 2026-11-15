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
function describe(p){
  const group=p.f===0?'open':p.shape!=='normal'?'extended':
    p.anchor===1?'half':p.anchor===2?'first':p.anchor>=8?'high':'shifting';
  return {...p,group,positionLabel:p.f===0?'空弦':LABELS[p.anchor]+
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
      result[end].anchor===result[start].anchor)end++;
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
function practicePreference(mode,key,octaves,arpeggio,minimum){
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
  const fingers=[4,0,1,2,4,0,1,2,4,0,1,3,1,3,4];
  const anchors=[2,2,2,2,2,2,2,2,2,1,1,1,5,5,5];
  const preferred=minimum.map((p,i)=>{
    const candidate=candidates(p.midi,{s:strings[i],f:fingers[i]}).find(q=>
      q.anchor===anchors[i]&&q.shape==='normal');
    if(!candidate)throw Error('Invalid reviewed ordinary-shape route');
    return {...candidate,source:'reviewed-normal-0124-v1'};
  });
  const before=metrics(minimum),after=metrics(preferred);
  if(after.extensions!==0||before.extensions===0||after.shifts>before.shifts+1||
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
function route(mode,key,direction,octaves=2,arpeggio=false,policy='preferred'){
  if(policy!=='preferred'&&policy!=='minimum-shifts')throw Error('Unknown route policy');
  const id=[mode,key[0],octaves,arpeggio,policy].join('|');
  if(!cache.has(id)){
    const F=window.CelloFingerboard;
    const upNotes=arpeggio?F.arpeggioNotes(mode,key,'up'):F.scaleNotes(mode,key,'up',octaves);
    let up,down;
    if(mode==='major'||arpeggio){
      up=search(upNotes);
      if(up&&policy==='preferred')up=practicePreference(mode,key,octaves,arpeggio,up);
      down=up&&[...up].reverse();
    }else{
      const downNotes=F.scaleNotes(mode,key,'down',octaves);
      // Optimize the entire melodic/natural cycle jointly, including the
      // common apex. A cheap ascent must not force a costly descent.
      const cycle=search([...upNotes,...downNotes.slice(1)],'up',null,null,upNotes.length);
      up=cycle?.slice(0,upNotes.length);down=cycle?.slice(upNotes.length-1);
      if(policy==='preferred'&&key[0]==='C'&&(octaves===1||octaves===2)){
        up=reviewedMinorFirstPosition(upNotes,'up');
        down=reviewedMinorFirstPosition(downNotes,'down');
      }
    }
    if(!up||!down)throw Error('No playable route: '+id);
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
window.CelloFingeringOptimizer={get,route,search,candidates,transition,metrics,LABELS,SHAPES};
})();
