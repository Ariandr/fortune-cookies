import { fortuneById, fortunes, type Fortune } from '../data/fortunes';

export const STORAGE_KEY = 'fortune-cookies:daily:v1';
export interface SavedDraw {
  version: 1;
  day: string;
  fortuneId: string;
  bonusFortuneId?: string;
  seen: string[];
}
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function localDay(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function untilMidnight(date = new Date()): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime() - date.getTime();
}

export function parseDraw(value: string | null): SavedDraw | null {
  if (!value) return null;
  try {
    const state = JSON.parse(value) as Partial<SavedDraw>;
    if (state.version !== 1 || typeof state.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(state.day)
      || typeof state.fortuneId !== 'string' || !fortuneById.has(state.fortuneId) || !Array.isArray(state.seen)) return null;
    const seen = [...new Set(state.seen.filter((id) => typeof id === 'string' && fortuneById.has(id)))];
    if (!seen.includes(state.fortuneId)) seen.push(state.fortuneId);
    const bonusFortuneId = typeof state.bonusFortuneId === 'string' && fortuneById.has(state.bonusFortuneId)
      && state.bonusFortuneId !== state.fortuneId ? state.bonusFortuneId : undefined;
    if (bonusFortuneId && !seen.includes(bonusFortuneId)) seen.push(bonusFortuneId);
    return { version: 1, day: state.day, fortuneId: state.fortuneId, ...(bonusFortuneId ? { bonusFortuneId } : {}), seen };
  } catch {
    return null;
  }
}

export function nextDraw(previous: SavedDraw | null, date = new Date(), random = Math.random, bonus = false): SavedDraw {
  const day = localDay(date);
  const sameDay = previous?.day === day;
  if (sameDay && (!bonus || previous.bonusFortuneId)) return previous;
  const seen = new Set(previous?.seen ?? []);
  let available = fortunes.filter(({ id }) => !seen.has(id));
  if (available.length === 0) {
    seen.clear();
    // When a cycle ends between today's cookies, keep both daily fortunes distinct.
    if (sameDay) seen.add(previous.fortuneId);
    const lastId = previous?.bonusFortuneId ?? previous?.fortuneId;
    available = fortunes.filter(({ id }) => !seen.has(id) && id !== lastId);
  }
  const choice = available[Math.min(available.length - 1, Math.max(0, Math.floor(random() * available.length)))];
  seen.add(choice.id);
  return sameDay
    ? { ...previous, bonusFortuneId: choice.id, seen: [...seen] }
    : { version: 1, day, fortuneId: choice.id, seen: [...seen] };
}

export class DailyStore {
  private memory: SavedDraw | null = null;
  persistent = true;
  constructor(private readonly storage: () => StorageLike | null) {}

  read(): SavedDraw | null {
    if (!this.persistent && this.memory) return this.memory;
    try {
      const storage = this.storage();
      if (!storage) throw new Error('Storage unavailable');
      this.memory = parseDraw(storage.getItem(STORAGE_KEY));
      this.persistent = true;
    } catch {
      this.persistent = false;
    }
    return this.memory;
  }

  today(date = new Date()): Fortune | null {
    return this.todayFortunes(date).at(-1) ?? null;
  }

  todayFortunes(date = new Date()): Fortune[] {
    const draw = this.read();
    if (draw?.day !== localDay(date)) return [];
    return [draw.fortuneId, draw.bonusFortuneId].flatMap((id) => {
      const fortune = id ? fortuneById.get(id) : undefined;
      return fortune ? [fortune] : [];
    });
  }

  reserve(date = new Date(), random = Math.random, bonus = false): Fortune {
    this.memory = nextDraw(this.read(), date, random, bonus);
    try {
      const storage = this.storage();
      if (!storage) throw new Error('Storage unavailable');
      storage.setItem(STORAGE_KEY, JSON.stringify(this.memory));
      this.persistent = true;
    } catch {
      this.persistent = false;
    }
    return fortuneById.get(bonus ? this.memory.bonusFortuneId ?? this.memory.fortuneId : this.memory.fortuneId)!;
  }

  async reserveExclusive(bonus = false): Promise<Fortune> {
    // Re-read within the shared lock so simultaneous tabs reserve the same draw.
    if (typeof navigator !== 'undefined' && navigator.locks) {
      return navigator.locks.request(STORAGE_KEY, () => this.reserve(new Date(), Math.random, bonus));
    }
    return this.reserve(new Date(), Math.random, bonus);
  }
}

export const dailyStore = new DailyStore(() => window.localStorage);
