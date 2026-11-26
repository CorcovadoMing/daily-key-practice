const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');
test('tuner keeps diagnostics out of its layout and sends actionable errors to the toast',()=>{
 assert.match(html,/id="tuner-cents" class="audio-cents"/);
 assert.doesNotMatch(html,/id="tuner-status"/);
 assert.match(html,/function tunerNotice\(message\)/);
 assert.match(html,/id="toast" role="status"/);
 assert.ok(!html.includes('tuner-settings-close'));
 assert.ok(html.includes("$('tuner-preferences').addEventListener('keydown'"));
});
test('title and completion use distinct native button actions',()=>{
 assert.ok(html.includes("complete.addEventListener('click',()=>requestCardAction(()=>toggleComplete(id)))"));
 assert.ok(html.includes("title.addEventListener('click',()=>requestCardAction(()=>toggleCardExpansion(id)))"));
 assert.ok(html.includes("item.title.setAttribute('aria-expanded',String(opened))"));
 assert.ok(html.includes("item.button.setAttribute('aria-pressed',String(finished))"));
 assert.ok(!html.includes("main.addEventListener('click'"));
});
test('volume follows speed slider and spans identical grid edges',()=>{
 const speed=html.match(/<input id="metro-slider"[^>]+>/)[0],volume=html.match(/<input id="metro-volume"[^>]+>/)[0];
 assert.ok(html.indexOf(speed)<html.indexOf(volume));
 assert.ok(html.indexOf(volume)<html.indexOf('<label for="metro-beats">'));
 for(const slider of [speed,volume])assert.ok(slider.includes('grid-column:1 / -1;width:100%'));
});
test('UI icons are inline, rounded and native selects are retained',()=>{
 assert.ok(html.includes('stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"'));
 assert.ok(html.includes('<select id="metro-beats">'));
 assert.ok(!html.includes("expand.textContent='⌄'"));
 assert.match(html,/#metro-settings,#tuner-settings\{[^}]*border:1px solid #acb9a7/);
});

test('practice completion circles remain hollow and use accessible contrasting state colors',()=>{
 assert.match(html,/\.check-circle,\.practice-jump \.quick-check\{[^}]*background:transparent/);
 assert.match(html,/\.key-complete\[aria-pressed=true\] \.check-circle,\.practice-jump\.is-done \.quick-check\{[^}]*color:var\(--completion-green/);
 assert.match(html,/mark\.textContent=done\.has\(id\)\?'✓':''/);
 assert.doesNotMatch(html,/\.check-circle,\.progress-fill/);
 const lum=hex=>{
  const [r,g,b]=hex.match(/../g).map(s=>parseInt(s,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  return .2126*r+.7152*g+.0722*b;
 };
 for(const [ink,paper,threshold] of [
  ['a8b7c5','21252b',3],['93dca8','292e36',4.5],['66796a','fffef9',3],['247447','f5f8f2',4.5],
  ['eef1f5','21252b',4.5],['b9c3cf','292e36',4.5]
 ]){
  const values=[lum(ink)+.05,lum(paper)+.05];
  assert.ok(Math.max(...values)/Math.min(...values)>=threshold,ink+' against '+paper);
 }
});

test('metronome and tuner stay in a nonwrapping dock; its tuner readout is out of flow',()=>{
  assert.match(html,/\.audio-buttons\{flex-wrap:nowrap;width:max-content;max-width:100%;min-width:0;overflow-x:auto/);
  assert.match(html,/\.audio-tool-pair\{flex:none\}/);
  assert.match(html,/\.audio-tools\{[^}]*width:max-content/);
  assert.match(html,/#tuner-panel\{\s*position:absolute;inset:auto auto/);
});
