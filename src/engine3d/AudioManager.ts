import {speakLabText, stopLabSpeech} from '../services/labAudioService';

let sharedCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!sharedCtx) {
    const AudioCtor =
      window.AudioContext ||
      (window as unknown as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
    if (!AudioCtor) return null;
    sharedCtx = new AudioCtor();
  }
  if (sharedCtx.state === 'suspended') {
    sharedCtx.resume().catch(() => {});
  }
  return sharedCtx;
}

export class WorldAudioManager {
  public muted = false;
  public volume = 0.7;

  setMuted(m: boolean) {
    this.muted = m;
    if (m) stopLabSpeech();
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
  }

  speak(text: string, accent: 'en-GB' | 'en-US' = 'en-GB', rate = 0.94) {
    if (this.muted || !text.trim()) return;
    speakLabText(text, accent, rate);
  }

  speakEnglish(text: string, accent: 'en-GB' | 'en-US' = 'en-GB', rate = 0.94) {
    this.speak(text, accent, rate);
  }

  stopSpeech() {
    stopLabSpeech();
  }

  playPianoNote(freq: number) {
    if (this.muted) return;
    const ctx = getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const harm = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    harm.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    harm.frequency.setValueAtTime(freq * 2, now);
    const v = 0.28 * this.volume;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(v, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    osc.connect(gain);
    harm.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    harm.start(now);
    osc.stop(now + 0.92);
    harm.stop(now + 0.92);
  }

  playGuitarString(freq: number) {
    if (this.muted) return;
    const ctx = getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, now);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2400, now);
    filter.frequency.exponentialRampToValueAtTime(420, now + 0.85);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.24 * this.volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.95);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.98);
  }

  playDrumPart(part: 'kick' | 'snare' | 'hihat' | 'tom') {
    if (this.muted) return;
    const ctx = getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (part === 'kick' || part === 'tom') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(part === 'kick' ? 155 : 220, now);
      osc.frequency.exponentialRampToValueAtTime(part === 'kick' ? 42 : 95, now + 0.18);
      gain.gain.setValueAtTime(0.45 * this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.26);
      return;
    }

    // Filtered noise burst for snare / hi-hat
    const dur = part === 'snare' ? 0.16 : 0.07;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = part === 'snare' ? 1100 : 5200;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.32 * this.volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
  }

  playEffect(key?: string) {
    if (this.muted || !key) return;
    const ctx = getCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (key.startsWith('piano_')) {
      const freq = Number(key.replace('piano_', '')) || 261.63;
      this.playPianoNote(freq);
      return;
    }
    if (key.startsWith('guitar_')) {
      const freq = Number(key.replace('guitar_', '')) || 196;
      this.playGuitarString(freq);
      return;
    }
    if (key.startsWith('drum_')) {
      const part = key.replace('drum_', '') as 'kick' | 'snare' | 'hihat' | 'tom';
      this.playDrumPart(part);
      return;
    }

    if (key === 'water') {
      const dur = 0.45;
      const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.4;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1400;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.24 * this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      src.connect(bp);
      bp.connect(gain);
      gain.connect(ctx.destination);
      src.start(now);
      return;
    }

    if (key === 'mission_complete') {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, now + idx * 0.09);
        g.gain.setValueAtTime(0.001, now + idx * 0.09);
        g.gain.linearRampToValueAtTime(0.22 * this.volume, now + idx * 0.09 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.34);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(now + idx * 0.09);
        osc.stop(now + idx * 0.09 + 0.36);
      });
      return;
    }

    if (key === 'servo' || key === 'washer' || key === 'build') {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = key === 'servo' ? 'sawtooth' : 'sine';
      const startF = key === 'build' ? 120 : key === 'washer' ? 160 : 320;
      const endF = key === 'build' ? 240 : key === 'washer' ? 240 : 480;
      osc.frequency.setValueAtTime(startF, now);
      osc.frequency.linearRampToValueAtTime(endF, now + 0.25);
      g.gain.setValueAtTime(0.18 * this.volume, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
      return;
    }

    // Crisp mechanical click / door / plant / error chime
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = key === 'error' ? 'sawtooth' : 'sine';
    const f1 = key === 'error' ? 210 : key === 'plant' ? 440 : 520;
    const f2 = key === 'error' ? 150 : key === 'plant' ? 660 : 680;
    osc.frequency.setValueAtTime(f1, now);
    osc.frequency.exponentialRampToValueAtTime(f2, now + 0.14);
    g.gain.setValueAtTime(0.2 * this.volume, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }
}

export const worldAudio = new WorldAudioManager();
