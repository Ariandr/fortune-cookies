"""Create reproducible, image-based PBR maps for the authored wafer shell.

No lighting or shadows are baked into the color. All texture detail is original;
the supplied photograph is used as a visual modeling reference, not copied.
"""
from pathlib import Path
import numpy as np
from PIL import Image

SIZE = 2048
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'models' / 'textures'
OUT.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(84172)

def noise(cells):
    grid = rng.random((cells + 2, cells + 2), dtype=np.float32)
    coordinate = np.arange(SIZE, dtype=np.float32) * cells / SIZE
    index = coordinate.astype(np.int32)
    weight = coordinate - index
    weight = weight * weight * (3 - 2 * weight)
    top = grid[index[:, None], index[None, :]] * (1 - weight[None, :]) + grid[index[:, None], index[None, :] + 1] * weight[None, :]
    bottom = grid[index[:, None] + 1, index[None, :]] * (1 - weight[None, :]) + grid[index[:, None] + 1, index[None, :] + 1] * weight[None, :]
    return top * (1 - weight[:, None]) + bottom * weight[:, None]

def smooth(a, b, value):
    t = np.clip((value - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)

macro = noise(4) * .46 + noise(11) * .32 + noise(29) * .22
mottle = noise(91)
grain = noise(610)
fine = noise(1024)
height = (grain - .5) * .24 + (fine - .5) * .07 + (mottle - .5) * .08
pores = np.zeros((SIZE, SIZE), dtype=np.float32)
# Small, irregular bake bubbles and pinprick pores, with occasional larger blisters.
for number in range(5800):
    cx, cy = rng.integers(0, SIZE, 2)
    radius = rng.uniform(.8, 2.8) if number < 5500 else rng.uniform(3.5, 7.5)
    reach = int(radius * 3) + 1
    x0, x1 = max(0, cx - reach), min(SIZE, cx + reach + 1)
    y0, y1 = max(0, cy - reach), min(SIZE, cy + reach + 1)
    yy, xx = np.mgrid[y0:y1, x0:x1]
    d = ((xx - cx) / radius) ** 2 + ((yy - cy) / (radius * rng.uniform(.65, 1.15))) ** 2
    bowl = np.exp(-d * 1.5)
    ring = np.exp(-((np.sqrt(d) - 1.1) / .3) ** 2) * .12
    depth = rng.uniform(.2, .85)
    pores[y0:y1, x0:x1] += bowl * depth
    height[y0:y1, x0:x1] += ring * depth - bowl * depth

axis = np.linspace(-1.27, 1.27, SIZE, dtype=np.float32)
x, y = np.meshgrid(axis, -axis)
radius = np.sqrt(x*x + y*y)
edge = smooth(1.00, 1.12, radius)
blush = np.clip((macro - .44) * 1.65, 0, .62)
cream = np.array([248, 232, 207], dtype=np.float32)
gold = np.array([237, 207, 161], dtype=np.float32)
toast = np.array([233, 142, 43], dtype=np.float32)
color = cream[None, None, :] * (1 - blush[:, :, None]) + gold[None, None, :] * blush[:, :, None]
browning = np.clip(edge ** 1.8 * .86 + smooth(.67, .91, mottle) * .035, 0, .76)
color = color * (1 - browning[:, :, None]) + toast[None, None, :] * browning[:, :, None]
# Fine color variation follows the actual surface pores, not a painted dot overlay.
color += ((grain - .5) * 10 + (fine - .5) * 4 - pores * 14)[:, :, None]
flakes = smooth(.72, .93, fine) * smooth(.45, .8, mottle)
color += flakes[:, :, None] * np.array([18, 21, 25], dtype=np.float32)
Image.fromarray(np.clip(color, 0, 255).astype(np.uint8)).save(OUT / 'wafer-color.jpg', quality=94, subsampling=0, optimize=True)
Image.fromarray(np.clip(color * np.array([.70, .65, .57], dtype=np.float32), 0, 255).astype(np.uint8)).save(OUT / 'wafer-inside-color.jpg', quality=92, subsampling=0, optimize=True)

world_texel = 2.54 / SIZE
# Real-world relief stays below a tenth of a millimeter at cookie scale.
dy, dx = np.gradient(height * .0028, world_texel)
normal = np.stack([-dx, dy, np.ones_like(dx)], axis=-1)
normal /= np.linalg.norm(normal, axis=-1, keepdims=True)
Image.fromarray(np.clip((normal * .5 + .5) * 255, 0, 255).astype(np.uint8)).save(OUT / 'wafer-normal.png', optimize=True)
roughness = np.clip(.84 + (grain - .5) * .17 + pores * .045 - edge * .035, .73, .97)
orm = np.stack([np.clip(1 - pores * .04, .93, 1), roughness, np.zeros_like(roughness)], axis=-1)
Image.fromarray((orm * 255).astype(np.uint8)).save(OUT / 'wafer-orm.png', optimize=True)
print('Generated original 2K color, normal, and roughness maps:', OUT)
