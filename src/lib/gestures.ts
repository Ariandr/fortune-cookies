export interface GestureStart { id: number; x: number; y: number; fired: boolean }
export function movedEnough(start: GestureStart, x: number, y: number): boolean {
  return Math.hypot(x - start.x, y - start.y) >= 36;
}
