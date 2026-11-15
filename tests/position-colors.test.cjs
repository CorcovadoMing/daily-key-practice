const test=require('node:test'),a=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),c={window:{}};vm.createContext(c);vm.runInContext(fs.readFileSync('fingerboard.js','utf8'),c);const F=c.window.CelloFingerboard;
function lum(hex){const x=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return x[0]*.2126+x[1]*.7152+x[2]*.0722;}
test('all13 chart anchors have precise names, sampled colors and accessible digit contrast',()=>{
 a.equal(F.CHART_POSITIONS.length,14);
 for(let anchor=1;anchor<=13;anchor++)for(const shape of['normal','extended','backwardExtended']){
  const style=F.pointStyling({semitones:anchor+1,finger:2,anchor,shape,group:'shifting'});a.equal(style.group,'position-'+anchor);a.equal(style.extended,shape!=='normal');a.ok(style.label.includes(F.CHART_POSITIONS[anchor][0]));a.doesNotMatch(style.label,/其他把位/);
  a.equal(style.textColor,'#ffffff');const x=lum(style.textStroke==='none'?F.POSITION_COLORS[style.group]:style.textStroke),y=lum(style.textColor);a.ok((Math.max(x,y)+.05)/(Math.min(x,y)+.05)>=4.5);
 }
});
test('opens, edits, harmonics and unverified placements never inherit an ordinary chart position',()=>{
 for(const[p,g]of[[{semitones:0,finger:0,anchor:2,shape:'extended'},'open'],[{semitones:12,finger:3,anchor:10,technique:'naturalHarmonic'},'harmonic'],[{semitones:5,finger:4,anchor:2,custom:true},'custom'],[{semitones:5,finger:4},'unverified']]){const s=F.pointStyling(p);a.equal(s.group,g);a.equal(s.extended,false);}
});
