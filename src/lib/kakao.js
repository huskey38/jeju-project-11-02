// 카카오 지도 SDK 로더 + 카카오맵 바로가기 링크

// JavaScript 키(.env 의 VITE_KAKAO_JS_KEY)가 있는지 — 없으면 앱은 기존 Leaflet 지도로 대신함
export const hasKakaoKey = (key = import.meta.env.VITE_KAKAO_JS_KEY) => Boolean(key && String(key).trim())

let loading = null

// SDK 스크립트를 한 번만 불러오고, 준비되면 window.kakao 를 돌려줌 (autoload=false → kakao.maps.load 로 준비 완료를 기다림)
// key·doc·win 은 테스트에서 바꿔 끼울 수 있게 인자로 받음
export function loadKakao({ key = import.meta.env.VITE_KAKAO_JS_KEY, doc = globalThis.document, win = globalThis.window } = {}) {
  if (!hasKakaoKey(key)) return Promise.reject(new Error('VITE_KAKAO_JS_KEY 가 설정되지 않았어요'))
  if (win?.kakao?.maps?.LatLng) return Promise.resolve(win.kakao)   // 이미 준비됨
  if (loading) return loading
  loading = new Promise((resolve, reject) => {
    const s = doc.createElement('script')
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(String(key).trim())}&autoload=false`
    s.async = true
    s.onload = () => {
      if (!win.kakao?.maps) { loading = null; return reject(new Error('카카오 지도 SDK 가 준비되지 않았어요')) }
      win.kakao.maps.load(() => resolve(win.kakao))
    }
    s.onerror = () => {
      loading = null
      s.remove?.()
      reject(new Error('카카오 지도 SDK 를 불러오지 못했어요 (키·도메인 등록·광고 차단을 확인하세요)'))
    }
    doc.head.appendChild(s)
  })
  return loading
}

// 카카오맵 바로가기 URL (키 없이 동작 — 사용자 환경에 따라 PC·모바일 카카오맵으로 연결됨)
//   map: 지도에서 보기 / to: 이 곳으로 길찾기 / roadview: 로드뷰
// 이름에 쉼표·슬래시가 있으면 URL 구분자와 섞이므로 공백으로 바꿈. 좌표가 올바르지 않으면 null
export function kakaoLinks({ name, lat, lng } = {}) {
  const la = Number(lat), ln = Number(lng)
  if (lat === '' || lng === '' || lat == null || lng == null || !Number.isFinite(la) || !Number.isFinite(ln)) return null
  const n = encodeURIComponent(String(name ?? '').replace(/[,/]/g, ' ').replace(/\s+/g, ' ').trim() || '장소')
  const base = 'https://map.kakao.com/link'
  return {
    map: `${base}/map/${n},${la},${ln}`,
    to: `${base}/to/${n},${la},${ln}`,
    roadview: `${base}/roadview/${la},${ln}`,
  }
}

// 반경(미터) 원이 모두 보이도록 중심에서 동서남북으로 잰 끝점 좌표 (지도 영역 맞춤용)
export function radiusEdges(lat, lng, radiusM) {
  const la = Number(lat), ln = Number(lng), r = Number(radiusM)
  const dLat = r / 111320
  const dLng = r / (111320 * Math.cos((la * Math.PI) / 180))
  return [[la + dLat, ln], [la - dLat, ln], [la, ln + dLng], [la, ln - dLng]]
}
