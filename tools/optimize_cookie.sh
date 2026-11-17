#!/bin/sh
# Run from the project root after build_cookie.py finishes.
set -eu
python3 tools/prepare_glb.py
npx --yes @gltf-transform/cli@4.5.1 webp models/fortune-cookie-export.glb models/fortune-cookie-color-export.glb --quality=94 --effort=85 --slots=baseColorTexture
npx --yes @gltf-transform/cli@4.5.1 webp models/fortune-cookie-color-export.glb models/fortune-cookie-roughness-export.glb --quality=94 --effort=85 --slots=metallicRoughnessTexture
npx --yes @gltf-transform/cli@4.5.1 webp models/fortune-cookie-roughness-export.glb models/fortune-cookie-texture-export.glb --lossless=true --effort=85 --slots=normalTexture
npx --yes @gltf-transform/cli@4.5.1 tangents models/fortune-cookie-texture-export.glb models/fortune-cookie-tangent-export.glb
npx --yes @gltf-transform/cli@4.5.1 optimize models/fortune-cookie-tangent-export.glb models/fortune-cookie.glb --compress=meshopt --texture-compress=false --flatten=false --instance=false --join=false --palette=false --simplify=false
node tools/check-cookie-asset.mjs
