import * as THREE from 'three';

const HALF_ARC = Math.PI * 0.75;
const ALONG_ARC = 64;
const ACROSS_WAFER = 36;

// The reference is a domed horseshoe, rather than a bent strip: a 270-degree
// wafer surrounds a deep, open notch. Its broad outer skirt stays thin while
// the folded inner shoulder rises into a rounded, hollow shell.
function wafer(u: number, v: number, side: -1 | 1, face: -1 | 1, inner: boolean) {
  const angle = Math.PI / 2 - side * u * HALF_ARC;
  const outerRadius = 1.14 + 0.008 * Math.sin(angle * 9) ** 2;
  const innerRadius = 0.18 + 0.72 * Math.pow(u, 3.2);
  const radius = THREE.MathUtils.lerp(innerRadius, outerRadius, v);
  const shoulder = Math.pow(Math.sin(Math.PI * Math.pow(Math.min(1, v / 0.9), 0.82)), 0.82);
  // Both tips flatten into crisp wafer edges, instead of rounded tube caps.
  const tip = THREE.MathUtils.smoothstep(1 - u, 0, 0.23);
  const bulge = shoulder * tip;
  const grain = Math.sin(radius * 83 + Math.sin(angle * 43) * 2) * Math.sin(angle * 79) * 0.0016 * bulge;
  const depth = (face === 1 ? 0.42 : 0.22) * bulge;
  const wall = inner ? 0.026 * shoulder * tip : 0;
  const z = face * (0.015 + depth - wall) + grain;
  // Shared, complementary fracture edges lie through the back of the horseshoe.
  const fracture = Math.pow(1 - u, 16) * Math.sin(Math.PI * v)
    * (Math.sin(v * 43) + Math.sin(v * 19)) * 0.008;
  return new THREE.Vector3(radius * Math.cos(angle) + fracture, radius * Math.sin(angle) - 0.14, z);
}

export function makeCookieHalf(side: -1 | 1): THREE.BufferGeometry {
  const vertices: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const groups: { start: number; count: number; material: number }[] = [];
  const golden = new THREE.Color('#e4ad43');
  const pale = new THREE.Color('#f4cc6f');
  const toasted = new THREE.Color('#b8792d');
  const color = new THREE.Color();

  function vertex(u: number, v: number, face: -1 | 1, inner: boolean) {
    const point = wafer(u, v, side, face, inner);
    vertices.push(point.x, point.y, point.z);
    uvs.push(point.x * 1.3 + 0.5, point.y * 1.3 + point.z * 0.4);
    const edgeToast = THREE.MathUtils.smoothstep(v, 0.84, 1) * 0.77;
    const tipToast = THREE.MathUtils.smoothstep(u, 0.9, 1) * 0.13;
    const fleck = Math.max(0, Math.sin(point.x * 31 + point.y * 17) * Math.sin(point.y * 37 - point.z * 23));
    color.copy(golden).lerp(pale, Math.sin(v * Math.PI) * 0.42);
    color.lerp(toasted, edgeToast + tipToast + fleck * 0.055);
    colors.push(color.r, color.g, color.b);
  }

  function surface(face: -1 | 1, inner: boolean) {
    const start = indices.length;
    const offset = vertices.length / 3;
    for (let i = 0; i <= ALONG_ARC; i++) {
      for (let j = 0; j <= ACROSS_WAFER; j++) {
        vertex(i / ALONG_ARC, j / ACROSS_WAFER, face, inner);
      }
    }
    for (let i = 0; i < ALONG_ARC; i++) {
      for (let j = 0; j < ACROSS_WAFER; j++) {
        const a = offset + i * (ACROSS_WAFER + 1) + j;
        const b = a + ACROSS_WAFER + 1;
        const flip = side * face * (inner ? -1 : 1) > 0;
        indices.push(...(flip ? [a, b, a + 1, b, b + 1, a + 1] : [a, a + 1, b, b, a + 1, b + 1]));
      }
    }
    groups.push({ start, count: indices.length - start, material: inner ? 1 : 0 });
  }

  function ribbon(segments: number, sample: (t: number, back: boolean) => void, material = 0) {
    const start = indices.length;
    const offset = vertices.length / 3;
    for (let i = 0; i <= segments; i++) {
      sample(i / segments, false);
      sample(i / segments, true);
      if (i < segments) {
        const a = offset + i * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    groups.push({ start, count: indices.length - start, material });
  }

  for (const face of [-1, 1] as const) {
    surface(face, false);
    surface(face, true);
    // Only the wafer walls are capped at the break, leaving a hollow interior.
    ribbon(ACROSS_WAFER, (v, inner) => vertex(0, v, face, inner), 2);
  }
  for (const v of [0, 1]) {
    ribbon(ALONG_ARC, (u, back) => vertex(u, v, back ? -1 : 1, false));
  }
  ribbon(ACROSS_WAFER, (v, back) => vertex(1, v, back ? -1 : 1, false));

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  groups.forEach(({ start, count, material }) => geometry.addGroup(start, count, material));
  return geometry;
}

export function makeWaferTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#c7b8a2';
  ctx.fillRect(0, 0, 256, 256);
  let seed = 815;
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 14000; i++) {
    const shade = Math.floor(100 + random() * 145);
    ctx.fillStyle = `rgba(${shade},${shade},${shade},${0.12 + random() * 0.3})`;
    ctx.beginPath();
    ctx.ellipse(random() * 256, random() * 256, 0.3 + random() * 1.4, 0.3 + random(), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}
