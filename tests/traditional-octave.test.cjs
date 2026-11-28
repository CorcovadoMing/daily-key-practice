const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(process.env.PITCH_TEST_HTML || path.join(__dirname, '../index.html'), 'utf8');
const sandbox = { module: { exports: {} } };
vm.runInNewContext(html.split('// AUDIO_TOOLS_START')[1].split('// AUDIO_TOOLS_END')[0], sandbox);
const { detectPitch } = sandbox.module.exports;
const hz = (midi) => 442 * 2 ** ((midi - 69) / 12);
function windowOf(rate, frequency, harmonics, phase, seconds = .053) {
  return Float32Array.from({ length: Math.round(rate * seconds) }, (_, i) => {
    const angle = 2 * Math.PI * frequency * i / rate + phase;
    return .05 * harmonics.reduce((sum, [h, amp]) => sum + amp * Math.sin(h * angle + h*h*.21), 0);
  });
}
function expectPitch(pcm, rate, frequency, context) {
  const actual = detectPitch(pcm, rate, .0002);
  assert.ok(actual !== null && Math.abs(1200 * Math.log2(actual / frequency)) < 15,
    `${context}: expected ~${frequency.toFixed(2)} Hz, got ${actual}`);
}

for (const rate of [44100, 48000]) {
  test(`rich upper notes are not halved on a fractional lag grid at ${rate}`, () => {
    // Strong upper partials magnify integer-lag error, with *no* energy below
    // the intended note. Sweep small tuning offsets and window start phases.
    const rich = [[1,.65],[2,.24],[4,.38],[6,.47],[8,.32],[10,.24],[12,.16]];
    for (const midi of [52, 59]) for (const cents of [-14,-7,0,7,14]) {
      const f = hz(midi) * 2 ** (cents / 1200);
      for (const phase of [.1,1.2,2.4]) {
        expectPitch(windowOf(rate,f,rich,phase),rate,f,`MIDI ${midi}, ${cents} cents, phase ${phase}`);
      }
    }
    // A steady tone still has the same pitch in a shorter usable window.
    for (const midi of [52,59]) {
      expectPitch(windowOf(rate,hz(midi),rich,1.2,.029),rate,hz(midi),`short MIDI ${midi}`);
    }
  });

  test(`weak fundamentals remain distinct from their upper octave at ${rate}`, () => {
    for (const midi of [40,41,42]) for (const phase of [.1,1.2,2.4]) {
      for (const fundamental of [.075,.10,.18]) {
        const f = hz(midi);
        expectPitch(windowOf(rate,f,[[1,fundamental],[2,1],[4,.15]],phase),rate,f,
          `weak MIDI ${midi}, fundamental/second ${fundamental}, phase ${phase}`);
      }
      // The same even-only spectrum genuinely sounds an octave higher.
      const upper = hz(midi+12);
      expectPitch(windowOf(rate,upper,[[1,1],[2,.15]],phase),rate,upper,`genuine MIDI ${midi+12}`);
    }
  });

  test(`quiet, DC, seeded noise and a single transient stay null at ${rate}`, () => {
    let seed = 0x4c4f5745;
    const length = Math.round(rate * .053);
    const noise = Float32Array.from({length}, () => {
      seed = (Math.imul(seed, 1664525) + 0x3c6ef35f) >>> 0;
      return (seed / 2**31 - 1) * .06;
    });
    const click = new Float32Array(length); click[Math.floor(length/2)] = .3;
    const quiet = windowOf(rate,hz(52),[[1,.001]],0);
    for (const signal of [new Float32Array(length), new Float32Array(length).fill(.02), quiet, noise, click]) {
      assert.equal(detectPitch(signal,rate,.0002),null);
    }
  });
}
