const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class Node {
  constructor() { this.attrs = {}; this.children = []; }
  append(...nodes) { this.children.push(...nodes); }
  setAttribute(key, value) { this.attrs[key] = value; }
}
const ctx = {
  window: {},
  document: { createElement: () => new Node(), createElementNS: () => new Node() }
};
const file = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
vm.runInNewContext(file('fingerboard.js'), ctx);
const { makeScore } = ctx.window.CelloFingerboard;
const html = file('index.html');
const byClass = (node, cls) => node.children.filter(el => el.attrs.class === cls);

test('both visible portions span a note’s own share of the beams across all 24 scale keys', () => {
  for (const [mode, name] of [['major', 'MAJOR_KEYS'], ['minor', 'MINOR_KEYS']]) {
    const keys = vm.runInNewContext(html.match(new RegExp('const ' + name + ' = (\\[[\\s\\S]*?\\n    \\]);'))[1]);
    for (const key of keys) {
      const [svg] = makeScore(mode, key).children;
      const beams = byClass(svg, 'scale-beam');
      const notes = svg.children.filter(n => 'data-midi' in n.attrs);
      const stems = notes.map(n => +byClass(n, 'scale-stem')[0].attrs.x1);
      for (let i = 0; i < notes.length - 1; i++) {
        const locals = byClass(notes[i], 'scale-beam-local');
        assert.equal(locals.length, 2);
        for (const [rail, local] of locals.entries()) {
          const base = beams[2 * Math.floor(i / 4) + rail].attrs;
          const { x1, x2, y1, y2, stroke } = local.attrs;
          assert.equal(+x1, i % 4 === 0 ? +base.x1 : (stems[i-1] + stems[i]) / 2);
          assert.equal(+x2, i % 4 === 3 ? +base.x2 : (stems[i] + stems[i+1]) / 2);
          assert.equal(x2 - x1, i % 4 === 0 || i % 4 === 3 ? 14.5 : 29);
          const yAt = x => +base.y1 + (base.y2 - base.y1) * (x - base.x1) / (base.x2 - base.x1);
          assert.ok(Math.abs(y1 - yAt(x1)) < 1e-9 && Math.abs(y2 - yAt(x2)) < 1e-9);
          assert.equal(stroke, 'none');
        }
      }
      assert.equal(byClass(notes.at(-1), 'scale-beam-local').length, 0);
      const [arpeggio] = makeScore(mode, key, true).children;
      assert.equal(byClass(arpeggio, 'scale-beam').length, 0);
      assert.ok(arpeggio.children.every(n => !byClass(n, 'scale-beam-local').length));
    }
  }
});
