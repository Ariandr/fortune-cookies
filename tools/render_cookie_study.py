"""Render camera projections of the same saved intact mesh, without remodeling."""
from pathlib import Path
import bpy
from mathutils import Vector

root = Path(__file__).resolve().parents[1]
scene = bpy.context.scene
whole = bpy.data.objects['WholeCookie']
whole.hide_render = False
for name in ['LeftShell', 'RightShell']:
    bpy.data.objects[name].hide_render = True
scene.cycles.samples = 80
scene.render.resolution_x = 900
scene.render.resolution_y = 900
scene.camera.data.ortho_scale = 3.1
views = {
    'study-c-profile': (-.2, .1, -6.),
    'study-center-fold': (-4., -1.9, 2.8),
    'study-outer-seam': (-2.1, 4.5, 1.5),
}
light_data = bpy.data.lights.new('Back softbox for reverse projection', 'AREA')
light_data.energy = 250
light_data.size = 3
light = bpy.data.objects.new('Back softbox for reverse projection', light_data)
bpy.context.collection.objects.link(light)
light.location = (-2, -2, -4)
light.rotation_euler = (-light.location).to_track_quat('-Z', 'Y').to_euler()
for name, position in views.items():
    bpy.data.objects['Studio backdrop • not exported'].hide_render = position[2] < 0
    scene.camera.location = position
    scene.camera.rotation_euler = (Vector((0, 0, .05)) - scene.camera.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = str(root / 'models' / 'renders' / (name + '.png'))
    bpy.ops.render.render(write_still=True)
print('PROJECTION_STUDY_READY')
