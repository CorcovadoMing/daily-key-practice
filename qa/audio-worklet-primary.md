# AudioWorklet primary (028 audio patch)

The owner tested published 027 on iPad, reported B more stable, and requested B only. This narrow patch removes the A/B selector and starts AudioWorklet directly. The synthesis processor, gain, volume and microphone/tuner path are unchanged.

Compatibility recovery remains internal. If AudioWorklet is unsupported or its startup fails, clean up any node and use the original scheduler with the explicit status “AudioWorklet 無法使用，目前使用相容節拍模式。” This choice lasts only for this page session and is not persisted. Reload tries AudioWorklet again. If a running processor fails, disconnect/stop it and require another explicit Start before using the compatibility scheduler; the message says so. An ordinary stop/restart after fallback keeps the honest compatibility status. A successful AudioWorklet session has no engine-selection UI.

Automated verification: 130/130 tests passed, including default-worklet start/stop/restart, missing API and failed module fallback, canceled pending module loading, processor-error cleanup and explicit restart into the sole fallback scheduler, plus existing gain/DSP regression tests. Tests mock the controller and simulate DSP; they are not browser/iPad integration tests. Parent/UI agent will verify merged 028 controls in browser. No publication performed by this patch task.
