import { fetchNearby, fetchOreum, fetchPlaces, fetchRestaurants } from '../api/client'

// 목록 화면(Places)이 쓰는 값과 순수 함수 모음 — 화면 파일에서 분리했음
export const ROWS = 12   // 한 번에 가져오는 개수 (더 보기로 다음 쪽)
export const CITY_HALL = { lat: 33.4996, lng: 126.5312 }   // 위치를 못 얻을 때 기준 (제주시청)
// 가볼만한 곳(저장된 행)에 붙이는 종류 배지
export const SOURCE_LABEL = { tour: '관광·문화', heritage: '국가유산', venue: '공연장', rest: '일반음식점', oreum: '오름' }
export const SORTS = [{ key: '', label: '추천순' }, { key: 'name', label: '이름순' }, { key: 'elev', label: '표고 높은 순' }, { key: 'elev_asc', label: '표고 낮은 순' }]   // 오름 정렬 ('' = 추천순이 기본, 내 주변을 켜면 가까운 순)
// 화면에서만 뺀 테마 칩(규칙·AI 가이드의 검색 조건은 그대로): 오름의 '분화구·굼부리'
export const HIDDEN_TAGS = { oreum: ['crater'] }
export const serverSort = (so) => (so === '' ? 'recommend' : so === 'name' ? '' : so)   // 화면의 정렬 키 → 서버 정렬 값
// 목록 항목 → 즐겨찾기 키 (favorites 테이블의 source·item_id 와 같은 규칙)
export const favOf = (it) => it.kind === 'heritage' ? { source: 'heritage', id: it.name, title: it.name }
  : it.kind === 'venue' ? { source: 'venue', id: it.id, title: it.title }
  : it.kind === 'rest' ? { source: 'rest', id: it.id, title: it.title }
  // 오름: 관광공사에 등록된 곳은 예전 기록(관광공사 id)과 같은 키를 써서 기존 가본 곳·가볼만한 곳이 그대로 이어지고, 나머지는 공식 연번
  : it.kind === 'oreum' ? (it.tourId ? { source: 'tour', id: it.tourId, title: it.title } : { source: 'oreum', id: it.id, title: it.title })
  : { source: 'tour', id: it.id, title: it.title }
export const valid = (list, v, fallback) => (list?.some((x) => x.key === v) ? v : fallback)

// 소스 하나(TourAPI·일반음식점·오름 색인·주변)의 한 쪽을 받아 화면용 항목으로 맞춤 — API 별 모양 차이는 여기서 흡수
// ctx: { keyword, coords, radiusKm }
export async function fetchPage(src, ctx, page) {
  if (src.api === 'rest') {
    const list = await fetchRestaurants(ctx.keyword, src.biz, page, ROWS)
    return list.map((r) => ({ ...r, kind: 'rest', key: `r-${r.id}` }))
  }
  let list
  if (src.api === 'oreum') {
    const near = src.near && ctx.coords ? { lat: ctx.coords.lat, lng: ctx.coords.lng, radius: ctx.radiusKm * 1000 } : {}   // 내 위치 반경 안을 가까운 순으로
    if (ctx.unvisited) {   // 안 가 본 오름만: 같은 조건으로 전부 받아 가본 곳을 빼고 쪽을 직접 나눔
      const all = await fetchOreum({ keyword: ctx.keyword, form: src.form, tags: src.tags, sort: src.sort, ...near, page: 1, rows: 400 })
      const todo = all.filter((o) => { const f = favOf({ ...o, kind: 'oreum' }); return !ctx.visitedKeys.has(`${f.source}:${f.id}`) })
      return todo.slice((page - 1) * ROWS, page * ROWS).map((o) => ({ ...o, kind: 'oreum', key: `o-${o.id}` }))
    }
    const list = await fetchOreum({ keyword: ctx.keyword, form: src.form, tags: src.tags, sort: src.sort, ...near, page, rows: ROWS })
    return list.map((o) => ({ ...o, kind: 'oreum', key: `o-${o.id}` }))
  }
  if (src.api === 'near') {
    list = await fetchNearby({ ...ctx.coords, radius: ctx.radiusKm * 1000, type: src.type, lcls: src.lcls, xlcls: src.xlcls, page, rows: ROWS })
  } else {
    list = await fetchPlaces(ctx.keyword, src.type, page, ROWS, src.lcls)
  }
  return list.map((p) => ({ ...p, kind: 'tour', key: `t-${p.id}` }))
}

// 오름 정보 카드의 공식 보강 정보(관내 관광지데이터): 편의시설·주차·관리기관, 그리고 소개글을 쓰는 경우의 출처 (소개글은 관광공사 소개가 없을 때만 보여 줌)
const INTRO_SOURCE = '제주특별자치도 관내 관광지데이터(2025-12-31)'
const SUMMARY_SOURCE = '제주특별자치도 제주오름요약설명(2021-11-30)'
export const oreumExtraRows = (b, usesIntro) => [
  ...(b.summary ? [{ label: '이름·특징', value: b.summary }, { label: '특징 출처', value: SUMMARY_SOURCE }] : []),
  { label: '편의시설', value: b.facilities?.join(', ') },
  { label: '주차', value: b.parking ? `${b.parking}대` : '' },
  { label: '관리', value: b.org ? `${b.org}${b.tel ? ` (${b.tel})` : ''}` : '' },
  ...(usesIntro && b.intro ? [{ label: '소개 출처', value: INTRO_SOURCE }] : []),
]
