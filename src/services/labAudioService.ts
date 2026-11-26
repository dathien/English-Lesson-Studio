/**
 * Offline-first procedural audio + browser TTS + local microphone recording service
 * for English Interactive Lab. Zero external MP3/API dependencies.
 */

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || (window as unknown as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    sharedAudioCtx = new Ctx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

export type LabSoundEffect =
  | 'correct'
  | 'incorrect'
  | 'click'
  | 'chime'
  | 'guitar'
  | 'piano'
  | 'drum'
  | 'flute'
  | 'violin'
  | 'danbau';

/**
 * Play realistic synthesized Web Audio tones (musical instruments for Unit 3 Music Stage
 * and subtle classroom feedback chimes).
 */
export function playLabSoundEffect(effect: LabSoundEffect): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;

  const master = ctx.createGain();
  master.gain.setValueAtTime(0.24, now);
  master.connect(ctx.destination);

  if (effect === 'click') {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(280, now + 0.05);
    g.gain.setValueAtTime(0.25, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(g).connect(master);
    osc.start(now);
    osc.stop(now + 0.07);
    return;
  }

  if (effect === 'correct' || effect === 'chime') {
    const freqs = effect === 'correct' ? [523.25, 659.25, 783.99] : [587.33, 880];
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + i * 0.08);
      g.gain.setValueAtTime(0.001, now + i * 0.08);
      g.gain.linearRampToValueAtTime(0.35, now + i * 0.08 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.28);
      osc.connect(g).connect(master);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.3);
    });
    return;
  }

  if (effect === 'incorrect') {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(165, now + 0.22);
    g.gain.setValueAtTime(0.18, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(g).connect(master);
    osc.start(now);
    osc.stop(now + 0.26);
    return;
  }

  if (effect === 'guitar') {
    // Warm plucked C-major arpeggio
    [261.63, 329.63, 392.0, 523.25].forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, now + idx * 0.07);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2400, now + idx * 0.07);
      filter.frequency.exponentialRampToValueAtTime(450, now + idx * 0.07 + 0.6);
      g.gain.setValueAtTime(0.3, now + idx * 0.07);
      g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.75);
      osc.connect(filter).connect(g).connect(master);
      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.78);
    });
    return;
  }

  if (effect === 'piano') {
    // Rich chord with overtone
    [261.63, 329.63, 392.0, 523.25].forEach((f) => {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const g = ctx.createGain();
      osc1.type = 'triangle';
      osc2.type = 'sine';
      osc1.frequency.setValueAtTime(f, now);
      osc2.frequency.setValueAtTime(f * 2, now);
      g.gain.setValueAtTime(0.22, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
      osc1.connect(g);
      osc2.connect(g);
      g.connect(master);
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.92);
      osc2.stop(now + 0.92);
    });
    return;
  }

  if (effect === 'drum') {
    // Kick + Snare rhythmic pair
    const kick = ctx.createOscillator();
    const kg = ctx.createGain();
    kick.type = 'sine';
    kick.frequency.setValueAtTime(140, now);
    kick.frequency.exponentialRampToValueAtTime(45, now + 0.14);
    kg.gain.setValueAtTime(0.7, now);
    kg.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    kick.connect(kg).connect(master);
    kick.start(now);
    kick.stop(now + 0.2);

    // Snare noise burst
    const bufSize = Math.floor(ctx.sampleRate * 0.16);
    const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.35));
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(900, now + 0.18);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.45, now + 0.18);
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    noise.connect(hp).connect(ng).connect(master);
    noise.start(now + 0.18);
    return;
  }

  if (effect === 'flute') {
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, now);
    osc.frequency.setValueAtTime(659.25, now + 0.25);
    osc.frequency.setValueAtTime(783.99, now + 0.5);
    lfo.frequency.setValueAtTime(5.5, now);
    lfoGain.gain.setValueAtTime(4, now);
    lfo.connect(lfoGain).connect(osc.frequency);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.32, now + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
    osc.connect(g).connect(master);
    osc.start(now);
    lfo.start(now);
    osc.stop(now + 0.88);
    lfo.stop(now + 0.88);
    return;
  }

  if (effect === 'violin') {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(554.37, now + 0.4);
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, now);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.3, now + 0.12);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
    osc.connect(filter).connect(g).connect(master);
    osc.start(now);
    osc.stop(now + 0.88);
    return;
  }

  if (effect === 'danbau') {
    // Traditional Vietnamese monochord harmonic glide (pitch bend)
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(523.25, now + 0.22);
    osc.frequency.exponentialRampToValueAtTime(392.0, now + 0.58);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.85);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.36, now + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
    osc.connect(g).connect(master);
    osc.start(now);
    osc.stop(now + 1.05);
  }
}

export function playInstrumentSound(
  soundType?: 'speech' | 'guitar' | 'piano' | 'drum' | 'flute' | 'violin' | 'danbau' | 'chime' | 'click'
): void {
  if (!soundType || soundType === 'speech') return;
  playLabSoundEffect(soundType);
}

/**
 * Play an intonation pitch contour audibly so students hear Falling / Rising / Fall-Rise pitch shape.
 */
export function playPitchContour(points: number[]): void {
  const ctx = getAudioContext();
  if (!ctx || points.length === 0) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  const stepDur = 0.9 / Math.max(points.length - 1, 1);
  points.forEach((p, idx) => {
    const freq = 180 + (Math.max(0, Math.min(100, p)) / 100) * 260;
    if (idx === 0) osc.frequency.setValueAtTime(freq, now);
    else osc.frequency.linearRampToValueAtTime(freq, now + idx * stepDur);
  });
  g.gain.setValueAtTime(0.001, now);
  g.gain.linearRampToValueAtTime(0.2, now + 0.06);
  g.gain.setValueAtTime(0.2, now + 0.85);
  g.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
  osc.connect(g).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 1.02);
}

/**
 * Play rhythmic syllable stress pulses (loud high beat for stressed, soft low beat for unstressed).
 */
export function playStressBeatPattern(stressedFlags: boolean[]): void {
  const ctx = getAudioContext();
  if (!ctx || stressedFlags.length === 0) return;
  const now = ctx.currentTime;
  stressedFlags.forEach((isStressed, idx) => {
    const t = now + idx * 0.28;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = isStressed ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(isStressed ? 560 : 300, t);
    g.gain.setValueAtTime(isStressed ? 0.3 : 0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + (isStressed ? 0.2 : 0.12));
    osc.connect(g).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.22);
  });
}

export interface SpeakOptions {
  accent?: 'en-GB' | 'en-US';
  rate?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: () => void;
}

export function stopLabSpeech(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export function speakLabText(
  text: string,
  optionsOrAccent: SpeakOptions | 'en-GB' | 'en-US' = {},
  rateOverride?: number
): boolean {
  const options: SpeakOptions =
    typeof optionsOrAccent === 'string'
      ? {accent: optionsOrAccent, rate: rateOverride}
      : optionsOrAccent;
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    options.onError?.();
    return false;
  }
  const clean = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!clean) return false;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(clean);
  const accent = options.accent ?? 'en-GB';
  utterance.lang = accent;
  utterance.rate = options.rate ?? 0.95;

  const voices = window.speechSynthesis.getVoices();
  const exactVoice =
    voices.find((v) => v.lang.toLowerCase() === accent.toLowerCase()) ||
    voices.find((v) => v.lang.toLowerCase().startsWith(accent.slice(0, 2).toLowerCase()));
  if (exactVoice) {
    utterance.voice = exactVoice;
  }

  utterance.onstart = () => options.onStart?.();
  utterance.onend = () => options.onEnd?.();
  utterance.onerror = () => options.onError?.();

  window.speechSynthesis.speak(utterance);
  return true;
}

export interface LocalRecorderController {
  stop: () => void;
}

export interface MicRecordingSession {
  stop: () => Promise<string>;
}

/**
 * Local-only microphone recording via MediaRecorder.
 * Supports both zero-arg Promise session API and callback API.
 */
export async function startLocalMicRecording(): Promise<MicRecordingSession>;
export async function startLocalMicRecording(
  onComplete: (result: {blobUrl: string; durationSec: number}) => void,
  onError: (message: string) => void
): Promise<LocalRecorderController | null>;
export async function startLocalMicRecording(
  onComplete?: (result: {blobUrl: string; durationSec: number}) => void,
  onError?: (message: string) => void
): Promise<MicRecordingSession | LocalRecorderController | null> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    const msg = 'Trình duyệt hiện tại không hỗ trợ ghi âm micro cục bộ.';
    if (onError) {
      onError(msg);
      return null;
    }
    throw new Error(msg);
  }
  if (typeof MediaRecorder === 'undefined') {
    const msg = 'Thiết bị này không hỗ trợ MediaRecorder.';
    if (onError) {
      onError(msg);
      return null;
    }
    throw new Error(msg);
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({audio: true});
    const chunks: BlobPart[] = [];
    const startedAt = Date.now();
    const recorder = new MediaRecorder(stream);

    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunks.push(ev.data);
    };

    if (onComplete) {
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunks, {type: recorder.mimeType || 'audio/webm'});
        const blobUrl = URL.createObjectURL(blob);
        const durationSec = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
        onComplete({blobUrl, durationSec});
      };
      recorder.onerror = () => {
        stream.getTracks().forEach((track) => track.stop());
        onError?.('Đã xảy ra sự cố khi ghi âm. Vui lòng thử lại.');
      };
      recorder.start();
      return {
        stop: () => {
          if (recorder.state !== 'inactive') recorder.stop();
        },
      };
    }

    recorder.start();
    return {
      stop: () =>
        new Promise<string>((resolve) => {
          recorder.onstop = () => {
            stream.getTracks().forEach((track) => track.stop());
            const blob = new Blob(chunks, {type: recorder.mimeType || 'audio/webm'});
            resolve(URL.createObjectURL(blob));
          };
          if (recorder.state !== 'inactive') recorder.stop();
          else resolve('');
        }),
    };
  } catch {
    const msg = 'Không thể truy cập micro. Vui lòng cấp quyền micro trong trình duyệt để luyện nói.';
    if (onError) {
      onError(msg);
      return null;
    }
    throw new Error(msg);
  }
}
