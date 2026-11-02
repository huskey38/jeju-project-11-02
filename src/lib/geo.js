// 제주도 범위 안의 유효한 좌표인지 (API가 빈 값·0 을 줄 때를 거름)
export function isJejuCoord(lat, lng) {
  const la = Number(lat), ln = Number(lng)
  return la > 33.0 && la < 33.7 && ln > 126.0 && ln < 127.1
}

// ── 3D 제주 지도 ─────────────────────────────────────────
// 위도·경도 → 3D 좌표 (제주 중심 북위 33.38, 동경 126.55 기준). 동쪽 = +x, 남쪽 = +z
export const SCALE = 20
const CENTER_LAT = 33.38, CENTER_LNG = 126.55

export function toXZ(lat, lng) {
  return [(Number(lng) - CENTER_LNG) * SCALE, (CENTER_LAT - Number(lat)) * SCALE]
}

// 지형 이미지(public/terrain/height.png)가 덮는 위경도 범위. 제주 본섬과 부속 섬(우도·가파도·마라도·비양도)만 담도록 바다를 줄였음.
// scripts/build-terrain.mjs 가 이 값을 그대로 읽어 이미지를 만들므로, 범위를 바꾸면 스크립트를 다시 돌려야 합니다.
export const TERRAIN_BBOX = { west: 126.10, east: 127.00, south: 33.08, north: 33.62 }

// 범위를 3D 단위로 환산: 가로·세로 크기와 중심 위치(장면 중심에서 얼마나 벗어났는지)
export const TERRAIN = {
  bbox: TERRAIN_BBOX,
  width: (TERRAIN_BBOX.east - TERRAIN_BBOX.west) * SCALE,
  depth: (TERRAIN_BBOX.north - TERRAIN_BBOX.south) * SCALE,
  x0: ((TERRAIN_BBOX.east + TERRAIN_BBOX.west) / 2 - CENTER_LNG) * SCALE,
  z0: (CENTER_LAT - (TERRAIN_BBOX.north + TERRAIN_BBOX.south) / 2) * SCALE,
  metersToUnit: 0.0009,   // 1m = 0.0009 단위 (실제보다 약 4배 과장)
}

// 실제 DEM 높이맵이 로드되면 setHeightField 로 등록하고, 아직 없거나 실패하면 아래 종 모양 근사 함수를 씁니다.
let field = null // { data: Float32Array(미터), w, h }

export function setHeightField(f) { field = f }
export const getHeightField = () => field

// 장면 좌표(x,z) → 높이맵 안의 소수 픽셀 위치 (이미지 위쪽 = 북쪽 = -z). 범위 밖이면 null
function pixelAt(x, z, w, h) {
  const u = ((x - (TERRAIN.x0 - TERRAIN.width / 2)) / TERRAIN.width) * (w - 1)
  const v = ((z - (TERRAIN.z0 - TERRAIN.depth / 2)) / TERRAIN.depth) * (h - 1)
  return u < 0 || v < 0 || u > w - 1 || v > h - 1 ? null : [u, v]
}

function fieldMeters(x, z) {
  const { data, w, h } = field
  const p = pixelAt(x, z, w, h)
  if (!p) return 0
  const [u, v] = p
  const i = Math.floor(u), j = Math.floor(v), fx = u - i, fy = v - j
  const at = (a, b) => data[Math.min(h - 1, b) * w + Math.min(w - 1, a)]
  return at(i, j) * (1 - fx) * (1 - fy) + at(i + 1, j) * fx * (1 - fy) + at(i, j + 1) * (1 - fx) * fy + at(i + 1, j + 1) * fx * fy
}

// 3D 좌표(x,z) 의 지면 높이 (3D 단위)
export function heightAt(x, z) {
  if (field) return fieldMeters(x, z) * TERRAIN.metersToUnit
  const d = Math.hypot(x, z * 1.6)
  return Math.max(0, 1.9 * Math.exp(-(d * d) / 6))
}
