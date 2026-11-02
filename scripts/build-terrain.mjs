// 제주 높이맵·위성 텍스처 생성 (일회성): node scripts/build-terrain.mjs
//   높이: AWS Terrain Tiles (Terrarium, z12)  https://registry.opendata.aws/terrain-tiles/
//   위성: EOX Sentinel-2 cloudless 2020 (z13)  (c) EOX IT Services GmbH, contains modified Copernicus Sentinel data 2020, CC BY 4.0
// 타일은 웹 메르카토르라서, src/lib/geo.js 의 선형 위경도 좌표와 맞도록 재투영해 저장합니다.
// 범위(bbox)는 src/lib/geo.js 의 TERRAIN_BBOX 를 그대로 씁니다 — 한 곳에서만 정해서 화면 코드와 어긋나지 않게 함.
import sharp from 'sharp'
import { mkdir, writeFile } from 'node:fs/promises'
import { TERRAIN_BBOX } from '../src/lib/geo.js'

const BBOX = { w: TERRAIN_BBOX.west, e: TERRAIN_BBOX.east, s: TERRAIN_BBOX.south, n: TERRAIN_BBOX.north }
const Z_DEM = 12          // 높이: 약 32m/픽셀 (원본 DEM 의 해상도와 비슷해 더 올려도 의미가 적음)
const Z_SAT = 13          // 위성: 약 16m/픽셀 (Sentinel-2 원본은 10m)
const OUT_DEM_W = 2048    // 높이맵 가로 픽셀
const OUT_SAT_W = 4096    // 위성 가로 픽셀 (GPU 텍스처 한계 4096 에 맞춤 → 약 20m/픽셀)
const CONCURRENCY = 8

const tileX = (lon, z) => ((lon + 180) / 360) * 2 ** z
const tileY = (lat, z) => {
  const r = (lat * Math.PI) / 180
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z
}

// 타일을 모아 한 장의 큰 RGB 버퍼로 이어 붙임 (동시에 CONCURRENCY 장씩 받고, 실패하면 3번까지 다시 시도)
async function mosaic(z, urlOf) {
  const x0 = Math.floor(tileX(BBOX.w, z)), x1 = Math.floor(tileX(BBOX.e, z))
  const y0 = Math.floor(tileY(BBOX.n, z)), y1 = Math.floor(tileY(BBOX.s, z))
  const W = (x1 - x0 + 1) * 256, H = (y1 - y0 + 1) * 256
  const buf = Buffer.alloc(W * H * 3)
  const jobs = []
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) jobs.push([tx, ty])
  let done = 0
  async function one([tx, ty]) {
    for (let attempt = 1; ; attempt++) {
      try {
        const res = await fetch(urlOf(tx, ty), { signal: AbortSignal.timeout(30000) })
        if (!res.ok) throw new Error(`${res.status} ${urlOf(tx, ty)}`)
        const raw = await sharp(Buffer.from(await res.arrayBuffer())).removeAlpha().raw().toBuffer()
        for (let r = 0; r < 256; r++)
          raw.copy(buf, ((ty - y0) * 256 + r) * W * 3 + (tx - x0) * 256 * 3, r * 256 * 3, (r + 1) * 256 * 3)
        return
      } catch (e) { if (attempt >= 3) throw e }
    }
  }
  const queue = [...jobs]
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    for (let job; (job = queue.shift());) { await one(job); if (++done % 50 === 0) console.log(`  z${z} 타일 ${done}/${jobs.length}`) }
  }))
  console.log(`  z${z} 타일 ${jobs.length}장 완료 (${W}x${H})`)
  return { buf, W, H, x0, y0, z }
}

// 선형 위경도 격자(outW x outH)의 각 점에서 메르카토르 모자이크를 이중선형 샘플링
function resample(m, outW, outH, write) {
  const { buf, W, H, x0, y0, z } = m
  const at = (x, y, c) => buf[(Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))) * 3 + c]
  for (let j = 0; j < outH; j++) {
    const lat = BBOX.n - ((BBOX.n - BBOX.s) * (j + 0.5)) / outH
    const py = (tileY(lat, z) - y0) * 256 - 0.5
    const iy = Math.floor(py), fy = py - iy
    for (let i = 0; i < outW; i++) {
      const lon = BBOX.w + ((BBOX.e - BBOX.w) * (i + 0.5)) / outW
      const px = (tileX(lon, z) - x0) * 256 - 0.5
      const ix = Math.floor(px), fx = px - ix
      write(j * outW + i, (c) =>
        at(ix, iy, c) * (1 - fx) * (1 - fy) + at(ix + 1, iy, c) * fx * (1 - fy) +
        at(ix, iy + 1, c) * (1 - fx) * fy + at(ix + 1, iy + 1, c) * fx * fy)
    }
  }
}

await mkdir('public/terrain', { recursive: true })
// 이미지 비율: 3D 에서 위도·경도 1도를 같은 길이(20단위)로 그리므로, 픽셀은 실제 거리 비율(경도는 cos(위도) 보정)로 맞춤
const aspect = (BBOX.n - BBOX.s) / ((BBOX.e - BBOX.w) * Math.cos(((BBOX.n + BBOX.s) / 2 * Math.PI) / 180))

// 1) 높이맵 — Terrarium 인코딩: 미터 = R*256 + G + B/256 - 32768. 보간은 미터 단위로 한 뒤, 바다(0m 이하)는 0 으로 맞춰 다시 인코딩
console.log('높이 타일(Terrarium) 받는 중...')
const dem = await mosaic(Z_DEM, (x, y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z_DEM}/${x}/${y}.png`)
const hw = OUT_DEM_W, hh = Math.round(hw * aspect)
const meters = new Float32Array(dem.W * dem.H)
for (let k = 0; k < meters.length; k++) meters[k] = dem.buf[k * 3] * 256 + dem.buf[k * 3 + 1] + dem.buf[k * 3 + 2] / 256 - 32768
const enc = Buffer.alloc(hw * hh * 3)
{
  const { W, H, x0, y0, z } = dem
  const m = (x, y) => meters[Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))]
  for (let j = 0; j < hh; j++) {
    const lat = BBOX.n - ((BBOX.n - BBOX.s) * (j + 0.5)) / hh
    const py = (tileY(lat, z) - y0) * 256 - 0.5, iy = Math.floor(py), fy = py - iy
    for (let i = 0; i < hw; i++) {
      const lon = BBOX.w + ((BBOX.e - BBOX.w) * (i + 0.5)) / hw
      const px = (tileX(lon, z) - x0) * 256 - 0.5, ix = Math.floor(px), fx = px - ix
      let v = m(ix, iy) * (1 - fx) * (1 - fy) + m(ix + 1, iy) * fx * (1 - fy) + m(ix, iy + 1) * (1 - fx) * fy + m(ix + 1, iy + 1) * fx * fy
      v = Math.max(0, v) + 32768
      const o = (j * hw + i) * 3
      enc[o] = Math.floor(v / 256); enc[o + 1] = Math.floor(v % 256); enc[o + 2] = Math.floor((v - Math.floor(v)) * 256)
    }
  }
}
await sharp(enc, { raw: { width: hw, height: hh, channels: 3 } }).png({ compressionLevel: 9 }).toFile('public/terrain/height.png')

// 2) 위성 텍스처 (JPEG)
console.log('위성 타일(Sentinel-2) 받는 중...')
const sat = await mosaic(Z_SAT, (x, y) => `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/${Z_SAT}/${y}/${x}.jpg`)
const sw = OUT_SAT_W, sh = Math.round(sw * aspect)
const out = Buffer.alloc(sw * sh * 3)
resample(sat, sw, sh, (idx, f) => { out[idx * 3] = f(0); out[idx * 3 + 1] = f(1); out[idx * 3 + 2] = f(2) })
await sharp(out, { raw: { width: sw, height: sh, channels: 3 } }).jpeg({ quality: 86, mozjpeg: true }).toFile('public/terrain/satellite.jpg')

await writeFile('public/terrain/meta.json', JSON.stringify({ bbox: BBOX, heightSize: [hw, hh], satelliteSize: [sw, sh], zoom: { height: Z_DEM, satellite: Z_SAT } }, null, 2))
console.log(`완료: 높이 ${hw}x${hh}, 위성 ${sw}x${sh}`)
