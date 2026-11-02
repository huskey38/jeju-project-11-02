// 관광·문화 페이지의 분류(버튼)와, 분류마다 어떤 API를 어떤 순서로 불러올지 정하는 규칙
//
// 한 분류는 "소스 목록"으로 표현합니다. 목록을 순서대로 소진하며 이어 붙입니다.
//   예) 음식점 = 한식 → 양식 → 일식·기타 (카페는 따로 'FD05')
//       전체   = 숙박을 뺀 TourAPI 유형들 → 국가유산
// 숙박은 서비스 대상이 아니라 어디에도 넣지 않습니다.

export const CATEGORIES = [
  { key: 'all', label: '전체' },
  { key: 'spot', label: '관광지' },
  { key: 'culture', label: '문화시설' },
  { key: 'festival', label: '축제·행사' },
  { key: 'food', label: '음식점' },
  { key: 'cafe', label: '카페' },
  { key: 'near', label: '내 주변' },
]
// '관광지' 안의 하위 선택
export const SUBS = [
  { key: 'all', label: '전체' },
  { key: 'general', label: '일반' },
  { key: 'heritage', label: '국가유산' },
]
// '내 주변' 안의 유형 선택 (분류 버튼과 같은 이름, '내 주변'만 제외)
export const NEAR_TYPES = CATEGORIES.filter((c) => c.key !== 'near')
// '내 주변' 반경(km)
export const RADII = [1, 3, 5, 10]
export const DEFAULT_RADIUS = 3

// 분류별 하위 선택 목록 (없으면 null)
export const subsOf = (cat) => (cat === 'spot' ? SUBS : cat === 'near' ? NEAR_TYPES : null)

const TOUR_SPOT = { api: 'tour', type: '12' }
const HERITAGE = { api: 'heritage' }
const VENUE = { api: 'venue' }   // 제주도내 공연장 현황 (파일 데이터) — 문화시설에 합침

// 음식점(39)에서 카페(FD05)를 뺀 분류체계 중분류: 한식 FD01, 양식 FD02, 일식·기타 FD03 (FD04 는 제주에 0건)
const FOOD_LCLS = ['FD01', 'FD02', 'FD03']

// '내 주변' 유형별 조건 — xlcls: 이 중분류는 제외 (음식점에서 카페 빼기)
const NEAR_FILTER = {
  all: {},
  spot: { type: '12' },
  culture: { type: '14' },
  festival: { type: '15' },
  food: { type: '39', xlcls: 'FD05' },
  cafe: { type: '39', lcls: 'FD05' },
}

// 내 주변 유형 키(spot·culture·festival·food·cafe) → 검색 조건 (AI 에이전트도 같은 규칙을 씀)
export const nearFilterOf = (key) => NEAR_FILTER[key] ?? NEAR_FILTER.all

// 숙박(32)을 뺀 TourAPI 유형: 관광지 12, 문화시설 14, 축제 15, 레포츠 28, 쇼핑 38, 음식점·카페 39
const ALL_TOUR_TYPES = ['12', '14', '15', '28', '38', '39']

export function sourcesFor(cat, sub = 'all') {
  switch (cat) {
    case 'spot':
      return sub === 'general' ? [TOUR_SPOT] : sub === 'heritage' ? [HERITAGE] : [TOUR_SPOT, HERITAGE]
    case 'culture': return [{ api: 'tour', type: '14' }, VENUE]
    case 'festival': return [{ api: 'festival' }]            // 기간 검색 (searchFestival2)
    case 'food': return FOOD_LCLS.map((lcls) => ({ api: 'tour', type: '39', lcls }))
    case 'cafe': return [{ api: 'tour', type: '39', lcls: 'FD05' }]
    case 'near': return [{ api: 'near', ...(NEAR_FILTER[sub] ?? NEAR_FILTER.all) }]   // 가까운 순 (locationBasedList2)
    default: return [...ALL_TOUR_TYPES.map((type) => ({ api: 'tour', type })), HERITAGE, VENUE]
  }
}

// 한 쪽을 받은 뒤 다음에 읽을 위치(cursor)를 계산합니다.
// cursor = { i: 소스 번호, page: 쪽 번호 }. 가득 찬 쪽이면 같은 소스의 다음 쪽, 덜 찼거나 비었으면 다음 소스로 넘어감.
export function advance(cursor, listLength, rows) {
  return listLength >= rows ? { i: cursor.i, page: cursor.page + 1 } : { i: cursor.i + 1, page: 1 }
}

const TYPE_LABEL = { 12: '관광지', 14: '문화시설', 15: '축제·행사', 28: '레포츠', 38: '쇼핑', 39: '음식점' }

// 카드에 붙일 배지 글자 (숙박 유형은 라벨이 없음)
export function badgeOf(item) {
  if (item.kind === 'heritage') return `국가유산${item.kindName ? `·${item.kindName}` : ''}`
  if (item.kind === 'venue') return `공연장${item.kindName ? `·${item.kindName}` : ''}`
  if (item.lcls === 'FD05') return '카페'
  return TYPE_LABEL[item.type]
}

// 286 → '286m', 1234 → '1.2km'
export const fmtDist = (m) => (m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`)

// 카드 아래 한 줄: 거리 · 행사 기간 · 주소 (있는 것만)
export function subtitleOf(item) {
  if (item.kind === 'heritage') return item.city
  const period = item.start ? (item.start === item.end || !item.end ? item.start : `${item.start} ~ ${item.end}`) : ''
  return [item.dist !== undefined && fmtDist(item.dist), period, item.addr].filter(Boolean).join(' · ')
}
