# 030 compact tuner visuals

Base: 029 combined / remote experimental d56d25c16cccd2e75395a9fc3f637a3feff8e0e2.

Neutral faint scale while idle/invalid. Valid reading lights exactly one signed segment: below -20 red; [-20,-10) yellow; [-10,+10] green; (+10,+20] yellow; above +20 red. Needle uses unrounded cents, clipped to ±50; centered integer cents uses prior rounding, with no negative zero. Invalid/off displays —, hides needle and removes all highlights immediately; smoothing reset still follows its original 500ms silence rule. Mic, detector, reference pitch, smoothing and audio gain are unchanged. Metronome controller and worklet are byte-identical to 029.

Four threshold numerals sit at actual 30/40/60/70% positions below the bar, staggered onto two tiny 8px lines to avoid overlap; current cents uses 10px. At <=360px, main play/tuner controls are 44px wide (still 44px target), note 36px and horizontal padding 8px, so the bar gains space without widening the floating strip. No second row and no extra descriptive words. Separate owner refinement: circle enharmonic bottom marker now ♯6 / ♭6, leaving major/minor buttons and labels unchanged.

Verification: 152/152 node tests; DOM wide-layout and ui-polish QA pass with /tmp/tuner-dom-test/node_modules/jsdom. Inline syntax pass. Managed Chromium preview used source-derived no-microphone fixtures. Checked 320/390px toolbar widths 296/366px; scrollWidth matched clientWidth. At320px the closest label pair had ~1.6px gap rather than overlap. Both tuner A4 and metronome settings open above toolbar and fit320px width. Browser fixtures verified each signed segment, ±75 clipped endpoints, and invalid — with no highlight/hidden needle. No microphone permission requested, no classroom join or writes. Preview stopped.

Standalone qa/tuner-startup.cjs was not run successfully: its separate Playwright executable is absent. Managed Chromium visual checks above do not replace real iPad microphone testing.
