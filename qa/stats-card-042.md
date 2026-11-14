# 042 standalone cumulative practice card

Base: /tmp/dkp-041-label (published e7b365b640393a8bd09c7093fdbe5d883f68b123).
Production changed file: index.html only. Version 042. Classroom and cumulative practice are sibling cards in a content-height setup-sidebar; settings remains next grid column. Stats JS, local storage, note behavior, IDs, counts unchanged.

Validation:
- node --test tests/*.test.cjs: 237 passing.
- qa/stats-card.cjs: sibling structure, accessible heading/IDs preserved.
- qa/wide-layout.cjs, qa/practice-stats.cjs, qa/ui-polish.cjs: pass.
- Managed browser desktop: classroom x24/y255.08/w271.08/h271; stats x24/y542.08/w271.08/h172.5. Gap16, wrapper459.5 equals two heights +16; no stretch.
- 390px mobile fixture: classroom w349/h253/y71.97; stats w349/h159.5/y340.97; gap16. Document375/375, no horizontal overflow. Visible standalone rounded white stats card below classroom, above settings; existing C major count1 preserved.
- No classroom join, microphone, Firebase writes, deployment or push. Managed preview stopped after QA.
