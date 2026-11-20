const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const moduleCode = name => html.split('// ' + name + '_START')[1].split('// ' + name + '_END')[0];
const audio = { module: { exports: {} } };
vm.runInNewContext(moduleCode('AUDIO_TOOLS'), audio);
const { pitchReading } = audio.module.exports;

class Node {
  constructor() {
    this.children = []; this.dataset = {}; this.attributes = {}; this.variables = {};
    this.style = { setProperty: (key, value) => { this.variables[key] = value; } };
    this._text = '';
  }
  get textContent() { return this._text; }
  set textContent(value) { this._text = value; this.children = []; }
  append(...children) { this.children.push(...children); }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener() {}
  find(className) {
    if (this.className === className) return this;
    return this.children.map(child => child.find(className)).find(Boolean);
  }
}
const source = { module: { exports: {} }, document: { createElement: () => new Node() },
  localStorage: { getItem: () => 'loop' } };
vm.runInNewContext(moduleCode('SCALE_PRACTICE'), source);
const { card, manager } = source.module.exports;
const target = [36,38,40,41,43,45,47,48,47,45,43,41,40,38,36].map(midi =>
  ({ midi, name: String(midi), octave: Math.floor(midi / 12) - 1 }));
const slots = { up: 3, down: 11, wrongOctave: 5 };

async function fixture(sequence=target) {
  let now = 0, listener;
  const heads = sequence.map(() => new Node());
  const view = card({ querySelectorAll: () => heads }, sequence, () => {});
  const states = [];
  const render = view.update.bind(view);
  view.update = (...state) => { states.push(state); return render(...state); };
  const m = manager({ performance: { now: () => now } }, {
    capture: { subscribe: hooks => { listener = hooks; return () => {}; } },
    reference: () => 442, pitchReading, pitchName: String
  });
  assert.equal(view.mode, 'loop');
  await m.toggle(view);
  listener.ready();
  const play = (midi, cents = 0) => {
    const frequency = midi == null ? 0 : 442 * 2 ** ((midi - 69 + cents / 100) / 12);
    for (let i = 0; i < 6; i++) { now += 27; listener.frame({ now, frequency }); }
  };
  const last = () => states.at(-1);
  const historyPoints = slot => {
    const column = view.element.find('scale-pitch-columns');
    assert.ok(column, 'actual chart must be mounted');
    const all = column.children;
    return all[slot].find('scale-pitch-history').children;
  };
  return { play, last, historyPoints, stop: () => m.toggle(view), heads };
}
const entries = bin => Array.from(bin.entries(), pair => Array.from(pair));

test('loop chart keeps signed detuned readings by printed slot without awarding score credit', async () => {
  const f = await fixture();
  for (const [i, note] of target.entries()) {
    f.play(i === slots.wrongOctave ? note.midi + 12 : note.midi,
      i === slots.up ? 45 : i === slots.down ? -45 : 0);
    if (i === slots.up) {
      assert.equal(f.last()[3], slots.up, 'outside ±40 does not advance strict progress');
      assert.equal(f.last()[5].live.slot, slots.up, 'the live ring still belongs to the intended note');
      assert.notEqual(f.heads[slots.up].dataset.practice, 'matched');
    }
  }
  const [, , , , , d] = f.last();
  assert.equal(d.laps, 1);
  assert.equal(d.passed, 0);
  assert.deepEqual(entries(d.history[slots.up]), [[45, 1]]);
  assert.deepEqual(entries(d.history[slots.down]), [[-45, 1]]);
  assert.deepEqual(entries(d.history[slots.wrongOctave]), []);
  assert.equal(f.historyPoints(slots.up)[0].variables['--pitch-y'], '5%');
  assert.equal(f.historyPoints(slots.down)[0].variables['--pitch-y'], '95%');
  assert.equal(f.historyPoints(slots.wrongOctave).length, 0);
  await f.stop();
  const [phase, , scored, , , final] = f.last();
  assert.equal(phase, 'idle');
  assert.equal(scored, null, 'the shared finish tonic is not a new partial lap');
  assert.equal(final.passed, 0);
  for (const i of Object.values(slots)) assert.equal(final.values[i], null);
  assert.equal(Math.round(final.chartValues[slots.up]), 45);
  assert.equal(Math.round(final.chartValues[slots.down]), -45);
  assert.equal(final.chartValues[slots.wrongOctave], null);
});

test('same-slot accepted correction takes priority over an earlier detuned reading', async () => {
  const f = await fixture();
  target.forEach(({ midi }, i) => {
    if (i === slots.up) f.play(midi, 45);
    f.play(midi, i === slots.up ? 6 : 0);
  });
  const [, , , , , d] = f.last();
  assert.equal(d.laps, 1);
  assert.equal(d.passed, 1);
  assert.deepEqual(entries(d.history[slots.up]), [[6, 1]]);
});

test('two stable but conflicting readings for one skipped slot remain ambiguous and blank', async () => {
  const f = await fixture();
  target.forEach(({ midi }, i) => {
    if (i === slots.up) {
      f.play(midi, 45);
      f.play(null);
      f.play(midi, -45);
    } else f.play(midi, 0);
  });
  const d = f.last()[5];
  assert.equal(d.laps, 1);
  assert.equal(d.passed, 0);
  assert.deepEqual(entries(d.history[slots.up]), []);
  assert.equal(f.historyPoints(slots.up).length, 0);
});

test('two full F major laps retain repeated flat-note deviations at their exact score positions', async () => {
  const rising = [41,43,45,46,48,50,52,53,55,57,58,60,62,64,65];
  const sequence = [...rising,...rising.slice(0,-1).reverse()].map(midi =>
    ({midi,name:String(midi),octave:Math.floor(midi/12)-1}));
  assert.equal(sequence.length,29);
  const f = await fixture(sequence);
  for (let lap=0;lap<2;lap++) {
    sequence.slice(lap===0 ? 0 : 1).forEach(({midi},offset)=>{
      const i=offset+(lap ? 1 : 0);
      f.play(midi,i===3 ? 45 : i===25 ? 35 : 0);
    });
  }
  const d=f.last()[5];
  assert.equal(d.laps,2);
  assert.equal(d.passed,0);
  assert.deepEqual(entries(d.history[3]),[[45,2]]);
  assert.deepEqual(entries(d.history[25]),[[35,2]]);
  assert.equal(f.historyPoints(3)[0].title,'+45¢ · 2 輪');
  await f.stop();
  assert.equal(f.last()[5].values[3],null);
  assert.notEqual(f.heads[3].dataset.practice,'matched');
  assert.equal(Math.round(f.last()[5].chartValues[3]),45);
  assert.equal(f.heads[25].dataset.practice,'matched');
});
