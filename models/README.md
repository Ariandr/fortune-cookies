# Fortune cookie model

A reference-modeled, hollow folded wafer, authored in Blender 4.5 LTS. The latest multi-angle reference guided the two curved wings, deep center pinch, tapered tips, and separated toasted lips.

- `fortune-cookie.blend`: editable source with packed textures, thickness and web-topology modifiers, and a Cycles studio scene.
- `fortune-cookie.glb`: web asset, including the intact cookie and two matching breakable pieces.
- `renders/`: front, three-quarter, separated-shell, and camera-only projection studies. Each intact view uses the same mesh.

The reference photographs are not redistributed. All mesh and texture content is original. The color, normal, and roughness maps are generated reproducibly from a fixed seed. UVs follow the original flat wafer before folding, including the reverse side.

## Rebuild

Requires Blender 4.5 LTS, Python with NumPy and Pillow, and Node/npm.

```sh
python3 tools/texture_cookie.py
blender --background --factory-startup --python tools/build_cookie.py
blender --background models/fortune-cookie.blend --python tools/render_cookie_study.py
sh tools/optimize_cookie.sh
npm run check:model
```

The last step uses glTF Transform 4.5.1 to compress color and roughness maps, retain lossless normal-map detail, and apply Meshopt geometry compression. Named objects and the two scenes are preserved. Generated staging GLBs and texture source files are ignored; the `.blend` embeds its texture images.

## Asset contract

The default glTF scene contains only `WholeCookie`, a welded intact mesh with no center fracture line. The second scene, `Fractured cookie`, contains `LeftShell` and `RightShell`. All three use the same origin and coordinate system: X horizontal, Y up in the main camera view, and +Z toward the viewer.

The website shares mesh data and PBR textures between ten independent object transforms. When a cookie cracks, its intact mesh is replaced with the matching halves. The standalone viewer exposes the same split continuously for inspection.

Model maps are embedded in the GLB. The Meshopt decoder is bundled with the application; no runtime modeling service, remote decoder, or texture host is required. Vite fingerprints the asset URL when it changes.
