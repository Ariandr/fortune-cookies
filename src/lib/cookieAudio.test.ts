import { afterEach, describe, expect, it, vi } from 'vitest';
import { CookieAudio, readSoundPreference, saveSoundPreference, synthesizeCookieSound } from './cookieAudio';

afterEach(() => vi.unstubAllGlobals());

function audioFixture() {
  vi.stubGlobal('document', { hidden: false });
  const voices: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }[] = [];
  const context = {
    state: 'running', sampleRate: 44100, destination: {},
    resume: vi.fn().mockResolvedValue(undefined), suspend: vi.fn().mockResolvedValue(undefined),
    createBuffer: vi.fn(() => ({ copyToChannel: vi.fn() })),
    createBufferSource: vi.fn(() => {
      const voice = { connect: vi.fn(), start: vi.fn(), stop: vi.fn(), disconnect: vi.fn() };
      voices.push(voice);
      return voice;
    }),
  };
  const factory = vi.fn(() => context as unknown as AudioContext);
  return { sounds: new CookieAudio(factory), context, factory, voices };
}

describe('cookie sounds', () => {
  it('creates no audio context until a cookie gesture, then plays the tap and crack', () => {
    const { sounds, factory, voices } = audioFixture();
    sounds.crack();
    expect(factory).not.toHaveBeenCalled();
    sounds.tap(); sounds.crack();
    expect(factory).toHaveBeenCalledTimes(1);
    expect(voices).toHaveLength(2);
    for (const voice of voices) expect(voice.start).toHaveBeenCalledTimes(1);
  });

  it('mutes an active sound immediately and prevents subsequent crack playback', () => {
    const { sounds, voices } = audioFixture();
    sounds.tap();
    sounds.setEnabled(false);
    expect(voices[0].stop).toHaveBeenCalledTimes(1);
    sounds.crack(); sounds.tap();
    expect(voices).toHaveLength(1);
    sounds.setEnabled(true); sounds.tap();
    expect(voices).toHaveLength(2);
  });

  it('resumes a suspended context from the tap gesture without waiting for storage', () => {
    const { sounds, context, voices } = audioFixture();
    context.state = 'suspended';
    sounds.tap();
    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(voices[0].start).toHaveBeenCalledTimes(1);
  });

  it('stops active audio when hidden and does not queue background sounds', () => {
    const { sounds, voices } = audioFixture();
    sounds.tap();
    vi.stubGlobal('document', { hidden: true });
    sounds.stop(); sounds.crack(); sounds.tap();
    expect(voices[0].stop).toHaveBeenCalledTimes(1);
    expect(voices).toHaveLength(1);
    vi.stubGlobal('document', { hidden: false });
    expect(voices).toHaveLength(1);
  });

  it('does not throw when audio is unavailable or resuming is denied', async () => {
    vi.stubGlobal('document', { hidden: false });
    const unavailable = new CookieAudio(() => { throw new Error('Unavailable'); });
    expect(() => { unavailable.tap(); unavailable.crack(); unavailable.stop(); }).not.toThrow();
    const { sounds, context } = audioFixture();
    context.state = 'suspended';
    context.resume.mockRejectedValue(new Error('Denied'));
    expect(() => { sounds.tap(); sounds.crack(); }).not.toThrow();
    await Promise.resolve();
  });

  it('keeps sound preference failures separate from daily draw storage', () => {
    vi.stubGlobal('window', { localStorage: { getItem: () => 'off', setItem: vi.fn() } });
    expect(readSoundPreference()).toBe(false);
    vi.stubGlobal('window', { get localStorage() { throw new Error('Denied'); } });
    expect(readSoundPreference()).toBe(true);
    expect(() => saveSoundPreference(false)).not.toThrow();
  });

  it('generates finite, softly bounded foley at common device sample rates', () => {
    for (const rate of [32000, 44100, 48000]) for (const kind of ['tap', 'crack'] as const) {
      const samples = synthesizeCookieSound(kind, rate);
      expect(samples.length / rate).toBeCloseTo(kind === 'tap' ? .085 : .82, 3);
      expect(samples.every((value) => Number.isFinite(value) && Math.abs(value) < .71)).toBe(true);
      expect(samples.some((value) => Math.abs(value) > .1)).toBe(true);
      expect(Math.abs(samples[0])).toBeLessThan(1e-6);
      expect(Math.abs(samples.at(-1)!)).toBeLessThan(1e-6);
    }
  });
});
