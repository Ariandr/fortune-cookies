import * as THREE from 'three';

// A folded semicircular wafer, bent around its pinched middle. Four surfaces
// give each piece a real inner wall, instead of a solid primitive or a flat cutout.
function wafer(x: number, v: number, face: number, inner: boolean): THREE.Vector3 {
  const arch = Math.sqrt(Math.max(0.00001, 1 - x * x));
  const bend = x * 1.55;
  const width = 1.05 * Math.sin(bend);
  const rim = Math.pow(v, 0.86);
  const y = arch * (1.15 * rim - 0.40) - 0.49 * Math.pow(1 - x * x, 4) * v * v + 0.12 * x * x;
  const bowl = 0.69 * (1 - Math.cos(bend));
  const puff = arch * (0.56 * Math.sin(Math.PI * v) + 0.045 * Math.pow(v, 4));
  const thickness = inner ? 0.034 : 0;
  return new THREE.Vector3(width, y * 1.25, bowl + face * (puff - thickness));
}

function finish(vertices: number[], indices: number[]): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const colors = [];
  const color = new THREE.Color();
  for (let i = 0; i < vertices.length; i += 3) {
    const [x, y, z] = vertices.slice(i, i + 3);
    const noise = Math.sin(x * 23 + Math.sin(y * 31) * 2 + z * 19) * Math.sin(z * 37 + y * 17);
    const toast = Math.max(0, Math.sin(x * 5.4 + y * 4.2 + z * 6.5));
    color.setRGB(1 - toast * 0.15 + noise * 0.018, 0.82 - toast * 0.18 + noise * 0.024, 0.53 - toast * 0.17);
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

export function makeCookieHalf(side: -1 | 1): THREE.BufferGeometry {
  const vertices: number[] = [];
  const indices: number[] = [];
  const groups: { start: number; count: number; material: number }[] = [];
  const nx = 48, nv = 40;
  function surface(face: number, inner: boolean) {
    const start = indices.length;
    const offset = vertices.length / 3;
    for (let i = 0; i <= nx; i++) {
      const x = side * i / nx * 0.9998;
      for (let j = 0; j <= nv; j++) {
        const point = wafer(x, j / nv, face, inner);
        // Matching irregular edges form one fracture when the two halves meet.
        point.x += (1 - i / nx) ** 10 * (Math.sin(j * 1.43) + Math.sin(j * 0.63)) * 0.012;
        vertices.push(point.x, point.y, point.z);
      }
    }
    for (let i = 0; i < nx; i++) for (let j = 0; j < nv; j++) {
      const a = offset + i * (nv + 1) + j, b = a + nv + 1;
      const flip = side * face * (inner ? -1 : 1) > 0;
      indices.push(...(flip ? [a, b, a + 1, b, b + 1, a + 1] : [a, a + 1, b, b, a + 1, b + 1]));
    }
    groups.push({ start, count: indices.length - start, material: inner ? 1 : 0 });
  }
  for (const face of [-1, 1]) {
    surface(face, false);
    surface(face, true);
    // Visible wafer thickness along the broken middle and the open lip.
    for (const edge of ['fracture', 'lip']) {
      const start = indices.length;
      const offset = vertices.length / 3;
      for (let i = 0; i <= nv; i++) {
        const x = edge === 'fracture' ? 0 : side * i / nv * 0.9998;
        const v = edge === 'fracture' ? i / nv : 1;
        for (const inner of [false, true]) {
          const p = wafer(x, v, face, inner);
          if (edge === 'fracture') p.x += (Math.sin(i * 1.43) + Math.sin(i * 0.63)) * 0.012;
          vertices.push(p.x, p.y, p.z);
        }
        if (i < nv) {
          const a = offset + i * 2;
          indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      }
      groups.push({ start, count: indices.length - start, material: 0 });
    }
  }
  const geometry = finish(vertices, indices);
  groups.forEach(({start, count, material}) => geometry.addGroup(start, count, material));
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
