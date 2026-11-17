export interface CookiePosition { x: number; y: number; scale: number; rotation: [number, number, number] }
// Authored rather than random: every cookie stays reachable and the heading stays clear.
const desktop = [
  [-4.65, 2.05, 0.58, -0.35], [-1.9, 2.32, 0.7, 0.23], [1.58, 2.25, 0.6, -0.32], [4.55, 1.95, 0.66, 0.4],
  [-5.25, -0.45, 0.7, 0.25], [-2.4, -0.35, 0.88, -0.18], [1.35, -0.48, 0.96, 0.12], [4.75, -0.65, 0.65, -0.3],
  [-3.3, -2.5, 0.6, -0.28], [3.55, -2.5, 0.62, 0.22],
];
const portrait = [
  [-2.35, 2.15, 0.66, -0.35], [0, 2.65, 0.65, 0.2], [2.35, 2.15, 0.64, -0.25],
  [-1.3, 0.45, 0.82, 0.28], [1.3, 0.35, 0.74, -0.3],
  [-2.35, -1.35, 0.62, -0.2], [0, -1.25, 0.8, 0.2], [2.35, -1.4, 0.64, -0.2],
  [-1.35, -3.05, 0.63, -0.3], [1.35, -3.05, 0.67, 0.25],
];
export function cookieLayout(isPortrait: boolean): CookiePosition[] {
  return (isPortrait ? portrait : desktop).map(([x, y, scale, rz], i) => ({
    x, y, scale,
    rotation: [-0.12 + Math.sin(i * 1.9) * 0.24, -0.08 + Math.cos(i * 2) * 0.32, rz],
  }));
}
