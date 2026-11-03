"""360° 파노라마(등장방형, 2:1)에서 일반 사진 같은 평면 시점(원근 투영)을 잘라 내는 함수 — scripts/build-oreum-aerial.py 가 씀
번호: yaw(좌우 방향, 도, 파노라마 가운데가 0·오른쪽이 +), pitch(위아래, 도, 위가 +), fov(가로 시야각, 도)
"""
import numpy as np
from PIL import Image


def render(pano, yaw, pitch, fov, out_w, out_h):
    src = np.asarray(pano.convert('RGB'), dtype=np.float32)
    H, W, _ = src.shape
    f = (out_w / 2) / np.tan(np.radians(fov) / 2)
    xs = (np.arange(out_w) - (out_w - 1) / 2)[None, :].repeat(out_h, 0)
    ys = ((out_h - 1) / 2 - np.arange(out_h))[:, None].repeat(out_w, 1)
    zs = np.full_like(xs, f)
    # 카메라 좌표 → 피치(x축 회전) → 요(y축 회전)
    p, y = np.radians(pitch), np.radians(yaw)
    y1 = ys * np.cos(p) + zs * np.sin(p)
    z1 = -ys * np.sin(p) + zs * np.cos(p)
    x2 = xs * np.cos(y) + z1 * np.sin(y)
    z2 = -xs * np.sin(y) + z1 * np.cos(y)
    lon = np.arctan2(x2, z2)
    lat = np.arctan2(y1, np.sqrt(x2 ** 2 + z2 ** 2))
    u = (lon / (2 * np.pi) + 0.5) * W - 0.5
    v = (0.5 - lat / np.pi) * H - 0.5
    u0 = np.floor(u).astype(int); v0 = np.clip(np.floor(v).astype(int), 0, H - 2)
    du = (u - u0)[..., None]; dv = (v - v0)[..., None]
    u0m = u0 % W; u1m = (u0 + 1) % W
    top = src[v0, u0m] * (1 - du) + src[v0, u1m] * du
    bot = src[v0 + 1, u0m] * (1 - du) + src[v0 + 1, u1m] * du
    return Image.fromarray(np.clip(top * (1 - dv) + bot * dv, 0, 255).astype(np.uint8))
