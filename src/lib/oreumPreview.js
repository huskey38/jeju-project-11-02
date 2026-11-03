// 홈의 '이렇게 채워져요' 예시 그림: 공식 오름 368곳의 좌표를 그대로 점으로 찍으면 제주 모양이 나타남 (외곽선을 따로 그리지 않음)
export const PREVIEW = { w: 200, h: 106, lngMin: 126.14, lngMax: 126.99, latMin: 33.18, latMax: 33.58, pad: 6 }

// 위·경도 → 예시 그림 좌표 (경도는 위도 33.4°에서 길이가 줄어드는 만큼 보정해 가로세로 비율을 맞춤)
export function previewDots(oreums = []) {
  const { w, h, lngMin, lngMax, latMin, latMax, pad } = PREVIEW
  const k = Math.cos((33.4 * Math.PI) / 180)
  const spanX = (lngMax - lngMin) * k, spanY = latMax - latMin
  const s = Math.min((w - pad * 2) / spanX, (h - pad * 2) / spanY)
  const ox = (w - spanX * s) / 2, oy = (h - spanY * s) / 2
  return oreums
    .filter((o) => Number.isFinite(o.lat) && Number.isFinite(o.lng) && o.lng >= lngMin && o.lng <= lngMax && o.lat >= latMin && o.lat <= latMax)
    .map((o) => ({ id: o.id, x: +(ox + (o.lng - lngMin) * k * s).toFixed(1), y: +(oy + (latMax - o.lat) * s).toFixed(1) }))
}
