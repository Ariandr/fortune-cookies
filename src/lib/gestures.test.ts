import { expect, it } from 'vitest';
import { movedEnough } from './gestures';
it('recognizes a swipe in any direction at 36px, without mistaking tap jitter for a swipe', () => {
  const start = { id: 1, x: 100, y: 100, fired: false };
  expect(movedEnough(start, 105, 108)).toBe(false);
  expect(movedEnough(start, 135, 100)).toBe(false);
  expect(movedEnough(start, 136, 100)).toBe(true);
  expect(movedEnough(start, 100, 64)).toBe(true);
  expect(movedEnough(start, 130, 130)).toBe(true);
});
