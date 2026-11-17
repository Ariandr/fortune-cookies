export const SOUND_KEY = 'fortune-cookies:sound:v1';
type SoundKind = 'tap' | 'crack';
const fractures = [[0, .7, 95], [.018, .4, 110], [.047, .25, 70], [.095, .16, 55]];

export function readSoundPreference(): boolean {
  try { return window.localStorage.getItem(SOUND_KEY) !== 'off'; } catch { return true; }
}

export function saveSoundPreference(enabled: boolean) {
  try { window.localStorage.setItem(SOUND_KEY, enabled ? 'on' : 'off'); } catch { /* Keep the session preference. */ }
}

// Original, short foley: a dry tap, then brittle wafer fractures and a paper rustle.
// Buffer synthesis avoids downloads and lets the first interaction sound immediately.
export function synthesizeCookieSound(kind: SoundKind, sampleRate: number): Float32Array<ArrayBuffer> {
  const duration = kind === 'tap' ? .085 : .82;
  const samples = new Float32Array(Math.ceil(sampleRate * duration));
  let seed = kind === 'tap' ? 72871 : 90317;
  let low = 0, paper = 0;
  for (let i = 0; i < samples.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const noise = seed / 2147483648 - 1;
    low += .35 * (noise - low);
    paper += .08 * (noise - paper);
    const t = i / sampleRate;
    let value = 0;
    if (kind === 'tap') {
      value = (noise - low) * .38 * Math.exp(-t * 105)
        + Math.sin(t * Math.PI * 2 * 920) * .17 * Math.exp(-t * 72)
        + Math.sin(t * Math.PI * 2 * 310) * .12 * Math.exp(-t * 55);
    } else {
      for (const [delay, strength, decay] of fractures) {
        const age = t - delay;
        if (age >= 0) value += (noise - low * .7) * strength * Math.exp(-age * decay) * Math.min(1, age * 2500);
      }
      if (t > .16) {
        const envelope = Math.sin(Math.PI * Math.min(1, (t - .16) / .66)) ** 2;
        const flutter = .5 + .5 * Math.sin(t * 127) * Math.sin(t * 43);
        value += (low - paper) * .23 * envelope * flutter;
      }
    }
    const fade = Math.min(1, i / (sampleRate * .0008), (samples.length - 1 - i) / (sampleRate * .006));
    samples[i] = Math.tanh(value) * Math.max(0, fade) * .7;
  }
  return samples;
}

export class CookieAudio {
  private context: AudioContext | null = null;
  private buffers = new Map<SoundKind, AudioBuffer>();
  private voices = new Set<AudioBufferSourceNode>();
  private enabled = true;

  constructor(private readonly createContext = () => new AudioContext()) {}

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) this.stop();
    else if (this.context && this.context.state !== 'running') void this.context.resume().catch(() => {});
  }

  tap() { this.play('tap', true); }
  crack() { this.play('crack', false); }

  stop() {
    for (const voice of this.voices) {
      try { voice.stop(); } catch { /* A completed sound needs no further cleanup. */ }
      voice.disconnect();
    }
    this.voices.clear();
    if (this.context?.state === 'running') void this.context.suspend().catch(() => {});
  }

  private play(kind: SoundKind, gesture: boolean) {
    if (!this.enabled || document.hidden) return;
    try {
      if (!this.context) {
        if (!gesture) return;
        this.context = this.createContext();
      }
      const context = this.context;
      // Resume synchronously inside the cookie gesture, before any storage lock awaits.
      if (gesture && context.state !== 'running') void context.resume().catch(() => {});
      if (!gesture && context.state !== 'running') return;
      let buffer = this.buffers.get(kind);
      if (!buffer) {
        const samples = synthesizeCookieSound(kind, context.sampleRate);
        buffer = context.createBuffer(1, samples.length, context.sampleRate);
        buffer.copyToChannel(samples, 0);
        this.buffers.set(kind, buffer);
      }
      const voice = context.createBufferSource();
      voice.buffer = buffer;
      voice.connect(context.destination);
      voice.onended = () => { voice.disconnect(); this.voices.delete(voice); };
      this.voices.add(voice);
      voice.start();
    } catch { /* Audio support and autoplay policies must never prevent a fortune. */ }
  }
}

export const cookieAudio = new CookieAudio();
