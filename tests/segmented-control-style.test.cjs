const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');
test('the native radio fallback and sliding thumb share concentric track radii',()=>{
 assert.match(html,/--segment-inner-radius:calc\(var\(--segment-radius\) - var\(--segment-inset\) - var\(--segment-border\)\)/);
 assert.match(html,/\.launch-mode\{[^}]*border-radius:var\(--segment-radius\)/);
 assert.match(html,/\.launch-mode span\{[^}]*border-radius:var\(--segment-inner-radius\)/);
 assert.match(html,/\.launch-mode:has\(>label>input:checked\)::before\{[^}]*border-radius:var\(--segment-inner-radius\)/);
 assert.match(html,/\.launch-mode input:focus-visible\+span/);
});
test('the scale and arpeggio split renders action and arrow with shared phase paint',()=>{
 assert.match(html,/>:is\(\.scale-practice-button,\.scale-start-chevron\):is\(:hover,\[aria-pressed=true\]\)\{\s*background:var\(--start-fill\);color:var\(--start-ink\);border-color:var\(--start-edge\)/);
 assert.match(html,/\.scale-practice:not\(\[data-phase=idle\]\) \.scale-start-shell\{[^}]*--start-fill:var\(--ui-selected\)/);
 assert.match(html,/action\.append\(demoShell,startShell,demoSettings,startSettings\)/);
 assert.match(html,/demoButton\.disabled=demoChevron\.disabled=startChevron\.disabled=next!=='idle'/);
});

test('key identity uses blue/purple tones while completion check separate and only key cards keep the stripe',()=>{
 assert.match(html,/\[data-key-mode=major\]\{--key-tone:var\(--tonality-major\)/);
 assert.match(html,/\[data-key-mode=minor\]\{--key-tone:var\(--tonality-minor\)/);
 assert.match(html,/\.history-chip-done,.practice-jump.is-done \.quick-check\)\{color:var\(--completion-green/);
 assert.doesNotMatch(html,/\.history-chip\[data-key-mode\]\{box-shadow/);
 assert.match(html,/\.key-card\[data-key-mode\]>\.key-card-heading\{\s*box-shadow:inset 6px/);
});

test('audio dock hover is not mistaken for the semantic active signal',()=>{
 assert.doesNotMatch(html,/\.audio-tool-pair :is\(button,#metro-settings,#tuner-settings\):hover/);
 assert.doesNotMatch(html,/#metro-settings:hover|#tuner-settings:hover|:is\(#metro-settings,#tuner-settings\):hover/);
 assert.match(html,/\.audio-tool-pair :is\(#metronome-open,#tuner-open\)\[aria-pressed=true\]\{\s*background:var\(--ui-selected\)/);
 assert.match(html,/\:is\(\.session-launch,\.scale-practice,\.audio-tools,\.classroom-bar,dialog\) :is\(button,a,summary,input\):focus-visible/);
});

test('native modal chrome and primary actions share theme tokens without resetting layout',()=>{
 assert.match(html,/dialog:is\(\.room-join-dialog,\.history-choice-dialog,\.student-note-dialog,\.finger-dialog,\.cello-leave-dialog\)\{\s*box-sizing:border-box;border:1px solid var\(--line\);border-radius:20px;box-shadow:var\(--ui-modal-shadow\)/);
 assert.match(html,/:root dialog :is\(\.room-action\.primary,\.primary,\.save-btn,\.cello-leave-save\),/);
 assert.match(html,/--ui-modal-limit:85dvh/);
});
