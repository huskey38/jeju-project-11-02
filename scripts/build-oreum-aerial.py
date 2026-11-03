"""사진 없는 오름 4곳의 일반 사진 만들기 (일회성):
    python -I scripts/build-oreum-aerial.py "<제주특별자치도_오름항공뷰_사진_20211209.zip(.crdownload) 경로>"
제주특별자치도 '오름 항공뷰' 360° 드론 파노라마(4096x2048)에서 오름 언덕이 잘 보이는 사진과 방향을 골라,
일반 사진 같은 평면 시점(원근 투영, 1200x800)으로 잘라 public/oreum-photos/<공식 오름 id>.jpg 로 저장합니다.
이름·좌표가 안전하게 일치한 오름만 대상입니다 (파노라마의 촬영 위치와 공식 오름 좌표를 대조해 확인함).
※ 압축 안의 폴더명이 맞고, 같은 압축의 CSV 는 명월오름 5장을 묘산봉으로 잘못 적어 두어 폴더명·사진 속 촬영 위치(EXIF)를 기준으로 삼았습니다.
"""
import io
import os
import sys
import zipfile

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from aerial_view import render  # noqa: E402

Image.MAX_IMAGE_PIXELS = None
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'oreum-photos')

# 공식 오름 id → (압축 안 폴더, 사진 번호, 좌우 방향 yaw°, 위아래 pitch°, 시야각 fov°)
PICKS = {
    162: ('balgeun', 5, -25, -10, 78),     # 밝은오름(상명리)
    345: ('cheona', 5, -55, -12, 78),      # 천아오름(상대리)
    16: ('getgeoli', 1, -15, -10, 78),     # 갯거리오름(명월리)
    135: ('myeongwol', 1, 105, -10, 78),   # 명월오름 — 분화구가 보이는 방향
}

if len(sys.argv) < 2:
    sys.exit(__doc__)
os.makedirs(OUT, exist_ok=True)
z = zipfile.ZipFile(sys.argv[1])
for oid, (folder, num, yaw, pitch, fov) in PICKS.items():
    name = f'{folder}/{folder}_{num:03d}.JPG'
    pano = Image.open(io.BytesIO(z.read(name)))
    img = render(pano, yaw, pitch, fov, 1200, 800)
    path = os.path.join(OUT, f'{oid}.jpg')
    img.save(path, quality=82, optimize=True, progressive=True)
    print(oid, name, '->', os.path.normpath(path), f'{os.path.getsize(path) // 1024}KB')
