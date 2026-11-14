# 032 local monophonic transient experiment

Base parent-supplied 031 at experimental 069fb76a81078b6a1e6d786f786039be551011d2. No publication, real microphone, cloud writes or hardware timing measurement.

Present 031 reads 8192 samples (171ms at48k /186ms at44.1k) every80ms, then a five-value log-frequency smoother, which already resets immediately above75c change. A two-frame switch on top would not cure a detector window containing two notes and would add delay. Candidate changes only analyser window to4096 (85/93ms), polling to40ms and version032. Detector, thresholds, smoothing and microphone/session code otherwise unchanged; metronome B/gain/UI unchanged. This halves smoothing time in milliseconds but not its sample count, a conscious tradeoff.

Reproduce from repo root: node qa/tuner-sequence.cjs; node qa/tuner-stability.cjs; node --test tests/*.test.cjs. Generated benchmark data in /tmp/tuner-*-results.json. Synthetic harmonic monophonic fixtures only, not actual cello recordings. Continuous phase,12ms attacks, amplitude variation, seeded quiet noise; eight-note rising/falling sequence starting at65.406,146.832,440Hz,44.1/48kHz, four polling phases. Hit means within30c at least once during each note; includes initial already-held note. Transition off-sequence means >50c from every score pitch, not every possible false-note measure. Repeated score pitches can mask wrong timing; do not equate these counts with human performance.

Per duration, out of192 note opportunities (031 -> candidate):
-100ms:24 ->84 hits. Still mostly misses; not appropriate for dependable100ms groups.
-160ms:31 ->148 hits. Still44 misses.
-250ms:132 ->192 hits; median acquired-note latency170 ->100ms,90th percentile210 ->200ms.
-500ms:192 ->192 hits; median200 ->100ms,90th percentile380 ->200ms.
Transition off-sequence counts at250ms:57/587 ->26/1146 valid frames; cadence differs so compare rates cautiously. This does not eliminate brief transitional readings.

Sustained tests:70 combinations,2s each,65–880Hz, normal/near-floor/strong harmonics/±12c5Hz vibrato/seeded noisy signal. Neither configuration blanked or jumped>50c. Maximum deviation from nominal3.94c ->6.33c (includes intended vibrato); faster response follows more vibrato, so not identical visual steadiness. Static tones at4096 within5c.300 seeded noise fixtures, silence/DC rejected. Metronome-click-only illustrative850Hz50ms decay at120BPM:2/35 old versus2/69 new frames admitted. Tonal clicks can still register; this is not polyphonic isolation. Existing output scheduler untouched; no claim about hardware CPU/load or Safari output continuity.

198 automated tests pass. Device test should compare sustained low C, gentle vibrato and250/160ms note groups, with metronome off/on. Optional candidate can be kept at031 if faster visual movement is less desirable; never claim rapid/polyphonic accuracy from these fixtures.
