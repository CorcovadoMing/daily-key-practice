/* Per-key major scale fingering references (two octaves), Cassia Harvey-style.
 * String indices: 0=C, 1=G, 2=D, 3=A. Each token is string:finger:group.
 * Minor scales: grouped three-note 1-3-4 / 1-2-4 pedagogical algorithm;
 * explicitly NOT a claimed transcription of Werner or Schroeder.
 * Instructor modifications are applied separately by fingerboard.js.
 */
(function(){
  'use strict';
  const STRING_OPEN=[36,43,50,57];
  const SIGNATURES={
  "C": "0:0:o 0:1:f 0:3:f 0:4:f 1:0:o 1:1:f 1:3:f 1:4:f 2:0:o 2:1:f 2:2:f 2:4:f 3:0:o 3:1:f 3:2:f",
  "D♭": "0:1:e 0:2:e 0:4:e 0:1:s 0:2:s 0:4:s 1:1:s 1:2:s 1:4:s 2:1:s 2:2:s 2:4:s 3:1:s 3:3:s 3:4:s",
  "D": "0:1:e 0:2:e 0:4:e 1:0:o 1:1:e 1:2:e 1:4:e 2:0:o 2:1:f 2:3:f 2:4:f 3:0:o 3:1:f 3:3:f 3:4:f",
  "E♭": "0:2:f 0:4:f 1:0:o 1:1:e 1:2:e 1:4:e 2:0:o 2:1:h 2:2:e 2:1:s 2:2:s 2:4:s 3:1:s 3:3:s 3:4:s",
  "E": "0:1:s 0:2:s 0:4:s 1:1:e 1:2:e 1:4:e 2:1:h 2:2:h 2:4:h 2:1:s 2:2:s 2:4:s 3:1:s 3:3:s 3:4:s",
  "F": "0:4:f 1:0:o 1:1:f 1:2:f 1:4:f 2:0:o 2:1:f 2:2:f 2:4:f 3:0:o 3:1:e 3:2:e 3:1:s 3:3:s 3:4:s",
  "F♯": "0:1:s 0:2:s 0:4:s 1:1:e 1:2:e 1:4:e 2:1:f 2:2:f 2:4:f 3:1:h 3:2:h 3:4:h 3:1:s 3:3:s 3:4:s",
  "G": "1:0:o 1:1:f 1:3:f 1:4:f 2:0:o 2:1:f 2:3:f 2:4:f 3:0:o 3:1:f 3:2:f 3:4:f 3:1:s 3:3:s 3:4:s",
  "A♭": "1:1:e 1:2:e 1:4:e 1:1:s 1:2:s 1:4:s 2:1:s 2:2:s 2:4:s 3:1:s 3:2:s 3:4:s 3:1:s 3:3:s 3:4:s",
  "A": "1:1:e 1:2:e 1:4:e 2:0:o 2:1:e 2:2:e 2:4:e 3:0:o 3:1:f 3:3:f 3:1:s 3:3:s 3:1:s 3:2:s 3:3:s",
  "B♭": "1:1:e 1:2:e 1:4:e 2:1:h 2:2:e 2:4:e 2:1:s 2:2:s 2:4:s 3:1:s 3:2:s 3:4:s 3:1:s 3:3:s 3:4:s",
  "B": "1:1:s 1:2:s 1:4:s 2:1:e 2:2:e 2:4:e 3:1:h 3:2:h 3:4:h 3:1:s 3:2:s 3:4:s 3:1:s 3:3:s 3:4:s"
};
  const GROUPS={"o":"open","h":"half","f":"first","e":"extended","s":"shifting","H":"high"};
  function majorPreset(key,ascending){
    const spec=SIGNATURES[key[0]];
    if(!spec)return null;
    const tokens=spec.split(' ');
    if(tokens.length!==15)throw Error('Expected 15 fingerings for '+key[0]);
    return ascending.map((n,i)=>{
      const [s,f,g]=tokens[i].split(':');
      return {midi:n.midi,s:Number(s),f:Number(f),group:GROUPS[g],source:'major-key-chart'};
    });
  }
  function minorPreset(ascending){
    const results=[];
    let previousString=0;
    for(let i=0;i<ascending.length;i+=3){
      const block=ascending.slice(i,i+3);
      if(block.length!==3)throw Error('Expected groups of 3 in 2-octave scale');
      const candidate=STRING_OPEN.map((open,s)=>{
        const semis=block.map(n=>n.midi-open);
        if(semis[0]<0||semis[2]>24||semis[2]-semis[0]>5)return null;
        const first=semis[0],openStart=first===0;
        return {s,semis,score:(s<previousString?18:0)+(openStart?-5:0)+
          (first>=12?10:0)+Math.abs(first-3)*.6+(s===previousString&&first>=9?5:0)};
      }).filter(Boolean).sort((a,b)=>a.score-b.score);
      if(!candidate.length)throw Error('No viable string for minor scale group');
      const best=candidate[0];
      const rel1=best.semis[1]-best.semis[0],rel2=best.semis[2]-best.semis[0];
      let finger;
      if(best.semis[0]===0)finger=[0,rel1===1?1:1,rel2<=3?2:3];
      else if(best.semis[0]>=12)finger=[1,2,3];
      else if(rel1===2&&rel2===3)finger=[1,3,4];
      else finger=[1,2,4];
      const base=best.semis[0],extension=rel1===2&&rel2===4;
      const group=base===0?'open':base===1?'half':base<=4?
        (extension?'extended':'first'):base<12?'shifting':'high';
      block.forEach((n,j)=>results.push({
        midi:n.midi,s:best.s,f:finger[j],
        group:best.semis[j]===0?'open':group,
        source:'minor-grouped-reference'
      }));
      previousString=best.s;
    }
    return results;
  }
  function get(mode,key,direction,notes){
    const ascending=direction==='down'?[...notes].reverse():notes;
    let proposals=mode==='major'?majorPreset(key,ascending):minorPreset(ascending);
    if(!proposals)return {};
    const result={};
    for(const p of proposals){
      const semi=p.midi-STRING_OPEN[p.s];
      if(!Number.isInteger(semi)||semi<0||semi>24)throw Error('Invalid reference placement: '+mode+' '+key[0]+' '+p.midi);
      result[String(p.midi)]=p;
    }
    return result;
  }
  window.CelloFingeringPresets={get,SIGNATURES,STRING_OPEN};
})();
