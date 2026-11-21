'use strict';
// Executable behavior documentation. No production Firebase/network needed.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const window = {};
const context = vm.createContext({window});
for (const name of ['fingerboard.js', 'fingering-presets.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, name), 'utf8'), context, {filename:name, timeout:5000});
}
const fb = window.CelloFingerboard;
const presets = window.CelloFingeringPresets;
assert.ok(fb && presets);
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const start = html.indexOf('const MAJOR_KEYS = [');
const end = html.indexOf('const STORAGE_KEY =', start);
assert.ok(start >= 0 && end > start, 'Find the current source key data, not duplicated fixtures');
const {major,minor} = vm.runInNewContext('(() => {'+html.slice(start,end)+'; return {major:MAJOR_KEYS,minor:MINOR_KEYS};})()', {}, {timeout:5000});
const OPEN = Array.from(presets.STRING_OPEN);

test('both modes contain exactly twelve pitch classes', () => {
  for (const keys of [major,minor]) {
    assert.equal(keys.length,12);
    assert.deepEqual(Array.from(keys, k => fb.pitchClass(k[0])).sort((a,b)=>a-b),
      Array.from({length:12},(_,i)=>i));
  }
});

test('major/melodic-minor 1- and 2-octave notes have right range and apex', () => {
  for (const [mode,keys] of [['major',major],['minor',minor]]) for (const key of keys) {
    for (const octaves of [1,2]) {
      const up=fb.scaleNotes(mode,key,'up',octaves), down=fb.scaleNotes(mode,key,'down',octaves);
      const tonic=36+fb.pitchClass(key[0]);
      assert.equal(up.length,octaves*7+1);
      assert.equal(down.length,up.length);
      assert.equal(up[0].midi,tonic);
      assert.equal(up.at(-1).midi,tonic+octaves*12);
      assert.equal(down[0].midi,up.at(-1).midi);
      assert.equal(down.at(-1).midi,tonic);
      assert.ok(up.every((n,i)=>i===0||n.midi>up[i-1].midi));
      assert.ok(down.every((n,i)=>i===0||n.midi<down[i-1].midi));
      if (mode==='major') {
        assert.deepEqual(Array.from(down,n=>n.midi),Array.from(up,n=>n.midi).reverse());
      } else {
        const natural=down.slice(-8).reverse(),melodic=up.slice(0,8);
        assert.equal(melodic[5].midi-natural[5].midi,1,key[0]+' raised 6');
        assert.equal(melodic[6].midi-natural[6].midi,1,key[0]+' raised 7');
      }
    }
  }
});

test('user-confirmed Werner finger sequences and inferred strings remain physically valid', () => {
  for (const [mode,keys] of [['major',major],['minor',minor]]) for (const key of keys) {
    for (const dir of ['up','down']) for (const octaves of [1,2]) {
      const notes=fb.scaleNotes(mode,key,dir,octaves);
      const data=presets.get(mode,key,dir,notes);
      assert.equal(Object.keys(data).length,notes.length,mode+' '+key[0]+' '+dir+' '+octaves);
      for (const n of notes) {
        const pos=data[String(n.midi)];
        assert.ok(pos,mode+' '+key[0]+': '+n.midi);
        assert.equal(pos.midi,n.midi);
        assert.ok(Number.isInteger(pos.s)&&pos.s>=0&&pos.s<=3);
        assert.ok(Number.isInteger(pos.f)&&pos.f>=0&&pos.f<=4);
        const semi=n.midi-OPEN[pos.s];
        assert.ok(semi>=0&&semi<=24);
        assert.equal(pos.f===0,semi===0);
        assert.match(pos.source,/user-confirmed-Werner/);
        assert.match(pos.stringSource,/inferred-/);
      }
    }
  }
});

test('accidental parsing and valid/invalid string placements', () => {
  assert.equal(fb.pitchClass('D♭'),1);
  assert.equal(fb.pitchClass('F♯'),6);
  assert.equal(fb.pitchClass('F𝄪'),7);
  assert.throws(()=>fb.pitchClass('H'));
  for (const midi of [36,43,50,57,69,81]) {
    const p=fb.positionFor(midi);
    assert.ok(p.semitones>=0&&p.semitones<=24);
  }
  assert.throws(()=>fb.positionFor(35));
  assert.throws(()=>fb.positionFor(82));
});

test('custom map parser recovers safely from malformed input', () => {
  for (const value of ['{broken','[]','null','']) {
    assert.equal(JSON.stringify(fb.decodeMap(value)),'{}');
  }
  assert.equal(JSON.stringify(fb.decodeMap('{"57":{"s":2,"f":3}}')),
    '{"57":{"s":2,"f":3}}');
  const old=fb.notePlacement(57,{},{}),valid=fb.notePlacement(57,{'57':{s:2,f:3}},{});
  assert.equal(old.semitones,0);
  assert.equal(valid.string,2);
  assert.equal(valid.finger,3);
  assert.equal(valid.custom,true);
  const invalid=fb.notePlacement(57,{'57':{s:7,f:3}},{});
  assert.equal(invalid.custom,false);
});
