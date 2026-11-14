const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const html = fs.readFileSync('index.html', 'utf8');
test('metronome volume defaults to 100 percent and remains user adjustable', () => {
 const slider = html.match(/<input\b[^>]*\bid="metro-volume"[^>]*>/)[0];
 assert.match(slider, /type="range"/);
 assert.match(slider, /min="0"/);
 assert.match(slider, /max="100"/);
 assert.match(slider, /value="100"/);
 assert.match(html, /Number\(\$\('metro-volume'\)\.value\)/);
});
