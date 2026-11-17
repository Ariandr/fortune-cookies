import { describe, expect, it } from 'vitest';
import { fortunes } from '../data/fortunes';
import { DailyStore, localDay, nextDraw, parseDraw, STORAGE_KEY, untilMidnight, type StorageLike } from './daily';

function storage(): StorageLike {
  const values = new Map<string, string>();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
}
const date = new Date(2026, 10, 17, 12);

describe('fortune collection', () => {
  it('contains 500 short, distinct fortunes with permanent IDs', () => {
    expect(fortunes).toHaveLength(500);
    expect(new Set(fortunes.map(({ id }) => id)).size).toBe(500);
    expect(new Set(fortunes.map(({ text }) => text.toLowerCase().replace(/[^a-z0-9]/g, ''))).size).toBe(500);
    for (const { id, text } of fortunes) {
      expect(id).toMatch(/^\d{3}$/);
      expect(text.length).toBeLessThanOrEqual(180);
      expect(text.trim()).toBe(text);
      const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [];
      expect(sentences.length).toBeGreaterThanOrEqual(1);
      expect(sentences.length).toBeLessThanOrEqual(2);
      expect(text).toMatch(/[.!?]$/);
    }
  });
});

describe('daily draw', () => {
  it('reserves before a reveal and restores it after refresh or an interrupted animation', () => {
    const shared = storage();
    const first = new DailyStore(() => shared).reserve(date);
    const reloaded = new DailyStore(() => shared);
    expect(reloaded.today(date)).toEqual(first);
    expect(reloaded.reserve(date)).toEqual(first);
  });

  it('ignores rapid repeated requests and shares reservations across stores', () => {
    const shared = storage();
    const first = new DailyStore(() => shared);
    const second = new DailyStore(() => shared);
    const fortune = first.reserve(date, () => 0);
    for (let i = 0; i < 20; i++) expect(second.reserve(date, () => 0.99)).toEqual(fortune);
    expect(parseDraw(shared.getItem(STORAGE_KEY))?.seen).toHaveLength(1);
  });

  it('allows a new draw at local midnight and preserves unseen history', () => {
    const shared = storage();
    const store = new DailyStore(() => shared);
    const first = store.reserve(new Date(2026, 10, 17, 23, 59), () => 0);
    const after = new Date(2026, 10, 18, 0, 0);
    expect(store.today(after)).toBeNull();
    expect(store.reserve(after, () => 0).id).not.toBe(first.id);
    expect(parseDraw(shared.getItem(STORAGE_KEY))?.seen).toHaveLength(2);
  });

  it('does not repeat until all 500 are used, then avoids an immediate repeat', () => {
    let saved = null;
    const ids = new Set();
    for (let i = 0; i < 500; i++) {
      saved = nextDraw(saved, new Date(2026, 0, i + 1), () => 0.999);
      ids.add(saved.fortuneId);
    }
    expect(ids.size).toBe(500);
    const next = nextDraw(saved, new Date(2026, 0, 501), () => 0);
    expect(next.fortuneId).not.toBe(saved!.fortuneId);
    expect(next.seen).toHaveLength(1);
  });

  it('keeps the current session usable if storage access or writes fail', () => {
    const denied = new DailyStore(() => { throw new Error('blocked'); });
    const first = denied.reserve(date, () => 0);
    expect(denied.reserve(date, () => 0.9)).toEqual(first);
    expect(denied.persistent).toBe(false);
    const quota = new DailyStore(() => ({ getItem: () => null, setItem: () => { throw new Error('full'); } }));
    expect(quota.reserve(date)).toBeDefined();
    expect(quota.today(date)).toBeDefined();
  });

  it('recovers from malformed state and sanitizes obsolete history', () => {
    expect(parseDraw('not json')).toBeNull();
    expect(parseDraw('{}')).toBeNull();
    const saved = nextDraw(null, date, () => 0);
    expect(parseDraw(JSON.stringify({ ...saved, seen: ['001', '001', 'removed'] }))?.seen).toEqual(['001']);
  });

  it('uses local dates rather than a UTC date string', () => {
    const atMidnight = new Date(2026, 10, 17, 0, 0);
    expect(localDay(atMidnight)).toBe('2026-11-17');
    expect(untilMidnight(atMidnight)).toBeGreaterThan(0);
    expect(untilMidnight(new Date(2026, 10, 17, 23, 59, 59))).toBe(1000);
  });

  it('calculates calendar midnight across daylight-saving changes', () => {
    const old = process.env.TZ;
    try {
      process.env.TZ = 'America/New_York';
      expect(untilMidnight(new Date(2026, 2, 8, 0))).toBe(23 * 60 * 60 * 1000);
      expect(untilMidnight(new Date(2026, 10, 1, 0))).toBe(25 * 60 * 60 * 1000);
    } finally { process.env.TZ = old; }
  });
});
