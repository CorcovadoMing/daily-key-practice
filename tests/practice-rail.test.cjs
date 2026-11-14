const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs');
test('fixed practice rail remains content-sized with bounded scrolling',()=>{
 const html=fs.readFileSync('index.html','utf8');
 assert.match(html,/\.practice-float\{position:fixed;top:50%;/);
 assert.match(html,/\.practice-float\{bottom:auto;max-height:min\(78vh,720px,calc\(100vh - 220px\)\)\}/);
 assert.doesNotMatch(html,/\.practice-float\{bottom:100px\}/);
 assert.match(html,/overflow:auto;z-index:20/);
 assert.match(html,/rail.hidden=order.length===0/);
});
test('selection summary has labeled heading and separate grid rows',()=>{
 const html=fs.readFileSync('index.html','utf8');
 assert.match(html,/class="filter-status" role="group" aria-labelledby="filter-status-heading"/);
 assert.match(html,/id="filter-status-heading">已選取<\/h4>/);
 assert.match(html,/\.filter-status\{[^}]*display:grid;gap:6px;margin-top:26px/);
 assert.match(html,/<span>大調 <b id="major-eligible">12 \/ 12<\/b><\/span><span>古典旋律小調 <b id="minor-eligible">12 \/ 12<\/b><\/span>/);
});
