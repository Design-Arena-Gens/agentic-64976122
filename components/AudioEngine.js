let singleton = null;

function makeNoiseBuffer(ctx, length = 0.4) {
  const rate = ctx.sampleRate;
  const frames = Math.floor(length * rate);
  const buffer = ctx.createBuffer(1, frames, rate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    // Pinkish noise feel
    const white = Math.random() * 2 - 1;
    data[i] = (data[i - 1] || 0) * 0.98 + white * 0.02;
  }
  return buffer;
}

export function createAudioEngine() {
  if (singleton) return singleton;
  const engine = {
    ctx: null,
    gain: null,
    started: false,
    async start() {
      if (this.started) return;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.gain = this.ctx.createGain();
      this.gain.gain.value = 0.6;
      this.gain.connect(this.ctx.destination);
      this.started = true;
    },
    playSlice() {
      if (!this.started) return;
      const now = this.ctx.currentTime;
      // soft ?swish? + subtle high edge
      const noiseSrc = this.ctx.createBufferSource();
      noiseSrc.buffer = makeNoiseBuffer(this.ctx, 0.15);
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 5000;
      bp.Q.value = 1.5;
      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0.0, now);
      env.gain.linearRampToValueAtTime(0.5, now + 0.03);
      env.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
      noiseSrc.connect(bp).connect(env).connect(this.gain);
      noiseSrc.start(now);
      noiseSrc.stop(now + 0.2);
    },
    playCrack() {
      if (!this.started) return;
      const now = this.ctx.currentTime;
      // short crack impulse + tiny ring
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(900, now);
      osc.frequency.exponentialRampToValueAtTime(3000, now + 0.02);
      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0.0, now);
      env.gain.linearRampToValueAtTime(0.8, now + 0.005);
      env.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      osc.connect(env).connect(this.gain);
      osc.start(now);
      osc.stop(now + 0.13);
    },
    playShards() {
      if (!this.started) return;
      const now = this.ctx.currentTime;
      // multiple tiny tinkles with random panning
      const count = 12;
      for (let i = 0; i < count; i++) {
        const t = now + 0.03 + i * 0.01 + Math.random() * 0.03;
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        const base = 2000 + Math.random() * 5000;
        osc.frequency.setValueAtTime(base, t);
        const env = this.ctx.createGain();
        env.gain.setValueAtTime(0.0, t);
        env.gain.linearRampToValueAtTime(0.4, t + 0.005);
        env.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
        // subtle stereo width
        const panner = this.ctx.createStereoPanner();
        panner.pan.value = (Math.random() * 2 - 1) * 0.6;
        osc.connect(env).connect(panner).connect(this.gain);
        osc.start(t);
        osc.stop(t + 0.21);
      }
    },
  };
  singleton = engine;
  return engine;
}

