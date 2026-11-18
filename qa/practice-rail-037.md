# 037 sidebar and selected-summary QA
Base /tmp/dkp-036-final. Local only, not published.

Cause reproduced in Chromium at 1180x820 iframe:
036 rail four items: overall310px, list147px. CSS position fixed + top50% + bottom100px and auto height stretched beyond content. Not an iOS-specific conclusion.
037 four items: overall197px, same list147px.

Fix:
- bottom:auto, keep top50% centered placement.
- max-height:min(78vh,720px,calc(100vh - 220px)) retains scrolling and at least110px bottom clearance on normal viewports.
- No render/count/data/empty-state logic changes.
- Selection summary now labeled group headed 已選取, separate grid rows for existing major/minor counts, 26px circle spacing.

Managed Chrome UI checks:
1180x820 iframe, through actual selection/draw controls:
- 1 item height83px, client81/scroll81.
- 3 items height159px, client157/scroll157.
- 12 items height501px, client499/scroll499, bottom660.5px.
- 24 items capped600px, client598/scroll955, top110/bottom710; keyboard last-item navigation scrolled rail to357px.
- 320 iframe document305px/scroll305px; selection summary 26px gap, all three rows separate.
- 390 iframe document375px/scroll375px; selection summary 26px gap, all three rows separate. Screenshot inspected.
- 233 node tests pass; wide-layout and ui-polish DOM suites pass.
Preview stopped. Physical iPad Safari not tested.
