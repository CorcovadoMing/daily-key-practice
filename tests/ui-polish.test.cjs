const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');
test('tuner keeps accessible status and details without visible text chrome',()=>{
 assert.match(html,/id="tuner-cents" class="audio-cents sr-only"/);
 assert.match(html,/id="tuner-status" class="audio-status sr-only" role="status"/);
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
