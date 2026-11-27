const test=require('node:test'),assert=require('node:assert/strict');
const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
test('both setup disclosures share stable accessible type without page-wide text adjustment',()=>{
  assert.match(html,/\.session-launch>\.launch-settings\{-webkit-text-size-adjust:100%;text-size-adjust:100%\}/);
  assert.match(html,/\.session-launch>\.launch-settings>summary\{\s*width:100%;font-size:var\(--ui-detail,\.875rem\);line-height:1\.35;padding-block:12px 8px\s*\}/);
  assert.match(html,/<summary id="mode-settings-toggle"><span class="launch-summary-title">練習設定<\/span>/);
  assert.match(html,/<summary id="launch-settings-toggle"><span class="launch-summary-title">調性設定<\/span>/);
  assert.match(html,/<meta name="viewport" content="width=device-width, initial-scale=1">/);
});
test('the draw settings retain accessible clockwise pairs inside an inset circle',()=>{
  assert.match(html,/\.fifths-circle\{[\s\S]*?--fifths-inset-x:clamp/);
  assert.match(html,/\.fifths-circle::before\{[^}]*border-radius:50%/);
  assert.match(html,/\.fifths-pair\{position:absolute;left:calc\(var\(--fifths-inset-x\)/);
  assert.match(html,/\.fifths-pair \.filter-key\{[^}]*min-height:30px/);
  assert.doesNotMatch(html,/fifths-grid/);
  assert.match(html,/marker\.className='fifths-signature'/);
  assert.match(html,/marker\.setAttribute\('aria-hidden','true'\)/);
  assert.match(html,/mode==='minor'&&sig===6\?-6:sig/);
  assert.match(html,/const signatures=\[0,1,2,3,4,5,6,-5,-4,-3,-2,-1\]/);
  assert.match(html,/for\(const mode of \['major','minor'\]\)/);
  assert.match(html,/button\.setAttribute\('aria-label',key\[0\]/);
});
