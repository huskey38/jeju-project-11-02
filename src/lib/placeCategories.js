// 관광·문화 페이지의 분류(버튼)와, 분류마다 어떤 API를 어떤 순서로 불러올지 정하는 규칙
//
// 한 분류는 "소스 목록"으로 표현합니다. 목록을 순서대로 소진하며 이어 붙입니다.
//   예) 음식점 = 한식 → 양식 → 일식·기타 (카페는 따로 'FD05')
//       전체   = 숙박을 뺀 TourAPI 유형들 → 국가유산
// 숙박은 서비스 대상이 아니라 어디에도 넣지 않습니다.

import { TAG_RULES } from './placeTags.js'

export const CATEGORIES = [
  { key: 'all', label: '전체' },
  { key: 'food', label: '음식점' },
  { key: 'cafe', label: '카페' },
  { key: 'spot', label: '관광지' },
  { key: 'culture', label: '문화시설' },
  { key: 'festival', label: '축제·행사' },
  { key: 'saved', label: '가볼만한 곳' },   // 감귤로 담아 둔 곳 (예전 '내 즐겨찾기') — API 가 아니라 저장된 목록을 보여줌
]

// '음식점' 안의 종류 선택: biz = 행정안전부 일반음식점의 '업태구분명', lcls = 관광공사 분류체계 코드 (한식=중분류 FD01, 그 밖은 소분류).
// 둘 다 있으면 두 곳을 합쳐서, 하나만 있으면 그 쪽만 보여줌. 카페는 종류가 거의 한 가지라 칩이 없음
export const FOOD_TYPES = [
  { key: 'all', label: '전체' },
  { key: 'korean', label: '한식', lcls: 'FD01', biz: '한식' },
  { key: 'raw', label: '횟집', biz: '횟집' },
  { key: 'grill', label: '식육·구이', biz: '식육(숯불구이)' },
  { key: 'snack', label: '분식', lcls: 'FD030400', biz: '분식' },
  { key: 'japanese', label: '일식', lcls: 'FD020200', biz: '일식' },
  { key: 'chinese', label: '중식', lcls: 'FD020100', biz: '중국식' },
  { key: 'western', label: '양식', lcls: 'FD020300', biz: '경양식' },
  { key: 'chicken', label: '치킨', biz: '통닭(치킨)' },
  { key: 'bakery', label: '제과', lcls: 'FD030100' },
]
// 검색창 밑 '인기 메뉴' 바로가기: 누르면 그 단어로 검색 (가게 이름에 든 단어로 찾음)
export const MENU_WORDS = {
  food: ['흑돼지', '해물', '국수', '갈치', '전복', '보말'],
  cafe: ['커피', '베이커리', '감귤', '한라봉', '말차', '디저트'],
}

// '내 주변' 반경(km): 분류 버튼마다 아래에서 고름 (고르지 않으면 제주 전체)
export const RADII = [1, 3, 5]
// 내 주변을 고를 수 있는 분류 (가볼만한 곳은 저장된 목록이라 제외)
export const NEAR_CATS = ['all', 'spot', 'culture', 'festival', 'food', 'cafe']

// 하위 선택(지금은 음식점 종류만)은 한 번에 하나. 'all' = 선택 없음
// 주소에서 읽은 값 → 유효한 키(없으면 'all')
export function parseSub(cat, raw) {
  const list = subsOf(cat)
  return list?.some((x) => x.key === raw) ? raw : 'all'
}
export const toggleSub = (cat, current, key) => key

// 테마 태그(소개글에서 뽑음, src/lib/placeTags.js): 관광지·문화시설·축제·음식점·카페 탭에서 여러 개 고름(고른 것을 모두 가진 곳만)
export const parseTags = (cat, raw) => {
  const valid = (TAG_RULES[cat] ?? []).map((r) => r.key)
  return [...new Set(String(raw ?? '').split(','))].filter((k) => valid.includes(k))
}
export const toggleTag = (tags, key) => (tags.includes(key) ? tags.filter((k) => k !== key) : [...tags, key])

// 분류별 하위 선택 목록 (없으면 null)
export const subsOf = (cat) => (cat === 'food' ? FOOD_TYPES : null)

const TOUR_SPOT = { api: 'tour', type: '12' }
const HERITAGE = { api: 'heritage' }
const REST = { api: 'rest', biz: '' }   // 행정안전부 일반음식점 (인허가 데이터 — 사진 없음) — 음식점에 합침
const VENUE = { api: 'venue' }   // 제주도내 공연장 현황 (파일 데이터) — 문화시설에 합침

// 음식점(39)에서 카페(FD05)를 뺀 분류체계 중분류: 한식 FD01, 양식 FD02, 일식·기타 FD03 (FD04 는 제주에 0건)
const FOOD_LCLS = ['FD01', 'FD02', 'FD03']

// 내 주변 유형별 조건 — xlcls: 이 중분류는 제외 (음식점에서 카페 빼기)
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

// near=true 면 분류와 상관없이 위치 기반 검색(가까운 순, locationBasedList2)으로 그 분류의 유형 조건만 걸어 불러옴
export function sourcesFor(cat, sub = 'all', near = false, tags = []) {
  const foodType = cat === 'food' ? FOOD_TYPES.find((t) => t.key === sub && t.key !== 'all') : null   // 음식점 종류 선택
  if (near && NEAR_CATS.includes(cat)) return [{ api: 'near', ...(foodType?.lcls ? { type: '39', lcls: foodType.lcls } : NEAR_FILTER[cat] ?? NEAR_FILTER.all) }]   // 업태만 있는 칩(횟집 등)은 위치 검색에 반영 안 됨
  // 테마 태그: 소개글 색인에서 찾음 (축제는 기간 검색 결과를 태그로 거름). 관광지는 색인에 없는 국가유산이 빠짐
  if (tags.length && TAG_RULES[cat]) {
    if (cat === 'festival') return [{ api: 'festival', tags }]
    const lcls = foodType?.lcls ?? ''   // (태그는 관광공사 음식점에만 있음)
    return [{ api: 'tagged', tab: cat, tags, lcls }]
  }
  if (foodType) return [...(foodType.lcls ? [{ api: 'tour', type: '39', lcls: foodType.lcls }] : []), ...(foodType.biz ? [{ api: 'rest', biz: foodType.biz }] : [])]
  switch (cat) {
    case 'spot': return [TOUR_SPOT, HERITAGE]                // 국가유산은 관광지에 합쳐 항상 함께 나옴 ('오름 제외'는 소스가 아니라 결과를 거름)
    case 'culture': return [{ api: 'tour', type: '14' }, VENUE]
    case 'festival': return [{ api: 'festival' }]            // 기간 검색 (searchFestival2)
    case 'food': return [...FOOD_LCLS.map((lcls) => ({ api: 'tour', type: '39', lcls })), REST]   // 관광공사 음식점(사진 있음) 뒤에 일반음식점 이어 붙임
    case 'cafe': return [{ api: 'tour', type: '39', lcls: 'FD05' }]
    case 'saved': return []                                  // 저장된 목록은 소스(API)가 없음
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
  if (item.kind === 'rest') return `음식점${item.biz ? `·${item.biz}` : ''}`
  if (item.lcls === 'FD05') return '카페'
  return TYPE_LABEL[item.type]
}

// 286 → '286m', 1234 → '1.2km'
export const fmtDist = (m) => (m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`)

// 카드 아래 한 줄: 거리 · 행사 기간 · 주소 (있는 것만)
export function subtitleOf(item) {
  if (item.kind === 'heritage') return item.city
  if (item.kind === 'rest') return [item.addr, item.tel].filter(Boolean).join(' · ')
  const period = item.start ? (item.start === item.end || !item.end ? item.start : `${item.start} ~ ${item.end}`) : ''
  return [item.dist !== undefined && fmtDist(item.dist), period, item.addr].filter(Boolean).join(' · ')
}

// 오늘 날짜(한국 시간) 'YYYY-MM-DD'
export const todayKst = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)

// 축제 카드용 진행 상태: 행사 기간 중 오늘이 어디쯤인지(진행률)와 상태 문구·색 계열
//   start·end 는 'YYYY-MM-DD'. 기간이 없으면 null. tone: good(진행 중) · citrus(곧 시작/곧 종료) · gold(예정) · muted(종료)
export function festivalStatus(start, end, today = todayKst()) {
  if (!start) return null
  const DAY = 86400000
  const s = Date.parse(start), e = Date.parse(end || start), t = Date.parse(today)
  if ([s, e, t].some(Number.isNaN)) return null
  if (t < s) {
    const d = Math.round((s - t) / DAY)
    return { state: 'upcoming', pct: 0, label: `D-${d} 시작`, tone: d <= 7 ? 'citrus' : 'gold' }
  }
  if (t > e) return { state: 'ended', pct: 100, label: '종료', tone: 'muted' }
  const total = Math.round((e - s) / DAY) + 1
  const elapsed = Math.round((t - s) / DAY) + 1
  const left = Math.round((e - t) / DAY)
  return {
    state: 'ongoing', pct: Math.round((elapsed / total) * 100),
    label: left === 0 ? '오늘 종료' : `진행 중 · D-${left} 종료`, tone: left <= 2 ? 'citrus' : 'good',
  }
}

// ── 근처 추천 (상세 모달) ─────────────────────────────────────
// 관광·문화 계열(관광지·국가유산·문화시설·축제·레포츠)을 보면 근처 음식점·카페를,
// 음식점·카페를 보면 근처 관광지를 추천합니다. 공연장은 좌표가 없어 추천이 없음.
export function recommendModeOf(item) {
  if (!item) return null
  if (item.kind === 'heritage') return 'spot'
  if (item.kind === 'rest') return Number(item.lat) > 0 && Number(item.lng) > 0 ? 'food' : null   // 좌표가 있어야 근처 관광지 추천
  if (item.kind === 'venue') return Number(item.lat) > 0 && Number(item.lng) > 0 ? 'spot' : null   // 공연장은 좌표가 채워진 뒤부터
  if (item.kind !== 'tour') return null
  const type = String(item.type)
  if (type === '39') return 'food'
  return ['12', '14', '15', '28'].includes(type) ? 'spot' : null
}

// 모드별로 어떤 곳을 몇 개씩 보여줄지. query 는 fetchNearby 인자 (xlcls = 이 분류는 제외)
export const RECOMMEND_GROUPS = {
  spot: [
    { key: 'food', title: '근처 음식점', icon: 'egg-fried', query: { type: '39', xlcls: 'FD05' }, count: 4 },
    { key: 'cafe', title: '근처 카페', icon: 'cup-hot', query: { type: '39', lcls: 'FD05' }, count: 4 },
  ],
  food: [
    { key: 'spot', title: '근처 관광지', icon: 'geo-alt', query: { type: '12' }, count: 6 },
  ],
}
export const RECOMMEND_RADII = [3, 10]   // km — 기본 3km, 비어 있으면 10km 로 넓힐 수 있음
