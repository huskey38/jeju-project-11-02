// 제주도 범위 안의 유효한 좌표인지 (API가 빈 값·0 을 줄 때를 거름)
export function isJejuCoord(lat, lng) {
  const la = Number(lat), ln = Number(lng)
  return la > 33.0 && la < 33.7 && ln > 126.0 && ln < 127.1
}
