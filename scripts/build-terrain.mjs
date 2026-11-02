// 제주 높이맵·위성 텍스처 생성 (일회성): node scripts/build-terrain.mjs
//   높이: AWS Terrain Tiles (Terrarium)  https://registry.opendata.aws/terrain-tiles/
//   위성: EOX Sentinel-2 cloudless 2020  (c) EOX IT Services GmbH, contains modified Copernicus Sentinel data 2020, CC BY 4.0
// 타일은 웹 메르카토르라서, src/lib/geo.js 의 선형 위경도 좌표와 맞도록 재투영해 저장합니다.
import sharp from 'sharp'
import { mkdir, writeFile } from 'node:fs/promises'

const Z = 11
const BBOX = { w: 126.05, e: 127.05, s: 33.03, n: 33.73 } // 중심 (126.55, 33.38) — geo.js 와 동일
const N = 2 ** Z
const tileX = (lon) => ((lon + 180) / 360) * N
const tileY = (lat) => {
  const r = (lat * Math.PI) / 180
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * N
}

const x0 = Math.floor(tileX(BBOX.w)), x1 = Math.floor(tileX(BBOX.e))
const y0 = Math.floor(tileY(BBOX.n)), y1 = Math.floor(tileY(BBOX.s))
const W = (x1 - x0 + 1) * 256, H = (y1 - y0 + 1) * 256

async function mosaic(urlOf) {
  const buf = Buffer.alloc(W * H * 3)
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const res = await fetch(urlOf(tx, ty))
      if (!res.ok) throw new Error(`${res.status} ${urlOf(tx, ty)}`)
      const raw = await sharp(Buffer.from(await res.arrayBuffer())).removeAlpha().raw().toBuffer()
      for (let r = 0; r < 256; r++)
        raw.copy(buf, ((ty - y0) * 256 + r) * W * 3 + (tx - x0) * 256 * 3, r * 256 * 3, (r + 1) * 256 * 3)
    }
  }
  return buf
}

// 선형 위경도 격자(outW x outH)로 이중선형 샘플링. sample(px,py) → [r,g,b] 를 호출해 결과 RGB 버퍼 반환
function reproject(src, outW, outH, convert = (c) => c) {
  const out = Buffer.alloc(outW * outH * 3)
  const at = (x, y, c) => src[(Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))) * 3 + c]
  for (let j = 0; j < outH; j++) {
    const lat = BBOX.n - ((BBOX.n - BBOX.s) * (j + 0.5)) / outH
    const py = (tileY(lat) - y0) * 256 - 0.5
    for (let i = 0; i < outW; i++) {
      const lon = BBOX.w + ((BBOX.e - BBOX.w) * (i + 0.5)) / outW
      const px = (tileX(lon) - x0) * 256 - 0.5
      const ix = Math.floor(px), iy = Math.floor(py), fx = px - ix, fy = py - iy
      const px3 = [0, 1, 2].map((c) =>
        at(ix, iy, c) * (1 - fx) * (1 - fy) + at(ix + 1, iy, c) * fx * (1 - fy) +
        at(ix, iy + 1, c) * (1 - fx) * fy + at(ix + 1, iy + 1, c) * fx * fy)
      out.set(convert(px3), (j * outW + i) * 3)
    }
  }
  return out
}

await mkdir('public/terrain', { recursive: true })

// 1) 높이맵 — Terrarium 인코딩: 미터 = R*256 + G + B/256 - 32768. 바다(0m 이하)는 0 으로 맞춘 뒤 다시 인코딩
const demSrc = await mosaic((x, y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${x}/${y}.png`)
const hw = 1024, hh = Math.round((hw * (BBOX.n - BBOX.s)) / ((BBOX.e - BBOX.w) * Math.cos((33.38 * Math.PI) / 180)))
const meters = new Float32Array(W * H)
for (let k = 0; k < W * H; k++) meters[k] = demSrc[k * 3] * 256 + demSrc[k * 3 + 1] + demSrc[k * 3 + 2] / 256 - 32768
const enc = Buffer.alloc(hw * hh * 3)
for (let j = 0; j < hh; j++) {
  const lat = BBOX.n - ((BBOX.n - BBOX.s) * (j + 0.5)) / hh
  const py = (tileY(lat) - y0) * 256 - 0.5
  for (let i = 0; i < hw; i++) {
    const lon = BBOX.w + ((BBOX.e - BBOX.w) * (i + 0.5)) / hw
    const px = (tileX(lon) - x0) * 256 - 0.5
    const ix = Math.floor(px), iy = Math.floor(py), fx = px - ix, fy = py - iy
    const m = (x, y) => meters[Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))]
    let v = m(ix, iy) * (1 - fx) * (1 - fy) + m(ix + 1, iy) * fx * (1 - fy) + m(ix, iy + 1) * (1 - fx) * fy + m(ix + 1, iy + 1) * fx * fy
    v = Math.max(0, v) + 32768
    const o = (j * hw + i) * 3
    enc[o] = Math.floor(v / 256); enc[o + 1] = Math.floor(v % 256); enc[o + 2] = Math.floor((v - Math.floor(v)) * 256)
  }
}
await sharp(enc, { raw: { width: hw, height: hh, channels: 3 } }).png({ compressionLevel: 9 }).toFile('public/terrain/height.png')

// 2) 위성 텍스처 (JPEG)
const satSrc = await mosaic((x, y) => `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/${Z}/${y}/${x}.jpg`)
const sw = 2048, sh = Math.round((sw * hh) / hw)
await sharp(reproject(satSrc, sw, sh), { raw: { width: sw, height: sh, channels: 3 } }).jpeg({ quality: 82 }).toFile('public/terrain/satellite.jpg')

await writeFile('public/terrain/meta.json', JSON.stringify({ bbox: BBOX, heightSize: [hw, hh], satelliteSize: [sw, sh], zoom: Z }, null, 2))
console.log('tiles x', x0, x1, 'y', y0, 'y1', y1, '→ height', hw, 'x', hh, ', satellite', sw, 'x', sh)
