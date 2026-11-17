// All sound is synthesised with WebAudio: no audio files, nothing to load. The context
// is created lazily on the first user gesture (browsers refuse sound before one), and
// every effect is a few oscillators and noise bursts shaped by gain envelopes. A tiny
// sequencer loops a bass line and a sparse arpeggio under the action; M mutes all of it.

export class Sound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this._musicTimer = null;
    this._step = 0;
  }

  /** Call from a click or key press. Safe to call again and again. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);
    this._startMusic();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  _tone(freq, freqEnd, dur, type, vol, when = 0) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  _noise(dur, vol, freq, when = 0) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t0);
  }

  shoot() { this._tone(880, 220, 0.09, 'square', 0.05); }
  enemyHit() { this._tone(300, 180, 0.05, 'triangle', 0.06); }
  explosion(big = false) {
    this._noise(big ? 0.5 : 0.25, big ? 0.5 : 0.28, big ? 900 : 1400);
    this._tone(big ? 160 : 220, 40, big ? 0.45 : 0.22, 'sine', 0.4);
  }
  playerHurt() {
    this._tone(200, 60, 0.3, 'sawtooth', 0.35);
    this._noise(0.2, 0.25, 800);
  }
  dash() { this._noise(0.16, 0.16, 2600); this._tone(300, 900, 0.14, 'sine', 0.08); }
  lancerWarn() { this._tone(520, 1180, 0.32, 'sawtooth', 0.07); }
  lancerCharge() { this._noise(0.3, 0.2, 3200); this._tone(1180, 240, 0.28, 'sawtooth', 0.1); }
  pickup() { this._tone(660, 990, 0.09, 'sine', 0.16); this._tone(990, 1320, 0.1, 'sine', 0.12, 0.06); }
  powerup() { [523, 659, 784, 1046].forEach((f, i) => this._tone(f, f, 0.12, 'triangle', 0.14, i * 0.07)); }
  waveClear() { [392, 523, 659].forEach((f, i) => this._tone(f, f, 0.16, 'triangle', 0.13, i * 0.09)); }
  bossAlarm() { [0, 0.22, 0.44].forEach((w) => this._tone(146, 146, 0.18, 'square', 0.16, w)); }
  gameOver() { [440, 349, 262, 196].forEach((f, i) => this._tone(f, f * 0.97, 0.3, 'triangle', 0.16, i * 0.22)); }

  _startMusic() {
    // A minor-key pulse: bass on the beat, a quiet arpeggio above it. 132 BPM, 16 steps.
    const bass = [55, 0, 55, 0, 65.4, 0, 55, 0, 49, 0, 49, 0, 73.4, 0, 82.4, 0];
    const arp = [220, 0, 261.6, 329.6, 0, 261.6, 220, 0, 196, 0, 246.9, 293.7, 0, 246.9, 196, 0];
    const stepDur = 60 / 132 / 2;
    this._musicTimer = setInterval(() => {
      if (!this.ctx || this.muted) return;
      const i = this._step % 16;
      if (bass[i]) this._tone(bass[i], bass[i], stepDur * 1.8, 'triangle', 0.20);
      if (arp[i]) this._tone(arp[i], arp[i], stepDur * 1.4, 'sine', 0.045);
      this._step++;
    }, stepDur * 1000);
  }
}
