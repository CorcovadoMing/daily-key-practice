// Experimental B engine. No microphone input; timing and synthesis stay on the audio thread.
class PracticeMetronome extends AudioWorkletProcessor {
  constructor() {
    super(); this.running = false; this.beat = 0; this.clickStart = -Infinity;
    this.settings = { bpm: 80, count: 4, accent: 1, volume: 100 };
    this.port.onmessage = ({ data }) => {
      if (data.type === 'stop') { this.running = false; this.clickStart = -Infinity; }
      if (data.type === 'configure' || data.type === 'start') {
        Object.assign(this.settings, data.settings);
        if (data.resetBeat) this.beat = 0;
      }
      if (data.type === 'start') {
        this.running = true; this.beat = 0; this.next = currentTime + 0.05; this.clickStart = -Infinity;
      }
    };
  }
  process(inputs, outputs) {
    const channels = outputs[0];
    if (!channels?.length) return true;
    for (let i = 0; i < channels[0].length; i++) {
      const now = currentTime + i / sampleRate;
      if (this.running && now >= this.next) {
        // Do not replay missed beats after a suspended render context.
        this.clickStart = now; this.frequency = this.beat + 1 === this.settings.accent ? 1200 : 850;
        this.peak = this.settings.volume / 100 * 0.65;
        this.port.postMessage({ beat: this.beat + 1, count: this.settings.count });
        this.beat = (this.beat + 1) % this.settings.count;
        this.next = now + 60 / this.settings.bpm;
      }
      const age = now - this.clickStart;
      let value = 0;
      if (this.running && this.peak > 0 && age >= 0 && age < 0.05) {
        const gain = age < 0.002 ? this.peak * age / 0.002 : age < 0.045 ? this.peak * Math.pow(0.001 / this.peak, (age - 0.002) / 0.043) : 0.001;
        value = Math.sin(2 * Math.PI * this.frequency * age) * gain;
      }
      for (const channel of channels) channel[i] = value;
    }
    return true;
  }
}
registerProcessor('practice-metronome', PracticeMetronome);
