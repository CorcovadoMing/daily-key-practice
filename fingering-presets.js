/* Werner photo only. Confirmed digits from the user's supplied photograph,
 * page 76: major (left) and minor (right), 2026-11-06.
 * IMPORTANT: Only clearly legible ascending scale beginnings are transcribed.
 * Do not synthesize or borrow any other method's fingerings for missing notes.
 * Tokens: string index C=0,G=1,D=2,A=3 : left hand finger (0=open)
 *        : position class for visual annotation.
 * Enharmonic name is pitch-matched; no fingering is inferred from spelling.
 * Unverified descending / higher notes stay unannotated until photo verified.
 */
(function(){
'use strict';
const OPEN=[36,43,50,57];
const VERIFIED={
  major:{
    'C':['0:0:o','0:1:f','0:3:f','0:4:f','1:0:o','1:1:f','1:3:f','1:4:f'],
    'G':['1:0:o','1:1:f','1:3:f','1:4:f','2:0:o','2:1:f','2:3:f','2:4:f'],
    'D':['0:1:f','0:2:f','0:4:e','1:0:o','1:1:f','1:2:f','1:4:e','2:0:o'],
    'A':['1:1:e','1:2:e','1:4:e','2:0:o','2:1:e','2:2:e','2:4:e','3:0:o'],
    'F':['0:4:f','1:0:o','1:1:f','1:2:f','1:4:f','2:0:o','2:1:f'],
    'B♭':['1:1:e','1:2:e','1:4:e','2:1:s']
  },
  minor:{
    'A':['1:1:f','1:3:f','1:4:f','2:0:o','2:1:f','2:2:e','2:4:e'],
    'E':['0:2:f','0:4:f','1:0:o']
  }
};
const GROUP={o:'open',f:'first',e:'extended',s:'shifting'};
function get(mode,key,direction,notes){
  // The photograph provides explicit separate descending fingering numbers;
  // these are not yet reliably transcribed. Never reuse the ascending fingering
  // without verification.
  if(direction!=='up')return {};
  const values=VERIFIED[mode]?.[key[0]];
  if(!values)return {};
  const ordered=[...notes].sort((a,b)=>a.midi-b.midi);
  const map={};
  for(let i=0;i<Math.min(ordered.length,values.length);i++){
    const [s,f,g]=values[i].split(':');
    const string=Number(s),finger=Number(f);
    const semi=ordered[i].midi-OPEN[string];
    if(semi<0||semi>24)continue;
    map[ordered[i].midi]={midi:ordered[i].midi,s:string,f:finger,group:GROUP[g],source:'user-werner-photo'};
  }
  return map;
}
window.CelloFingeringPresets={get,VERIFIED,STRING_OPEN:OPEN,source:'user-werner-photo'};
})();
