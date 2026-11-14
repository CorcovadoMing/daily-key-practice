# 040 small motion polish
Base039-final. No deployment.
- Cumulative heading shortened to 累積練習, no data/count changes.
- Former200ms fast-start easing changed to distance-scaled280–460ms cubic-bezier(.25,.1,.25,1). Mid-flight reversal starts at rendered height/opacity as before and short travel finishes sooner.
- Panel overflow-anchor:none prevents browser anchoring to moving score/board descendants.
- Keeps existing hidden/inert/focus safeguards, stale-finish identity guard, initial instant render, reduced-motion instant branch, and auto natural height after animation.
- 237 unit tests pass; wide-layout/ui-polish DOM suites pass.
- Managed Chrome390 iframe: rapid Enter reversals settle open; collapse measured mid-height2272.84 then0, hidden/inert true. Header viewport top stayed345.14 before/during/after collapse. Open + switch scale to1octave retains13 arpeggio quarter notes, no inline fixed height, document375/scroll375. Screenshot inspected.
- Reduced-motion and stale callbacks verified in unit tests, not OS setting changed. Physical iPad not tested.
Preview stopped.
