"""Keep the intact and fracture variants in separate, valid glTF scenes."""
from pathlib import Path
import json
import struct

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / 'models/fortune-cookie-raw-export.glb'
data = source.read_bytes()
magic, version, length = struct.unpack_from('<III', data)
assert magic == 0x46546C67 and version == 2 and length == len(data)
json_length, json_kind = struct.unpack_from('<II', data, 12)
assert json_kind == 0x4E4F534A
document = json.loads(data[20:20+json_length])
by_name = {node.get('name'): index for index, node in enumerate(document['nodes'])}
assert {'WholeCookie', 'LeftShell', 'RightShell'} <= by_name.keys()
document['scenes'] = [
    {'name': 'Intact cookie', 'nodes': [by_name['WholeCookie']]},
    {'name': 'Fractured cookie', 'nodes': [by_name['LeftShell'], by_name['RightShell']]},
]
document['scene'] = 0
document['asset']['extras'] = {
    'description': 'Reference-modeled hollow baked wafer, with original 2K PBR maps',
    'authoring': 'Blender 4.5 LTS; reproducible source in tools/build_cookie.py',
}
encoded = json.dumps(document, separators=(',', ':')).encode()
encoded += b' ' * ((-len(encoded)) % 4)
rest = data[20+json_length:]
result = struct.pack('<III', magic, version, 20+len(encoded)+len(rest))
result += struct.pack('<II', len(encoded), json_kind) + encoded + rest
out = ROOT / 'models/fortune-cookie-export.glb'
out.write_bytes(result)
print('Prepared intact and fractured model scenes:', out)
