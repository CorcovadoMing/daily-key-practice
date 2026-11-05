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
const MINOR_STRINGS={
  "A": "11122223333333333333332222111",
  "E": "00111122222233333222222111100",
  "B": "11222233333333333333333222211",
  "F♯": "00011122233333333333222211100",
  "D": "00011112222333333322221111000",
  "G": "11112222333333333333322221111",
  "C": "00001111222223332222211110000",
  "C♯": "00001111122233332222111000000",
  "G♯": "11112222233333333333222111111",
  "F": "00011122223333333332222111000",
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
    const i=sourceIndices[n],midi=allMidi[i],s=Number(allStrings[i]),finger=Number(allFingers[i]);
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
