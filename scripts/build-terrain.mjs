// 제주 높이맵 생성 (일회성): node scripts/build-terrain.mjs — 3D 지도는 이 높이로 지형 모양과 높이별 색을 만듭니다(위성 사진은 쓰지 않음)
//   높이: AWS Terrain Tiles (Terrarium, z12)  https://registry.opendata.aws/terrain-tiles/
// 타일은 웹 메르카토르라서, src/lib/geo.js 의 선형 위경도 좌표와 맞도록 재투영해 저장합니다.
// 범위(bbox)는 src/lib/geo.js 의 TERRAIN_BBOX 를 그대로 씁니다 — 한 곳에서만 정해서 화면 코드와 어긋나지 않게 함.
import sharp from 'sharp'
import { mkdir, writeFile } from 'node:fs/promises'
import { TERRAIN_BBOX } from '../src/lib/geo.js'

const BBOX = { w: TERRAIN_BBOX.west, e: TERRAIN_BBOX.east, s: TERRAIN_BBOX.south, n: TERRAIN_BBOX.north }
const Z_DEM = 12          // 높이: 약 32m/픽셀 (원본 DEM 의 해상도와 비슷해 더 올려도 의미가 적음)
const OUT_DEM_W = 2048    // 높이맵 가로 픽셀
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

await writeFile('public/terrain/meta.json', JSON.stringify({ bbox: BBOX, heightSize: [hw, hh], zoom: { height: Z_DEM } }, null, 2))
console.log(`완료: 높이 ${hw}x${hh}`)
