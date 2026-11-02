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

// 한라산 높이 함수: 중심(0,0)에서 멀어질수록 낮아지는 종 모양
export function heightAt(x, z) {
  const d = Math.hypot(x, z * 1.6)
  return Math.max(0, 1.9 * Math.exp(-(d * d) / 6))
}
