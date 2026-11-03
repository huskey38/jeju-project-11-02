// 오름 좌표·연결 수정표 — scripts/verify-oreum-coords.mjs 검증 결과를 근거로 한 확실한 수정만 담음 (build-oreum.mjs 와 apply-oreum-fix.mjs 가 함께 씀)
// 근거: 공식 소재지(동·리)를 카카오 주소검색·키워드검색·관광지데이터 좌표와 대조해 둘 이상이 일치한 곳만. 불확실한 곳(#178 보롬이 등)은 고치지 않음.
//   lat/lng: 바로잡은 좌표, unlink: 관광공사 연결(tourId·사진)을 해제 — 관광공사 쪽이 이름만 같은 다른 오름이라고 판단될 때
export const FIX = {
  7: { lat: 33.331621, lng: 126.781493, unlink: true, why: '공식 토산리 산2(주소검색·관광지데이터 일치). 관광공사 가세오름은 가시리 녹산로라 다른 곳' },
  47: { lat: 33.25516, lng: 126.368302, why: '공식 창천리 564(주소검색·키워드·관광지데이터 일치). 기존 좌표는 상예동 쪽으로 약 300m 어긋남' },
  117: { lat: 33.47742, lng: 126.88562, why: '공식 시흥리 2665(주소검색·관광지데이터 일치). 기존 좌표는 종달리 쪽' },
  147: { lat: 33.38376, lng: 126.622499, unlink: true, why: '공식 한남리 산2-4(주소검색·키워드 물오름 일치). 관광공사 수악(물오름)은 하례리 수악이라 다른 곳' },
  153: { lat: 33.350186, lng: 126.677034, why: '공식 수망리 158(키워드 수망리 산158-1). 기존 좌표는 제주시 오라동의 같은 이름 민오름' },
  161: { lat: 33.351138, lng: 126.335941, why: '공식 금악리 18-1(키워드 금악리 밝은오름). 기존 좌표는 안덕면 동광리의 같은 이름 오름' },
  239: { lat: 33.436934, lng: 126.912138, unlink: true, why: '공식 성산읍 고성리 887(주소검색·관광지데이터 일치). 관광공사 수산봉은 애월읍 수산리의 다른 오름' },
}

// items: 오름 목록(공식 연번 id 문자열) — 제자리에서 고치고, 고친 항목 목록을 돌려줌
export function applyFix(items) {
  const done = []
  for (const o of items) {
    const f = FIX[o.id]
    if (!f) continue
    o.lat = f.lat; o.lng = f.lng
    if (f.unlink) { delete o.tourId; delete o.image }
    done.push(o.name)
  }
  return done
}
