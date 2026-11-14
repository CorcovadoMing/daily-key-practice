const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8'),code=html.split('// AUDIO_TOOLS_START')[1].split('// AUDIO_TOOLS_END')[0];
const sandbox={module:{exports:{}},Float32Array,Float64Array,Math,Number};vm.runInNewContext(code,sandbox);
const {detectPitch,pitchInputFloor}=sandbox.module.exports;
const ipad={userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15',platform:'MacIntel',maxTouchPoints:5};
test('only Android/iOS/iPadOS gets the modest lower floor',()=>{
 for(const userAgent of ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)','Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)','Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X)'])assert.equal(pitchInputFloor({userAgent}),.0002);
 assert.equal(pitchInputFloor(ipad),.0002);
 assert.equal(pitchInputFloor({userAgent:'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36',platform:'Linux armv8l',maxTouchPoints:5}),.0002);
 for(const device of [{},{...ipad,maxTouchPoints:0},{...ipad,maxTouchPoints:1},{...ipad,platform:'Win32'},{userAgent:'Mozilla/5.0 (Windows NT 10.0) Chrome/130',maxTouchPoints:10}])assert.equal(pitchInputFloor(device),.0003);
});
for(const rate of [44100,48000])for(const frequency of [65.406,98,146.832,220,440,880])test(`newly admitted quiet tone ${frequency}Hz / ${rate}`,()=>{
 const x=Float32Array.from({length:8192},(_,i)=>.0003*(Math.sin(2*Math.PI*frequency*i/rate)+.6*Math.sin(4*Math.PI*frequency*i/rate)+.25*Math.sin(6*Math.PI*frequency*i/rate)));
 assert.equal(detectPitch(x,rate),null);assert.equal(detectPitch(x,rate,pitchInputFloor({})),null);
 const got=detectPitch(x,rate,pitchInputFloor(ipad));assert.ok(got);assert.ok(Math.abs(1200*Math.log2(got/frequency))<5,`${got}`);
});
test('iOS floor still rejects silence, DC and below-floor periodic input',()=>{
 for(const rate of [44100,48000])for(const x of [new Float32Array(8192),new Float32Array(8192).fill(.05),Float32Array.from({length:8192},(_,i)=>.05+.0002*Math.sin(2*Math.PI*220*i/rate))])assert.equal(detectPitch(x,rate,.0002),null);
});
test('quiet and louder deterministic aperiodic noise stays rejected on iOS',()=>{
 for(const rate of [44100,48000])for(const amplitude of [.0002,.0004,.0006,.005,.1])for(let seed=1;seed<=30;seed++){
 let state=seed;const x=Float32Array.from({length:8192},()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return amplitude*(state/2147483648-1);});assert.equal(detectPitch(x,rate,.0002),null,`${rate} ${amplitude} ${seed}`);
 }
});
test('runtime detection and status use same platform-selected gate',()=>{
 assert.ok(code.includes('const tunerInputFloor = pitchInputFloor(navigator)'));
 assert.ok(code.includes('detectPitch(samples, context.sampleRate, tunerInputFloor)'));
 assert.ok(code.includes('rms < tunerInputFloor'));assert.ok(code.includes('rms >= tunerInputFloor'));
 assert.ok(code.includes('diff[tau] < 0.15'));
});
