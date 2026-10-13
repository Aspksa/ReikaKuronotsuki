"""Generates web/assets/moon.webp: a procedural, physically-lit Moon (no photo needed).

Terrain = fractal highlands + a power-law field of craters (bowl, raised rim, some central peaks) + dark maria.
Shading = Lambert light on the sphere normal tilted by the terrain gradient, so craters read as relief near the terminator.

    python3 tools/make_moon.py [size] [output]
"""
import sys
import numpy as np
from PIL import Image

SIZE = int(sys.argv[1]) if len(sys.argv) > 1 else 800
OUT = sys.argv[2] if len(sys.argv) > 2 else "web/assets/moon.webp"
rng = np.random.default_rng(1969)
N = SIZE

y, x = np.mgrid[0:N, 0:N].astype(np.float64)
x = (x - (N - 1) / 2) / (N / 2)          # -1..1, +x to the right
y = -(y - (N - 1) / 2) / (N / 2)         # -1..1, +y up
r2 = x * x + y * y


def fractal(beta, seed):
    """Isotropic fractal noise with a 1/f^beta spectrum (done in the Fourier domain)."""
    g = np.random.default_rng(seed).standard_normal((N, N))
    fx = np.fft.fftfreq(N)[:, None]
    fy = np.fft.fftfreq(N)[None, :]
    f = np.sqrt(fx * fx + fy * fy)
    f[0, 0] = 1
    spec = np.fft.fft2(g) / f ** (beta / 2)
    spec[0, 0] = 0
    out = np.real(np.fft.ifft2(spec))
    return (out - out.mean()) / out.std()


# ---- terrain height ----
def lowpass(a, cutoff):
    """Gaussian low-pass in the Fourier domain: cutoff is the std-dev of the kernel in cycles/pixel."""
    fx = np.fft.fftfreq(N)[:, None]
    fy = np.fft.fftfreq(N)[None, :]
    return np.real(np.fft.ifft2(np.fft.fft2(a) * np.exp(-(fx * fx + fy * fy) / (2 * cutoff ** 2))))


# gentle rolling terrain only: fine noise would drown the craters in the shading
height = lowpass(0.0035 * fractal(2.8, 1) + 0.002 * fractal(2.2, 2), 0.06)

# ---- craters: count ~ R^-2, depth ~ 0.2 R, raised rim, a few central peaks ----
def add_crater(cx, cy, R, fresh=1.0):
    global height
    x0, x1 = max(int((cx - 1.6 * R + 1) * N / 2), 0), min(int((cx + 1.6 * R + 1) * N / 2) + 1, N)
    y0, y1 = max(int((1 - (cy + 1.6 * R)) * N / 2), 0), min(int((1 - (cy - 1.6 * R)) * N / 2) + 1, N)
    if x1 <= x0 or y1 <= y0:
        return
    sx, sy = x[y0:y1, x0:x1], y[y0:y1, x0:x1]
    d = np.sqrt((sx - cx) ** 2 + (sy - cy) ** 2) / R
    depth = 0.20 * R * fresh
    bowl = -depth * np.clip(1 - d * d, 0, None) ** 1.1 * (d < 1)
    rim = 0.07 * R * fresh * np.exp(-((d - 1.03) / 0.24) ** 2)
    ejecta = 0.012 * R * fresh * np.clip(1.6 - d, 0, None) * (d >= 1)
    peak = 0.09 * R * np.exp(-(d / 0.12) ** 2) if R > 0.06 and rng.random() < 0.6 else 0
    height[y0:y1, x0:x1] += bowl + rim + ejecta + peak


craters = []
for _ in range(2600):
    R = 0.0065 * (1 - rng.random()) ** (-1 / 2.1)  # steep power law: many small craters, few large
    if R > 0.17:
        continue
    a, b = rng.uniform(-1.05, 1.05, 2)
    if a * a + b * b > 1.05:
        continue
    craters.append((a, b, R))
craters.sort(key=lambda c: -c[2])                  # big first, small ones carve into them
for a, b, R in craters:
    add_crater(a, b, R, fresh=rng.uniform(0.18, 0.9) ** 1.3)   # most craters are old and softened

# ---- albedo: bright highlands, dark smooth maria, bright rays from two young craters ----
highlands = 0.70 + 0.05 * fractal(2.4, 3) + 0.012 * fractal(1.2, 4)
mare_field = lowpass(fractal(3.2, 5), 0.028) * 1.0 + 0.18 * lowpass(fractal(2.6, 6), 0.09)   # broad, smooth basins
mare_field = (mare_field - mare_field.mean()) / mare_field.std()
mare_mask = np.clip((mare_field - 0.5) * 2.6, 0, 1)
# keep maria mostly on the left/centre-top, like the near side
bias = np.clip(0.55 - 0.5 * x + 0.25 * y, 0, 1)
mare_mask = np.clip(mare_mask * (0.4 + bias), 0, 1)
mare_mask = np.clip(mare_mask ** 0.8, 0, 1)
albedo = highlands * (1 - mare_mask) + (0.30 + 0.025 * fractal(2.4, 7)) * mare_mask
height = height * (1 - 0.75 * mare_mask)           # maria are smooth

for (cx, cy, R, n_rays) in [(-0.15, -0.58, 0.075, 26), (0.34, 0.20, 0.05, 18)]:
    ang = np.arctan2(y - cy, x - cx)
    dist = np.sqrt((x - cx) ** 2 + (y - cy) ** 2)
    phases = rng.uniform(0, 2 * np.pi, n_rays)
    rays = sum(np.exp(-((((ang - p + np.pi) % (2 * np.pi)) - np.pi) / 0.035) ** 2) for p in phases) / 3
    albedo += 0.18 * np.clip(rays, 0, 1) * np.exp(-dist / 0.55) * (dist > R * 0.9)
    add_crater(cx, cy, R, fresh=1.2)
    albedo += 0.22 * np.exp(-(dist / (R * 1.5)) ** 2)

albedo = np.clip(albedo, 0.12, 1.0)

# ---- lighting ----
inside = r2 <= 1.0
z = np.sqrt(np.clip(1 - r2, 0, 1))
gy, gx = np.gradient(lowpass(height, 0.35), 2.0 / N)  # d height / d unit (slightly smoothed)
bump = 2.6                                          # exaggerate relief a little
nx, ny, nz = -bump * gx + x, -bump * gy + y, z + 1e-3
nz = np.where(inside, np.maximum(nz, 0.02), 1.0)
norm = np.sqrt(nx * nx + ny * ny + nz * nz)
nx, ny, nz = nx / norm, ny / norm, nz / norm
L = np.array([-0.40, 0.30, 0.866])                  # light from the upper left, nearly full
L /= np.linalg.norm(L)
lam = np.clip(nx * L[0] + ny * L[1] + nz * L[2], 0, 1)
sphere = np.clip(x * L[0] + y * L[1] + z * L[2], 0, 1)
lit = 0.30 * lam ** 0.9 + 0.70 * sphere ** 0.55 * (0.45 + 0.55 * lam)   # soft terminator, relief still visible
earthshine = 0.035
shade = np.clip(lit + earthshine * (1 - sphere), 0, 1.15)

warm = np.array([1.00, 0.965, 0.90])                # moonlight colour
cool = np.array([0.80, 0.86, 1.00])                 # earthshine / shadows
tint = np.array([1.0, 1.0, 1.0])[None, None, :] * (1 - mare_mask[..., None]) + np.array([0.90, 0.95, 1.04])[None, None, :] * mare_mask[..., None]   # maria are a touch bluer
col = albedo[..., None] * shade[..., None] * warm[None, None, :] * tint
col += (earthshine * 0.6 * albedo * (1 - sphere))[..., None] * cool[None, None, :]
col = col * 1.55
col = col / (1 + 0.28 * col)                       # filmic shoulder: bright highlands, no clipping
col = np.clip(col, 0, 1) ** (1 / 1.08)

# soft anti-aliased edge
rr = np.sqrt(r2)
alpha = np.clip((1.0 - rr) * N / 2.0, 0, 1)
rgba = np.dstack([col, alpha])
img = Image.fromarray((rgba * 255 + 0.5).astype(np.uint8), "RGBA")
img.save(OUT, "WEBP", quality=88, method=6)
print(OUT, img.size)
