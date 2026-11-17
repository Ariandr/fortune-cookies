import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import cookieModelUrl from '../../models/fortune-cookie.glb?url';

export const COOKIE_MODEL_URL = cookieModelUrl;

export interface CookieModel {
  whole: THREE.Object3D;
  left: THREE.Object3D;
  right: THREE.Object3D;
  triangles: number;
}

export function useCookieModel(): CookieModel {
  // Meshopt's decoder is bundled locally. No external Draco service is needed.
  const gltf = useGLTF(COOKIE_MODEL_URL, false, true);
  return useMemo(() => {
    function find(name: string): THREE.Object3D {
      const object = gltf.scenes.map((scene) => scene.getObjectByName(name)).find(Boolean);
      if (!object) throw new Error(`Cookie asset is missing ${name}`);
      return object;
    }
    const whole = find('WholeCookie');
    const left = find('LeftShell');
    const right = find('RightShell');
    let triangles = 0;
    whole.traverse((object) => {
      if (object instanceof THREE.Mesh) triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
    });
    const materials = new Set<THREE.MeshStandardMaterial>();
    for (const scene of gltf.scenes) scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = true;
      object.receiveShadow = true;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (material instanceof THREE.MeshStandardMaterial) materials.add(material);
      }
    });
    materials.forEach((material) => {
      material.envMapIntensity = .55;
      for (const texture of [material.map, material.normalMap, material.roughnessMap]) {
        if (texture) texture.anisotropy = 4;
      }
    });
    return { whole, left, right, triangles };
  }, [gltf]);
}

export function cloneCookiePart(template: THREE.Object3D): THREE.Object3D {
  // Object transforms are independent; geometry, baked maps, and materials stay shared.
  return template.clone(true);
}
