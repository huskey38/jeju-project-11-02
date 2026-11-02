// React 화면이 우리 서버 함수(/api/...)를 부를 때 쓰는 함수 모음
// 공공데이터 API를 브라우저에서 직접 부르지 않습니다 (키 노출 + CORS 문제) → 반드시 /api 를 거칩니다.

// 응답을 JSON으로 읽고, 실패하면 에러를 던집니다
async function readJson(r) {
  let data
  try { data = await r.json() }
  catch { throw new Error(`서버 응답이 JSON이 아님 (${r.status}) — vercel dev 로 실행했는지 확인`) }
  if (!r.ok) throw new Error(data.error || r.statusText)
  return data
}

export async function get(path) {
  return readJson(await fetch(path))
}

export async function post(path, body) {
  return readJson(await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }))
}

// 동작 확인용
export const ping = () => get('/api/hello')

// STEP 2~4: 공공데이터 API
export const fetchPlaces = (keyword = '', type = '12', page = 1, rows = 10, lcls = '') =>
  get(`/api/tour?keyword=${encodeURIComponent(keyword)}&type=${type}&lcls=${lcls}&page=${page}&rows=${rows}`)
// 내 주변 (위치 기반): 가까운 순, 각 항목에 dist(미터)
export const fetchNearby = ({ lat, lng, radius = 3000, type = '', lcls = '', xlcls = '', page = 1, rows = 12 }) =>
  get(`/api/tour?mode=near&lat=${lat}&lng=${lng}&radius=${radius}&type=${type}&lcls=${lcls}&xlcls=${xlcls}&page=${page}&rows=${rows}`)
// 축제 기간 검색: from(YYYY-MM-DD, 기본 오늘) 이후 진행 중이거나 시작하는 행사
export const fetchFestivals = ({ from = '', to = '', keyword = '', tags = [], page = 1, rows = 12 }) =>
  get(`/api/tour?mode=festival&from=${from}&to=${to}&keyword=${encodeURIComponent(keyword)}&tags=${tags.join(',')}&page=${page}&rows=${rows}`)
// 테마 태그 검색 (소개글에서 뽑은 태그, 색인에서 조회): tab = spot|culture|food|cafe, tags 는 모두 가진 곳만
export const fetchTagged = ({ tab, tags = [], lcls = '', keyword = '', lat, lng, radius, page = 1, rows = 12 }) =>
  get(`/api/tour?mode=tagged&tab=${tab}&tags=${tags.join(',')}&lcls=${lcls}&keyword=${encodeURIComponent(keyword)}${lat !== undefined ? `&lat=${lat}&lng=${lng}&radius=${radius}` : ''}&page=${page}&rows=${rows}`)
// 공연장 (제주도내 공연장 현황 — 파일 데이터를 서버에서 조회)
export const fetchVenues = (keyword = '', page = 1, rows = 12) =>
  get(`/api/venue?keyword=${encodeURIComponent(keyword)}&page=${page}&rows=${rows}`)
// 일반음식점 (행정안전부 인허가 데이터): 목록(keyword 는 가게 이름, biz 는 업태) / 상세(관리번호)
export const fetchRestaurants = (keyword = '', biz = '', page = 1, rows = 12) =>
  get(`/api/restaurant?keyword=${encodeURIComponent(keyword)}&biz=${encodeURIComponent(biz)}&page=${page}&rows=${rows}`)
export const fetchRestaurantDetail = (id) => get(`/api/restaurant?id=${encodeURIComponent(id)}`)
export const fetchVenueDetail = (id) => get(`/api/venue?id=${encodeURIComponent(id)}`)
// 장소(좌표)·날짜별 예보: dates = ['YYYY-MM-DD', ...] → [{ date, kind: 'short'|'mid'|'none', tmin, tmax, sky, precip, pop }]
export const fetchForecast = ({ lat, lng, dates }) =>
  get(`/api/weather?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&dates=${dates.join(',')}`)
// 좌표 주변 편의점(CS2)·주차장(PK6)·주유소(OL7), 가까운 순 (카카오 로컬 API, 서버가 대신 호출)
export const fetchPoi = ({ lat, lng, cat, radius = 500 }) =>
  get(`/api/poi?lat=${lat}&lng=${lng}&cat=${cat}&radius=${radius}`)
// 제주 오름 현황(공식 368곳): keyword 이름, form 형태 묶음(cone·round·horseshoe·mixed), tags 소개글 특징, sort 'elev'(표고 높은 순),
// lat·lng·radius(미터)를 주면 그 반경 안을 가까운 순으로. 항목: { id, title, city, addr, elev, area, rel, form, lat, lng, tourId?, image?, dist? }
export const fetchOreum = ({ keyword = '', form = '', tags = [], sort = '', lat, lng, radius, page = 1, rows = 12 } = {}) =>
  get(`/api/oreum?keyword=${encodeURIComponent(keyword)}&form=${form}&tags=${tags.join(',')}&sort=${sort}${lat !== undefined ? `&lat=${lat}&lng=${lng}&radius=${radius}` : ''}&page=${page}&rows=${rows}`)
export const fetchOreumById = (id) => get(`/api/oreum?id=${encodeURIComponent(id)}`).then((list) => list[0])
// 오름 전체 368곳 — 등반률의 최대치와 3D 지도의 마크 위치. 한 번만 받아 둠
let oreumAll = null   // 요청 자체를 보관해 동시에 여러 번 불러도 한 번만 요청
export const fetchOreumAll = () => (oreumAll ??= fetchOreum({ rows: 400 }).catch((e) => { oreumAll = null; throw e }))
export const fetchHeritage = (keyword = '', page = 1, rows = 10) =>
  get(`/api/heritage?keyword=${encodeURIComponent(keyword)}&page=${page}&rows=${rows}`)

// 상세 정보 (카드 클릭 시)
export const fetchPlaceDetail = (id) => get(`/api/tour?id=${encodeURIComponent(id)}`)
export const fetchHeritageDetail = ({ kdcd, asno, ctcd }) =>
  get(`/api/heritage?kdcd=${encodeURIComponent(kdcd)}&asno=${encodeURIComponent(asno)}&ctcd=${encodeURIComponent(ctcd)}`)

// STEP 6: 에이전트
export const askAgent = (message, history) => post('/api/agent', { message, history })
