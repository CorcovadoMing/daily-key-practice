# 035 arpeggio candidate
Base: /tmp/dkp-034-final; local only, not published.

- Adds arpeggio section after scale staff and fingerboard within existing key card.
- Sequence selects existing scale pitches/spelling: ascending indices 0,2,4,7,9,11,14; descending 0,3,5,7,10,12,14 with shared highest tonic omitted from score's second half.
- C major exactly C E G C E G C G E C G E C. Minor third remains minor.
- Read-only two-octave projection uses each direction's confirmed map plus full-scale presets. No new persistence, picker, cloud writes or editable state. Existing scale octave toggle/layout preserved.
- Arpeggio has two directional boards even for major, to preserve direction-specific source mappings; scale major still one half-width board.
- Existing score rhythm retained: sixteenths in groups of four, final quarter, no asserted meter.

Validation:
- node --test tests/*.test.cjs: 227 passed.
- JSDOM_MODULE=/tmp/tuner-dom-test/node_modules/jsdom node qa/arpeggio.cjs: all 24 modes, custom update projection, fixed octave, exact C sequence.
- qa/wide-layout.cjs and qa/ui-polish.cjs passed.
- Managed Chromium desktop: arpeggio score13 notes, directional boards each456px and identical y. Mobile390 iframe: document client375/scroll375, score client282/scroll960; keyboard ArrowRight settled scrollLeft40; boards297px stacked.
- Preview stopped. No iPad/Safari physical-device claim.
