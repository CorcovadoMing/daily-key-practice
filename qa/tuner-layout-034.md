# 034 combined visual candidate, not published

Includes unreleased033 animation/3px contrast needle plus034: cents normal400 weight/light #84917e (note retains800), meter/needle height20px (was10), shared4px inline inset inside meter wrapper, signed tick labels all one baseline. Tick cells fixed24px centered at30/40/60/70%; compact7px font with -.45px tracking prevents actual glyph overlap at320. Previous two-row offsets removed. No audio/detection/session or toolbar-width logic changes.

203 tests and both DOM suites pass. Real Chromium local no-mic fixture320/390:
- toolbar296x78 /366x78px; scrollWidth=clientWidth294/364, no growth/overflow.
- meter112x20 at x181 /142x20 at x217.
- all four text glyph top672,bottom681 (same baseline); ±10 cell centers225.796875/248.1875 at320,273.796875/302.1875 at390, within0.013px expected40/60% boundaries from browser subpixel rounding.
- minus label glyph10.75px; plus10.671875px. Closest320 adjacent glyph gap0.453125px, no overlap;390 gap3.453125px.
- tuner settings106.125x70 atx13,y537;metro230x339 atx13,y268, both above toolbar and within320 viewport.
- toolbar bottom692 in700px fixture leaves8px; existing max(8px,env(safe-area-inset-bottom)) and body safe-area padding retained. Actual notched-device safe-area not emulated; real iOS visual check remains.

Screenshots inspected. No mic/cloud writes; preview stopped. Source-derived fixture injects synthetic C♯4/-15 outside candidate. Changes vs032: index.html,tests/tuner-visual.test.cjs,qa/tuner-animation-033.md,qa/tuner-layout-034.md. Prior033 note documents interim10px geometry, this note supersedes that geometry only.
