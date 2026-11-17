import { describe, expect, it, vi } from 'vitest';
import { fortunes } from '../data/fortunes';
import { DailyStore, localDay, nextDraw, parseDraw, STORAGE_KEY, untilMidnight, type StorageLike } from './daily';

function storage(): StorageLike {
  const values = new Map<string, string>();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
}
const date = new Date(2026, 10, 17, 12);

describe('fortune collection', () => {
  it('contains 600 short, distinct fortunes with permanent IDs', () => {
    expect(fortunes).toHaveLength(600);
    expect(fortunes.map(({ id }) => id)).toEqual(Array.from({ length: 600 }, (_, i) => String(i + 1).padStart(3, '0')));
    expect(new Set(fortunes.map(({ text }) => text.toLowerCase().replace(/[^a-z0-9]/g, ''))).size).toBe(600);
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

  it('does not repeat until all 600 are used, then avoids an immediate repeat', () => {
    let saved = null;
    const ids = new Set();
    for (let i = 0; i < 600; i++) {
      saved = nextDraw(saved, new Date(2026, 0, i + 1), () => 0.999);
      ids.add(saved.fortuneId);
    }
    expect(ids.size).toBe(600);
    const next = nextDraw(saved, new Date(2026, 0, 601), () => 0);
    expect(next.fortuneId).not.toBe(saved!.fortuneId);
    expect(next.seen).toHaveLength(1);
  });

  it('allows one distinct extra fortune, saves it before opening, and restores both after reload', () => {
    const shared = storage();
    const store = new DailyStore(() => shared);
    const first = store.reserve(date, () => 0);
    const bonus = store.reserve(date, () => 0, true);
    expect(bonus.id).not.toBe(first.id);
    const reloaded = new DailyStore(() => shared);
    expect(reloaded.today(date)).toEqual(bonus);
    expect(reloaded.todayFortunes(date)).toEqual([first, bonus]);
    expect(reloaded.reserve(date, () => .99, true)).toEqual(bonus);
    expect(reloaded.reserve(date, () => .99)).toEqual(first);
    expect(parseDraw(shared.getItem(STORAGE_KEY))?.seen).toHaveLength(2);
  });

  it('enforces the bonus allowance across rapid requests from separate tabs', () => {
    const shared = storage();
    const firstTab = new DailyStore(() => shared);
    const secondTab = new DailyStore(() => shared);
    firstTab.reserve(date, () => 0);
    const bonus = secondTab.reserve(date, () => .3, true);
    for (let i = 0; i < 20; i++) {
      expect(firstTab.reserve(date, Math.random, true)).toEqual(bonus);
      expect(secondTab.reserve(date, Math.random, true)).toEqual(bonus);
    }
    expect(firstTab.todayFortunes(date)).toHaveLength(2);
    expect(parseDraw(shared.getItem(STORAGE_KEY))?.seen).toHaveLength(2);
  });

  it('serializes simultaneous bonus reservations through the shared Web Lock', async () => {
    const shared = storage();
    const stores = [new DailyStore(() => shared), new DailyStore(() => shared)];
    stores[0].reserve();
    let queue = Promise.resolve();
    const request = vi.fn((_key: string, work: () => unknown) => {
      const result = queue.then(work);
      queue = result.then(() => {});
      return result;
    });
    vi.stubGlobal('navigator', { locks: { request } });
    try {
      const results = await Promise.all(Array.from({ length: 12 }, (_, index) => stores[index % 2].reserveExclusive(true)));
      expect(new Set(results.map(({ id }) => id)).size).toBe(1);
      expect(request).toHaveBeenCalledTimes(12);
      expect(parseDraw(shared.getItem(STORAGE_KEY))?.seen).toHaveLength(2);
    } finally { vi.unstubAllGlobals(); }
  });

  it('renews both daily allowances at local midnight and retains history', () => {
    const shared = storage();
    const store = new DailyStore(() => shared);
    const before = new Date(2026, 10, 17, 23, 59);
    const after = new Date(2026, 10, 18, 0, 0);
    const yesterday = [store.reserve(before, () => 0), store.reserve(before, () => 0, true)];
    expect(store.todayFortunes(after)).toEqual([]);
    const today = [store.reserve(after, () => 0), store.reserve(after, () => 0, true)];
    expect(new Set([...yesterday, ...today].map(({ id }) => id)).size).toBe(4);
    expect(store.todayFortunes(after)).toEqual(today);
    expect(parseDraw(shared.getItem(STORAGE_KEY))?.seen).toHaveLength(4);
  });

  it('does not allocate two fortunes when a bonus is requested without a first draw', () => {
    const shared = storage();
    const store = new DailyStore(() => shared);
    const saved = nextDraw(null, date, () => 0, true);
    expect(saved.bonusFortuneId).toBeUndefined();
    expect(saved.seen).toHaveLength(1);
    const first = store.reserve(date, () => 0, true);
    expect(store.todayFortunes(date)).toEqual([first]);
    expect(store.reserve(date, () => .99)).toEqual(first);
  });

  it('keeps the cookies distinct when the collection ends between the first and extra draw', () => {
    const first = { version: 1 as const, day: '2026-11-17', fortuneId: '600', seen: fortunes.map(({ id }) => id) };
    const bonus = nextDraw(first, date, () => .9999, true);
    expect(bonus.bonusFortuneId).not.toBe(first.fortuneId);
    expect(bonus.fortuneId).toBe(first.fortuneId);
    expect(parseDraw(JSON.stringify(bonus))).toEqual(bonus);
    expect(nextDraw(bonus, date, () => 0, true)).toEqual(bonus);
    const nextDay = nextDraw(bonus, new Date(2026, 10, 18), () => .9999);
    expect([bonus.fortuneId, bonus.bonusFortuneId]).not.toContain(nextDay.fortuneId);
  });

  it('uses all 600 fortunes before repeating when two are opened every day', () => {
    let saved = null;
    const ids = [];
    for (let day = 0; day < 300; day++) {
      saved = nextDraw(saved, new Date(2026, 0, day + 1), () => .9);
      ids.push(saved.fortuneId);
      saved = nextDraw(saved, new Date(2026, 0, day + 1), () => .9, true);
      ids.push(saved.bonusFortuneId);
    }
    expect(new Set(ids).size).toBe(600);
    const next = nextDraw(saved, new Date(2026, 0, 301), () => .9);
    expect(next.fortuneId).not.toBe(saved!.bonusFortuneId);
  });

  it('retains the two-fortune limit in memory when storage is denied or full', () => {
    for (const getStorage of [
      () => { throw new Error('blocked'); },
      () => ({ getItem: () => null, setItem: () => { throw new Error('full'); } }),
    ]) {
      const store = new DailyStore(getStorage);
      const first = store.reserve(date, () => 0);
      const bonus = store.reserve(date, () => .5, true);
      expect(store.reserve(date, () => .9, true)).toEqual(bonus);
      expect(store.todayFortunes(date)).toEqual([first, bonus]);
      expect(store.persistent).toBe(false);
    }
  });

  it('preserves pre-update daily records and ignores invalid extra fortune IDs', () => {
    const old = { version: 1, day: '2026-11-17', fortuneId: '201', seen: ['005', '201'] };
    expect(parseDraw(JSON.stringify(old))).toEqual(old);
    for (const bonusFortuneId of ['invalid', '201', null, 25]) {
      expect(parseDraw(JSON.stringify({ ...old, bonusFortuneId }))).toEqual(old);
    }
    expect(parseDraw(JSON.stringify({ ...old, bonusFortuneId: '501' }))?.seen).toEqual(['005', '201', '501']);
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
