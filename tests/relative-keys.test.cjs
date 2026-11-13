const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const major=vm.runInNewContext(html.match(/const MAJOR_KEYS = (\[[\s\S]*?\n    \]);/)[1]);
const minor=vm.runInNewContext(html.match(/const MINOR_KEYS = (\[[\s\S]*?\n    \]);/)[1]);
const fn=vm.runInNewContext('('+html.match(/function relativeKeyLabel\(mode,key\)\{[\s\S]*?\n    \}/)[0]+')');
const expectedMajor=['A','B♭','B','C','C♯','D','D♯','E','F','F♯','G','G♯'];
const expectedMinor=['E♭','E','F','G♭','G','A♭','A','B♭','B','C','D♭','D'];
major.forEach((key,i)=>test(key[0]+' major relative minor spelling',()=>assert.equal(fn('major',key),'關係小調：'+expectedMajor[i])));
minor.forEach((key,i)=>test(key[0]+' minor relative major spelling',()=>assert.equal(fn('minor',key),'關係大調：'+expectedMinor[i])));
