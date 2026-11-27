const test=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');
const css=html.match(/<style>([\s\S]*?)<\/style>/)[1];
test('dark dock softens only decorative borders while maintaining active and focus feedback',()=>{
 a.match(css,/\[data-appearance=dark\] \.audio-tools,\s*\[data-appearance=dark\] \.audio-tools \.tuner-preferences\{border-color:#3c4652\}/);
 a.match(css,/\[data-appearance=dark\] \.audio-tools :is\(button:not\(\[aria-pressed=true\]\):not\(\[aria-expanded=true\]\),input:not\(\[type=range\]\),select\)\{border-color:#525f6e\}/);
 a.match(css,/\.audio-tools\{[^{}]*border:1px solid #ccd8c9/);
 a.match(css,/\.audio-tools button\[aria-pressed=true\][^{}]*\{[^{}]*background:#445970[^{}]*border-color:#7d93ad/);
 a.match(css,/\[data-appearance=dark\][^{}]*:focus-visible\{outline-color:#a0d3f6\}/);
 a.match(css,/\.audio-meter:before\{[^{}]*border-left:1px solid #9ca995/);
});
test('dark completion row is transparent and retains visible progress text',()=>{
 a.match(css,/\[data-appearance=dark\] \.result-panel \.result-summary\{background:transparent\}/);
 a.match(css,/\[data-appearance=dark\] \.result-summary \.summary-top\{color:var\(--ink\)\}/);
 a.match(html,/<div class="summary-top"><span>練習完成進度<\/span><strong id="progress-text">0／4/);
});
test('dark tuner states and A4/settings read as foreground, not inherited light-only dark green',()=>{
 const html=fs.readFileSync('index.html','utf8');
a.match(html,/\[data-appearance=dark\] \.audio-tools\{color:var\(--ink\)/);
a.match(html,/#tuner-note,#tuner-a\)\{color:#eef1f5/);
a.match(html,/\.audio-scale,\.a4-control span,\.tuner-readout #tuner-cents\)\{color:#b9c3cf/);
});

test('dark classroom row removes only the shared backdrop, not buttons or join dialog',()=>{
 a.match(html,/\[data-appearance=dark\] #classroom-settings\.classroom-bar\{background:transparent\}/);
 a.match(html,/<section class="classroom-bar" id="classroom-settings"/);
 a.match(html,/\.room-join-dialog\{[^{}]*background:var\(--paper\)/);
});
