"""Render a small product-style still life (numpy sphere tracing) used as the demo image.

Usage: python3 scripts/make-demo.py public/demo.png
"""
import sys
import numpy as np
from PIL import Image

W, H = 1440, 960
out = sys.argv[1] if len(sys.argv) > 1 else "public/demo.png"


def norm(v):
    return v / np.linalg.norm(v, axis=-1, keepdims=True)


def sd_round_box(p, b, r):
    q = np.abs(p) - b
    return np.linalg.norm(np.maximum(q, 0.0), axis=-1) + np.minimum(np.max(q, axis=-1), 0.0) - r


def sd_torus_xy(p, R, r):
    # torus standing up, ring lies in the XY plane
    q = np.stack([np.linalg.norm(p[..., [0, 1]], axis=-1) - R, p[..., 2]], axis=-1)
    return np.linalg.norm(q, axis=-1) - r


def sd_cyl(p, r, h):
    d = np.stack([np.linalg.norm(p[..., [0, 2]], axis=-1) - r, np.abs(p[..., 1]) - h], axis=-1)
    return np.minimum(np.max(d, axis=-1), 0.0) + np.linalg.norm(np.maximum(d, 0.0), axis=-1)


OBJ = [
    # (sdf, base colour, specular)
    (lambda p: np.linalg.norm(p - np.array([-1.45, 0.9, 0.35]), axis=-1) - 0.9, (0.93, 0.42, 0.16), 0.6),
    (lambda p: sd_round_box(p - np.array([0.55, 0.62, -0.1]), np.array([0.62, 0.52, 0.62]), 0.1), (0.88, 0.87, 0.84), 0.35),
    (lambda p: sd_torus_xy(p - np.array([2.15, 0.78, -0.55]), 0.6, 0.17), (0.16, 0.33, 0.85), 0.8),
    (lambda p: sd_cyl(p - np.array([0.05, 0.36, 1.45]), 0.38, 0.36), (0.13, 0.13, 0.14), 0.5),
    (lambda p: np.linalg.norm(p - np.array([1.45, 0.24, 1.25]), axis=-1) - 0.24, (0.95, 0.78, 0.2), 0.7),
]


def scene(p):
    ds = np.stack([o[0](p) for o in OBJ] + [p[..., 1]], axis=-1)  # last = ground
    return ds.min(axis=-1), ds.argmin(axis=-1)


def normal(p):
    e = 1e-3
    ex, ey, ez = np.array([e, 0, 0]), np.array([0, e, 0]), np.array([0, 0, e])
    n = np.stack([
        scene(p + ex)[0] - scene(p - ex)[0],
        scene(p + ey)[0] - scene(p - ey)[0],
        scene(p + ez)[0] - scene(p - ez)[0],
    ], axis=-1)
    return norm(n)


ys, xs = np.mgrid[0:H, 0:W].astype(np.float64)
u = (xs - W / 2) / H
v = -(ys - H / 2) / H
cam = np.array([0.2, 2.5, 6.4])
target = np.array([0.35, 0.55, 0.0])
fwd = norm(target - cam)
right = norm(np.cross(fwd, np.array([0, 1.0, 0])))
up = np.cross(right, fwd)
rd = norm(u[..., None] * right + v[..., None] * up + 1.55 * fwd)
ro = np.broadcast_to(cam, rd.shape).copy()

t = np.zeros((H, W))
hit = np.zeros((H, W), bool)
alive = np.ones((H, W), bool)
for _ in range(110):
    p = ro + rd * t[..., None]
    d, _ = scene(p)
    hit |= alive & (d < 1e-3)
    alive &= ~hit & (t < 30)
    t = np.where(alive, t + d * 0.9, t)

p = ro + rd * t[..., None]
_, mid = scene(p)
n = normal(p)
L = norm(np.array([-0.55, 0.85, 0.45]))

# soft shadow
sh = np.ones((H, W))
st = np.full((H, W), 0.02)
for _ in range(48):
    q = p + n * 2e-3 + L * st[..., None]
    d, _ = scene(q)
    sh = np.minimum(sh, np.clip(10 * d / st, 0, 1))
    st += np.clip(d, 0.02, 0.25)
sh = np.clip(sh, 0, 1)

# ambient occlusion
ao = np.ones((H, W))
for i in range(1, 6):
    h = 0.06 * i
    d, _ = scene(p + n * h)
    ao -= (h - d) * (0.5 ** i) * 3.2
ao = np.clip(ao, 0, 1)

base = np.zeros((H, W, 3))
spec_k = np.zeros((H, W))
for i, (_, c, s) in enumerate(OBJ):
    m = mid == i
    base[m] = c
    spec_k[m] = s
g = mid == len(OBJ)
checker = ((np.floor(p[..., 0] * 1.0) + np.floor(p[..., 2] * 1.0)) % 2)
base[g] = (np.array([0.80, 0.79, 0.76]) * (0.96 + 0.04 * checker[g, None]))
spec_k[g] = 0.05

diff = np.clip((n * L).sum(-1), 0, 1) * sh
hv = norm(L - rd)
spec = np.clip((n * hv).sum(-1), 0, 1) ** 60 * spec_k * sh
sky = 0.5 + 0.5 * n[..., 1]
fres = (1 - np.clip(-(n * rd).sum(-1), 0, 1)) ** 4
col = base * (0.95 * diff[..., None] * np.array([1.0, 0.96, 0.9]) + 0.38 * sky[..., None] * ao[..., None] * np.array([0.75, 0.82, 1.0]))
col += spec[..., None] + 0.12 * fres[..., None] * ao[..., None]

bg = np.array([0.86, 0.85, 0.82]) * (1 - 0.18 * (ys / H))[..., None]
fog = np.clip((t - 5) / 14, 0, 1)[..., None]
col = np.where(hit[..., None], col * (1 - fog) + bg * fog, bg)
col = np.clip(col, 0, 1) ** (1 / 2.2)
Image.fromarray((col * 255).astype(np.uint8)).save(out)
print("wrote", out)
