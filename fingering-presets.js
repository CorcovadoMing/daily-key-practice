/* Werner fingerings only: 12 full major ascending sequences confirmed by
 * user against their photo; descending is precisely the reversed sequence.
 * 0 = actual open string C/G/D/A, 1-4 = left-hand finger.
 * Strings and hand-position colors are inferred from confirmed finger numbers,
 * open-string pitches and contiguous note patterns, NOT independently checked
 * against every string placement in the user's sheet.
 * Existing partially transcribed minors are kept unchanged.
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
const MINOR_VERIFIED={
    'A':['1:1:f','1:3:f','1:4:f','2:0:o','2:1:f','2:2:e','2:4:e'],
    'E':['0:2:f','0:4:f','1:0:o','1:1:f','1:2:f','1:4:f','2:1:f','2:2:f'],
    'B':['1:2:f','1:4:f','2:0:o','2:1:f','2:2:f','2:4:f','3:1:f','3:2:f']
};
const MINOR_GROUP={o:'open',f:'first',e:'extended',s:'shifting'};
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
  if(direction!=='up')return {};
  const values=MINOR_VERIFIED[key[0]];
  if(!values)return {};
  const ordered=[...notes].sort((a,b)=>a.midi-b.midi),result={};
  for(let i=0;i<Math.min(values.length,ordered.length);i++){
    const [s,f,g]=values[i].split(':');
    const string=Number(s),finger=Number(f),midi=ordered[i].midi;
    if(midi-OPEN[string]<0||midi-OPEN[string]>24)continue;
    result[String(midi)]={midi,s:string,f:finger,group:MINOR_GROUP[g],
      source:'partially-transcribed-user-Werner-photo'};
  }
  return result;
}
function get(mode,key,direction,notes){
  return mode==='major'?majorPreset(key,direction,notes):minorPreset(key,direction,notes);
}
window.CelloFingeringPresets={
  get,VERIFIED:{major:MAJOR_FINGERS,minor:MINOR_VERIFIED},
  MAJOR_FINGERS,MAJOR_STRINGS,STRING_OPEN:OPEN,source:'user-Werner-photo'
};
})();
