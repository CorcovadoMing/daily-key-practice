const test=require('node:test'), assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8'); const code=html.split('// AUDIO_TOOLS_START')[1].split('// AUDIO_TOOLS_END')[0];
const sandbox={module:{exports:{}},Float32Array,Float64Array,Math,Number};vm.runInNewContext(code,sandbox);const {detectPitch,pitchReading,PitchWindow}=sandbox.module.exports;
for(const rate of [44100,48000])for(const frequency of [65.406,98,146.832,220,440,880])test(`pitch ${frequency} at ${rate}`,()=>{const x=Float32Array.from({length:8192},(_,i)=>0.2*Math.sin(2*Math.PI*frequency*i/rate)+0.12*Math.sin(4*Math.PI*frequency*i/rate));const got=detectPitch(x,rate);assert.ok(got);assert.ok(Math.abs(1200*Math.log2(got/frequency))<5,`${got}`);});
test('silence and below-floor amplitude return null',()=>{assert.equal(detectPitch(new Float32Array(8192),48000),null);assert.equal(detectPitch(Float32Array.from({length:8192},(_,i)=>.0001*Math.sin(2*Math.PI*220*i/48000)),48000),null);});
test('note, reference and cents',()=>{assert.equal(pitchReading(440).name,'A4');assert.equal(pitchReading(442,442).cents,0);assert.ok(Math.abs(pitchReading(440*2**(20/1200)).cents-20)<1e-8)});
test('window averages jitter without blurring new note',()=>{const s=new PitchWindow();s.push(440*2**(-10/1200));assert.ok(Math.abs(s.push(440*2**(10/1200))-440)<.001);assert.ok(Math.abs(s.push(220)-220)<1e-8);s.reset();assert.ok(Math.abs(s.push(440)-440)<1e-8)});
test('roadmap removed and tools isolated to experiment html',()=>{assert.ok(!html.includes('<section class="experiment-roadmap"'));assert.ok(html.includes('id="tuner-panel"'));});
test('no beat gating; short averaging retained',()=>{assert.ok(!code.includes('BeatGate'));assert.ok(code.includes('smooth.push(frequency)'));});

test('tuner bands include exact signed boundaries',()=>{const {pitchBand}=sandbox.module.exports;for(const sign of [-1,1]){assert.equal(pitchBand(sign*10),'green');assert.equal(pitchBand(sign*10.01),'yellow');assert.equal(pitchBand(sign*20),'yellow');assert.equal(pitchBand(sign*20.01),'red');}assert.equal(pitchBand(0),'green');});

// Weak but periodic cello-like signals must not be discarded just for volume.
for(const rate of [44100,48000])for(const frequency of [65.406,98,146.832,220])for(const amplitude of [.0005,.001,.005])test(`weak cello ${frequency} at ${rate}, amplitude ${amplitude}`,()=>{
 const x=Float32Array.from({length:8192},(_,i)=>amplitude*(Math.sin(2*Math.PI*frequency*i/rate)+.6*Math.sin(4*Math.PI*frequency*i/rate)+.25*Math.sin(6*Math.PI*frequency*i/rate)));
 const got=detectPitch(x,rate);assert.ok(got);assert.ok(Math.abs(1200*Math.log2(got/frequency))<5,`${got}`);
});
test('DC input is not a pitch, and offset does not conceal weak pitch',()=>{
 assert.equal(detectPitch(new Float32Array(8192).fill(.05),48000),null);
 const x=Float32Array.from({length:8192},(_,i)=>.05+.001*Math.sin(2*Math.PI*65.406*i/48000));
 const got=detectPitch(x,48000);assert.ok(got);assert.ok(Math.abs(1200*Math.log2(got/65.406))<5);
});
test('deterministic non-periodic noise remains rejected at quiet and loud levels',()=>{
 for(const amplitude of [.0005,.005,.1])for(let seed=1;seed<=30;seed++){
  let state=seed;const x=Float32Array.from({length:8192},()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return amplitude*(state/2147483648-1);});
  assert.equal(detectPitch(x,48000),null,`noise seed ${seed}, amplitude ${amplitude}`);
 }
});
