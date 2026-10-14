// Every sound is synthesised with WebAudio: no audio files to download.
export class Audio {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicGain!: GainNode;
  private noise!: AudioBuffer;
  muted = false;
  private musicOn = false;
  private nextBeat = 0;
  private beat = 0;
  private timer = 0;
  tempo = 112;

  /** Must be called from a user gesture (browsers block audio before one). */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.7;
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp).connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.32;
      this.musicGain.connect(this.master);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.7, this.ctx.currentTime, 0.02);
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, when = 0, out?: AudioNode) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + when;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out || this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  private hiss(dur: number, vol: number, f0: number, f1: number, when = 0, type: BiquadFilterType = 'bandpass', out?: AudioNode) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + when;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(out || this.master);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  jump(sup: boolean) {
    this.tone(sup ? 260 : 330, sup ? 0.32 : 0.18, 'square', 0.12, sup ? 1100 : 760);
    if (sup) this.tone(520, 0.3, 'sine', 0.1, 1600, 0.04);
  }
  slide() { this.hiss(0.28, 0.35, 2400, 500); }
  lane() { this.hiss(0.1, 0.18, 900, 2600, 0, 'bandpass'); }
  bump() { this.tone(140, 0.12, 'triangle', 0.25, 80); }
  land() { this.tone(110, 0.08, 'sine', 0.25, 60); }
  coin(streak: number) {
    const step = Math.min(streak, 12);
    const f = 880 * Math.pow(2, (step % 6) / 12);
    this.tone(f, 0.09, 'square', 0.07);
    this.tone(f * 1.5, 0.16, 'square', 0.06, undefined, 0.055);
  }
  power() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.14, 'square', 0.08, undefined, i * 0.06));
  }
  powerEnd() { this.tone(660, 0.18, 'triangle', 0.1, 330); }
  stumble() {
    this.hiss(0.18, 0.5, 1500, 300);
    this.tone(200, 0.2, 'sawtooth', 0.12, 90);
  }
  crash() {
    this.hiss(0.6, 0.8, 3000, 120, 0, 'lowpass');
    this.tone(160, 0.5, 'sawtooth', 0.22, 40);
    this.tone(90, 0.7, 'sine', 0.35, 30, 0.02);
  }
  click() { this.tone(660, 0.05, 'square', 0.06); }
  level() { [660, 880].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.1, undefined, i * 0.08)); }

  // ------------------------------------------------ background beat (look-ahead scheduler)
  startMusic() {
    if (!this.ctx || this.musicOn) return;
    this.musicOn = true;
    this.nextBeat = this.ctx.currentTime + 0.05;
    this.beat = 0;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }
  stopMusic() {
    this.musicOn = false;
    window.clearInterval(this.timer);
  }
  private schedule() {
    const c = this.ctx;
    if (!c || !this.musicOn) return;
    const bass = [55, 55, 65.4, 49];
    while (this.nextBeat < c.currentTime + 0.12) {
      const when = this.nextBeat - c.currentTime;
      const step = this.beat % 16; // sixteenth notes
      const bar = Math.floor(this.beat / 16) % 4;
      if (step % 4 === 0) this.kick(when);
      if (step % 4 === 2) this.hiss(0.04, 0.12, 8000, 6000, when, 'highpass', this.musicGain);
      if (step === 4 || step === 12) this.hiss(0.12, 0.22, 1800, 900, when, 'bandpass', this.musicGain);
      if (step % 2 === 0 && step !== 6 && step !== 14) this.tone(bass[bar] * (step === 10 ? 2 : 1), 0.12, 'sawtooth', 0.09, undefined, when, this.musicGain);
      if (step === 0 || step === 7 || step === 10) this.tone(bass[bar] * 4 * (step === 7 ? 1.5 : 1), 0.1, 'triangle', 0.05, undefined, when, this.musicGain);
      this.nextBeat += 60 / this.tempo / 4;
      this.beat++;
    }
  }
  private kick(when: number) {
    const c = this.ctx!;
    const t = c.currentTime + when;
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g).connect(this.musicGain);
    o.start(t);
    o.stop(t + 0.2);
  }
}
