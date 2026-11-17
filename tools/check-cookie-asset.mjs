import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const file = new URL('../models/fortune-cookie.glb', import.meta.url);
const data = readFileSync(file);
assert.equal(data.readUInt32LE(0), 0x46546c67, 'Cookie asset must be a GLB');
assert.equal(data.readUInt32LE(4), 2, 'Cookie asset must use glTF 2');
assert.equal(data.readUInt32LE(8), data.length, 'GLB must not be truncated');
assert.equal(data.readUInt32LE(16), 0x4e4f534a, 'GLB must contain a JSON chunk');
const jsonLength = data.readUInt32LE(12);
const gltf = JSON.parse(data.subarray(20, 20 + jsonLength).toString());
for (const name of ['WholeCookie', 'LeftShell', 'RightShell']) {
  assert(gltf.nodes.some((node) => node.name === name && Number.isInteger(node.mesh)), `Missing model part: ${name}`);
}
assert.equal(gltf.scenes.length, 2, 'Intact and fractured variants must stay in separate scenes');
const intactNodes = gltf.scenes[gltf.scene ?? 0].nodes.map((index) => gltf.nodes[index].name);
assert.deepEqual(intactNodes, ['WholeCookie'], 'Default scene must only show the intact cookie');
const fracture = gltf.scenes.find((scene) => scene.name === 'Fractured cookie');
assert(fracture, 'Fracture scene must remain addressable');
assert.deepEqual(fracture.nodes.map((index) => gltf.nodes[index].name).sort(), ['LeftShell', 'RightShell']);
for (const mesh of gltf.meshes) for (const primitive of mesh.primitives) {
  if (gltf.materials[primitive.material]?.normalTexture) assert(Number.isInteger(primitive.attributes.TANGENT), 'Baked normal maps require portable tangent data');
}
assert(gltf.images.length >= 3, 'The asset must include its baked maps');
assert(gltf.images.every((image) => Number.isInteger(image.bufferView) && !image.uri), 'Textures must be embedded for self-contained loading');
assert(gltf.materials.some((material) => material.normalTexture), 'Surface normal detail must be retained');
assert(gltf.materials.some((material) => material.pbrMetallicRoughness?.metallicRoughnessTexture), 'Baked roughness must be retained');
const triangleCount = (mesh) => mesh.primitives.reduce((sum, primitive) => sum + gltf.accessors[primitive.indices].count / 3, 0);
const wholeNode = gltf.nodes.find((node) => node.name === 'WholeCookie');
const count = triangleCount(gltf.meshes[wholeNode.mesh]);
assert(count > 5000 && count < 60000, 'Geometry must retain its authored detail within the web budget');
console.log(`Cookie model valid: ${count.toLocaleString()} intact triangles, ${(data.length / 1048576).toFixed(2)} MiB, embedded PBR maps, two scenes.`);
