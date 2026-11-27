const test=require('node:test'),assert=require('node:assert/strict');
const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
test('both setup disclosures share stable accessible type without page-wide text adjustment',()=>{
  assert.match(html,/\.session-launch>\.launch-settings\{-webkit-text-size-adjust:100%;text-size-adjust:100%\}/);
  assert.match(html,/\.session-launch>\.launch-settings>summary\{\s*width:100%;font-size:var\(--ui-detail,\.875rem\);line-height:1\.35;padding-block:12px 8px\s*\}/);
  assert.match(html,/<summary id="mode-settings-toggle"><span class="launch-summary-title">練習設定<\/span>/);
  assert.match(html,/<summary id="launch-settings-toggle"><span class="launch-summary-title">調性設定<\/span>/);
  assert.match(html,/<meta name="viewport" content="width=device-width, initial-scale=1">/);
});
test('the draw settings pool uses wider buttons and retains the 12 paired circle positions',()=>{
  assert.match(html,/\.launch-settings \.fifths-circle\{max-width:min\(100%,370px\);aspect-ratio:4\/5;/);
  assert.match(html,/\.launch-settings \.fifths-pair\{width:19%;max-width:66px;/);
  assert.match(html,/const signatures=\[0,1,2,3,4,5,6,-5,-4,-3,-2,-1\]/);
  assert.match(html,/for\(const mode of \['major','minor'\]\)/);
  assert.match(html,/button\.setAttribute\('aria-label',key\[0\]/);
});
