# 031 modest mobile tuner input floor

Base: parent-supplied exact 030 `/tmp/dkp-030-final`, experimental commit `968c11e0ec6ac4d8dd2fd884b93ac77a8892deda`. Local candidate only; no publication or microphone/cloud writes.

Latest owner correction includes Android as well as iOS/iPadOS. Detection input gate decreases from RMS 0.0003 to 0.0002 only on Android UA, iPhone/iPad/iPod UA, or iPad desktop UA (Macintosh + MacIntel + maxTouchPoints > 1). Desktop Mac, Windows, unknown device remain 0.0003. This is a 3.52 dB lower admission floor, not amplified microphone or output volume. It admits quieter periodic signals but does not promise a particular distance improvement. UA identification is heuristic; unusual spoofed UAs can be misclassified.

Prior safeguards retained: DC removal before energy gate, YIN 0.15 periodicity criterion, frequency range/interpolation, five-reading log-frequency smoothing, signal-loss reset timing, audio session/constraints, metronome B and volumes. Existing weak-cello/DC/noise tests retained. No UI change except release identifier. Hidden diagnostics use the same selected threshold as detection.

Verification: 168/168 node tests pass; DOM ui-polish and wide-layout suites pass; inline JavaScript syntax passes. Twelve synthetic harmonic tones (65.406,98,146.832,220,440,880 Hz at 44.1/48kHz, fundamental amplitude 0.0003) have raw RMS 0.0002515–0.0002546: previously all rejected, mobile now all accepted, absolute pitch error at most 1.102 cents. Desktop still rejects them. Raw measurement file rows: sample rate, input frequency, raw RMS, prior result, mobile result, cents error. Admission gate actually uses downsampled mean-removed RMS as before.

300 deterministic noise fixtures (30 seeds × 5 amplitudes × 2 sample rates) all rejected at the mobile threshold, plus silence/DC/below-floor tonal fixtures. These are synthetic checks, not a guarantee against tonal room noise; real ambient periodic tones can be detected by any tuner. Real iPad Safari/Android microphone and quiet-room/cello tests remain required. No browser or real-device microphone session run for this release; visible layout and audio routing are unchanged.
