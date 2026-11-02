// 위도·경도 → 3D 좌표 (제주 중심 북위 33.38, 동경 126.55 기준). 동쪽 = +x, 남쪽 = +z
export const SCALE = 20

export function toXZ(lat, lng) {
  return [(Number(lng) - 126.55) * SCALE, (33.38 - Number(lat)) * SCALE]
}

// 제주도 범위 안의 유효한 좌표인지 (API가 빈 값·0 을 줄 때를 거름)
export function isJejuCoord(lat, lng) {
  const la = Number(lat), ln = Number(lng)
  return la > 33.0 && la < 33.7 && ln > 126.0 && ln < 127.1
}

// ── 지형 높이 ────────────────────────────────────────────
// 실제 DEM 높이맵(public/terrain/height.png)이 로드되면 setHeightField 로 등록하고,
// 아직 없거나 실패하면 아래 종 모양 근사 함수를 씁니다.
export const TERRAIN = { width: 20, depth: 14, metersToUnit: 0.0009 } // 가로·세로(3D 단위), 1m = 0.0009 단위 (약 4배 과장)
let field = null // { data: Float32Array(미터), w, h }

export function setHeightField(f) { field = f }

function fieldMeters(x, z) {
  const { data, w, h } = field
  const u = (x / TERRAIN.width + 0.5) * (w - 1)
  const v = (z / TERRAIN.depth + 0.5) * (h - 1) // 이미지 위쪽 = 북쪽 = -z
  if (u < 0 || v < 0 || u > w - 1 || v > h - 1) return 0
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
