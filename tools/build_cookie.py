"""Author a reference-led, hollow folded-wafer asset with Blender 4.5 LTS.

Run: blender --background --factory-startup --python tools/build_cookie.py
The GLB uses X/Y in the reference plane and +Z toward the viewer, matching Three.js.
The .blend retains the sculpt meshes, thickness/optimization modifiers, PBR maps,
and a Cycles studio setup. No reference photograph is redistributed.
"""
from pathlib import Path
import bpy
import bmesh
import sys
import math
from mathutils import Vector
from mathutils.noise import noise_vector

ROOT = Path(__file__).resolve().parents[1]
MODELS = ROOT / 'models'
TEXTURES = MODELS / 'textures'
RENDERS = MODELS / 'renders'
RENDERS.mkdir(parents=True, exist_ok=True)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for data in list(bpy.data.materials):
    bpy.data.materials.remove(data)

# Begin with a doubled semicircular wafer and bend its two quarter-disc wings
# around the pinched center. The UVs retain the original flat wafer coordinates,
# so the baked rim and surface grain follow the fold on both sides.
NU = 100
NV = 50


def smooth(a, b, value):
    t = min(1., max(0., (value - a) / (b - a)))
    return t * t * (3 - 2 * t)


def wafer_uv(u, v, side, face):
    s = min(u, .99998)
    arch = math.sqrt(1 - s*s)
    return ((side*s*1.115+1.27)/2.54, (face*arch*v*1.115+1.27)/2.54)


def sample(u, v, side, face):
    s = min(u, .99998)
    arch = math.sqrt(1 - s*s)
    rounded = (math.sqrt(s*s + .15**2) - .15) / (math.sqrt(1 + .15**2) - .15)
    inner = .48 * (1 - rounded)
    y = ((1-v)*inner + v*arch) * 1.85 - .88
    bend = math.radians(56) + side*.045*math.sin(s*math.pi)
    puff = math.pow(max(0., math.sin(math.pi*v)), .9) * math.pow(max(0., math.sin(math.pi*s)), 1.15)
    skin = face * (.017 + ( .26 if face == 1 else .22 ) * puff)
    return_blend = smooth(0., .18, s)
    # Keep the inward skin inside its own wing at the tight central saddle.
    if face == 1:
        limit = .72*s*math.cos(bend)/math.sin(bend) + .017
        skin = limit * math.tanh(skin / limit)
    x = side * ((s - .22*s**4)*math.cos(bend) - math.sin(bend)*skin*return_blend) * 2.25
    fold_curve = (math.sqrt(s*s + .12**2) - .12) / (math.sqrt(1 + .12**2) - .12)
    z = fold_curve*math.sin(bend) + math.cos(bend)*skin - .28
    # Unequal wing curvature and small ripples reproduce hand folding.
    z += side*.012*math.sin(math.pi*s)*math.sin(math.pi*v)
    warp = noise_vector(Vector((s*5.1, v*4.4, face*.7)))
    z += warp.z*.0045*math.sin(math.pi*v)*math.sin(math.pi*s)
    chip = (math.sin(s*94+.6)*math.sin(s*137)*.0016 + math.sin(s*61)*.0012)
    y += chip*smooth(.9, 1, v)
    x += (math.sin(v*37)+math.sin(v*79))*.0038*math.sin(math.pi*v)*math.pow(1-s, 20)
    return (x, y, z)


def image_texture(nodes, name, filename, colorspace):
    image = bpy.data.images.load(str(TEXTURES / filename), check_existing=True)
    image.colorspace_settings.name = colorspace
    node = nodes.new('ShaderNodeTexImage')
    node.name = name
    node.label = name
    node.image = image
    node.interpolation = 'Linear'
    return node


wafer = bpy.data.materials.new('Baked wafer • original PBR')
wafer.use_nodes = True
nodes = wafer.node_tree.nodes
links = wafer.node_tree.links
principled = nodes.get('Principled BSDF')
principled.inputs['Roughness'].default_value = .85
principled.inputs['Specular IOR Level'].default_value = .25
principled.inputs['Subsurface Weight'].default_value = .025
base = image_texture(nodes, 'Golden bake and flour-like grain', 'wafer-color.jpg', 'sRGB')
normal = image_texture(nodes, 'Microscopic pores and bake bubbles', 'wafer-normal.png', 'Non-Color')
packed = image_texture(nodes, 'Packed occlusion / roughness / metallic', 'wafer-orm.png', 'Non-Color')
normal_map = nodes.new('ShaderNodeNormalMap')
normal_map.inputs['Strength'].default_value = 1.15
separate = nodes.new('ShaderNodeSeparateColor')
links.new(base.outputs['Color'], principled.inputs['Base Color'])
links.new(normal.outputs['Color'], normal_map.inputs['Color'])
links.new(normal_map.outputs['Normal'], principled.inputs['Normal'])
links.new(packed.outputs['Color'], separate.inputs['Color'])
links.new(separate.outputs['Green'], principled.inputs['Roughness'])
links.new(separate.outputs['Blue'], principled.inputs['Metallic'])

inside = wafer.copy()
inside.name = 'Inside wafer • warm shade'
inside.node_tree.nodes.get('Principled BSDF').inputs['Subsurface Weight'].default_value = 0
# Color remains image-based, so the GLB retains a physically shaded material.
inside.diffuse_color = (.62, .37, .12, 1)
inside.node_tree.nodes.get('Golden bake and flour-like grain').image = bpy.data.images.load(str(TEXTURES / 'wafer-inside-color.jpg'), check_existing=True)
edge = wafer.copy()
edge.name = 'Crisp wafer edges • toasted rim and pale fracture'
edge_shader = edge.node_tree.nodes.get('Principled BSDF')
for link in list(edge.node_tree.links):
    if link.to_socket == edge_shader.inputs['Roughness']:
        edge.node_tree.links.remove(link)
edge_shader.inputs['Roughness'].default_value = .96
edge_shader.inputs['Subsurface Weight'].default_value = 0
edge_shader.inputs['Specular IOR Level'].default_value = .2
for node in edge.node_tree.nodes:
    if node.type == 'NORMAL_MAP':
        node.inputs['Strength'].default_value = 1.4

shells = []
for side, name in [(-1, 'LeftShell'), (1, 'RightShell')]:
    vertices, faces, vertex_uvs = [], [], []
    for face in [1, -1]:
        offset = len(vertices)
        for i in range(NU + 1):
            for j in range(NV + 1):
                vertices.append(sample(i/NU, j/NV, side, face))
                vertex_uvs.append(wafer_uv(i/NU, j/NV, side, face))
        for i in range(NU):
            for j in range(NV):
                a = offset + i * (NV+1) + j
                b = a + NV+1
                indices = (a, b, b+1, a+1)
                if side * face < 0:
                    indices = tuple(reversed(indices))
                faces.append(indices)
    # Join only the inward fold, with a tiny rounded return. The outside lips
    # remain separate and reveal the hollow pocket between the wafer layers.
    front = 0
    back = (NU+1) * (NV+1)
    for i in range(NU):
        a = front + i * (NV+1)
        b = back + i * (NV+1)
        indices = (a, b, b+NV+1, a+NV+1)
        if side < 0:
            indices = tuple(reversed(indices))
        faces.append(indices)
    mesh = bpy.data.meshes.new(name + ' • sculpt surface')
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(wafer)
    obj.data.materials.append(inside)
    obj.data.materials.append(edge)
    uv = mesh.uv_layers.new(name='Wafer UV')
    for polygon in mesh.polygons:
        polygon.use_smooth = True
        for loop in polygon.loop_indices:
            uv.data[loop].uv = vertex_uvs[mesh.loops[loop].vertex_index]
    solid = obj.modifiers.new('Real baked wafer thickness • 0.012', 'SOLIDIFY')
    solid.thickness = .012
    solid.offset = -1
    solid.use_even_offset = True
    solid.material_offset = 1
    solid.material_offset_rim = 2
    decimate = obj.modifiers.new('Web topology • silhouette preserved', 'DECIMATE')
    decimate.ratio = .42
    decimate.use_collapse_triangulate = True
    obj['reference'] = 'Hollow doubled wafer, rounded central pinch, tapered wings and toasted lips'
    obj['wall_thickness'] = .012
    shells.append(obj)

# The intact mesh is welded before thickness and optimization. It has no visible
# center seam; the two matching breakable variants are kept in a second glTF scene.
all_vertices, all_faces, all_uvs = [], [], []
for shell in shells:
    offset = len(all_vertices)
    all_vertices.extend(tuple(vertex.co) for vertex in shell.data.vertices)
    all_faces.extend(tuple(offset + index for index in polygon.vertices) for polygon in shell.data.polygons)
    all_uvs.extend(tuple(item.uv) for item in shell.data.uv_layers.active.data)
whole_mesh = bpy.data.meshes.new('WholeCookie • welded sculpt')
whole_mesh.from_pydata(all_vertices, [], all_faces)
whole_mesh.update()
whole_uv = whole_mesh.uv_layers.new(name='Wafer UV')
for index, value in enumerate(all_uvs):
    whole_uv.data[index].uv = value
bm = bmesh.new()
bm.from_mesh(whole_mesh)
bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=.00006)
bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
bm.to_mesh(whole_mesh)
bm.free()
whole_mesh.update()
whole = bpy.data.objects.new('WholeCookie', whole_mesh)
bpy.context.collection.objects.link(whole)
for mat in [wafer, inside, edge]:
    whole.data.materials.append(mat)
for polygon in whole_mesh.polygons:
    polygon.use_smooth = True
solid = whole.modifiers.new('Real baked wafer thickness • 0.012', 'SOLIDIFY')
solid.thickness = .012
solid.offset = -1
solid.use_even_offset = True
solid.material_offset = 1
solid.material_offset_rim = 2
decimate = whole.modifiers.new('Web topology • silhouette preserved', 'DECIMATE')
decimate.ratio = .42
decimate.use_collapse_triangulate = True
bpy.ops.object.select_all(action='DESELECT')
for obj in shells + [whole]:
    obj.select_set(True)
bpy.context.view_layer.objects.active = whole
bpy.ops.export_scene.gltf(
    filepath=str(MODELS / 'fortune-cookie-raw-export.glb'), export_format='GLB',
    use_selection=True, export_apply=True, export_yup=False,
    export_texcoords=True, export_normals=True, export_tangents=True, export_materials='EXPORT',
    export_image_format='AUTO', export_extras=True,
)
for shell in shells:
    shell.hide_render = True
    shell.hide_set(True)
whole.rotation_euler.z = .45 + math.pi/2

# A neutral studio makes thickness and surface relief inspectable in the .blend.
def material(name, color, roughness=1):
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    shader = result.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    return result

depsgraph = bpy.context.evaluated_depsgraph_get()
evaluated = whole.evaluated_get(depsgraph)
lowest = min(vertex.co.z for vertex in evaluated.data.vertices)
bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, lowest - .014))
floor = bpy.context.object
floor.name = 'Studio backdrop • not exported'
floor.data.materials.append(material('Warm porcelain', (.76, .73, .66)))

def aim(obj, point=(0, 0, 0)):
    obj.rotation_euler = (Vector(point) - obj.location).to_track_quat('-Z', 'Y').to_euler()

def area(name, location, power, size, color):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy = power
    data.shape = 'DISK'
    data.size = size
    data.color = color
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    aim(obj)

area('Large softbox • left', (-3.0, -3.0, 5.5), 350, 2.3, (1, .94, .83))
area('Soft fill', (3, 1, 4), 180, 4, (.92, .96, 1))
area('Rim strip', (-1, 4, 3), 250, 2, (1, .84, .63))
world = bpy.data.worlds.new('Neutral studio')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (.79, .81, .84, 1)
world.node_tree.nodes['Background'].inputs[1].default_value = .15
bpy.context.scene.world = world
camera_data = bpy.data.cameras.new('Model study camera')
camera = bpy.data.objects.new('Model study camera', camera_data)
bpy.context.collection.objects.link(camera)
camera.location = (.45, -2.0, 6.2)
aim(camera, (0, .05, .03))
camera_data.type = 'ORTHO'
camera_data.ortho_scale = 3.15
scene = bpy.context.scene
scene.camera = camera
scene.render.engine = 'CYCLES'
scene.cycles.samples = 128
scene.cycles.use_denoising = True
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'METAL'
    prefs.get_devices()
    for device in prefs.devices:
        device.use = device.type == 'METAL'
    if any(device.type == 'METAL' for device in prefs.devices):
        scene.cycles.device = 'GPU'
except Exception as error:
    print('Rendering with CPU:', error)
scene.render.resolution_x = 1100
scene.render.resolution_y = 1100
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.view_settings.view_transform = 'AgX'
# Keep asset and packed texture paths portable when opened on another computer.
for image in bpy.data.images:
    if image.source == 'FILE':
        image.pack()
bpy.ops.wm.save_as_mainfile(filepath=str(MODELS / 'fortune-cookie.blend'))
scene.render.filepath = str(RENDERS / 'cookie-front.png')
bpy.ops.render.render(write_still=True)
if '--draft' in sys.argv:
    print('MODEL_DRAFT_READY')
    raise SystemExit(0)
# A lower view exposes the rolled fold and the hollow pocket under the shell.
camera.location = (2.7, -3.6, 3.2)
aim(camera, (0, 0, .06))
scene.render.filepath = str(RENDERS / 'cookie-three-quarter.png')
bpy.ops.render.render(write_still=True)
# An exploded view verifies that the two actual GLB pieces meet and separate.
whole.hide_render = True
for shell in shells:
    shell.hide_render = False
    shell.hide_set(False)
shells[0].location.x = -.33
shells[1].location.x = .33
shells[0].rotation_euler.z = -.14
shells[1].rotation_euler.z = .14
camera.location = (.3, -2.3, 5.8)
aim(camera, (0, 0, .02))
camera_data.ortho_scale = 3.85
scene.render.filepath = str(RENDERS / 'cookie-open.png')
bpy.ops.render.render(write_still=True)
print('MODEL_READY', str(MODELS / 'fortune-cookie-raw-export.glb'))
