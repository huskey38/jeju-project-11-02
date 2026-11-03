// 오름 6지역: 제주시(북)·서귀포시(남)를 기준으로 각각 서·가운데·동 세 구역으로 나눔
//   북서(애월) · 북(제주시) · 북동(조천) · 남서(대정) · 남(서귀포시) · 남동(성산)
// 지역 달성률 = 그 지역 오름 중 오른 오름 수 ÷ 지역 오름 수. 3D 지도의 지역 이름표와 '지역별' 진행률 패널이 함께 씀
export const REGIONS = [
  { key: 'nw', area: '북서', label: '애월', towns: '애월읍·한림읍·한경면', lat: 33.4627, lng: 126.3306 },
  { key: 'n', area: '북', label: '제주시', towns: '제주시 동 지역', lat: 33.4996, lng: 126.5312 },
  { key: 'ne', area: '북동', label: '조천', towns: '조천읍·구좌읍·우도면', lat: 33.54, lng: 126.72 },
  { key: 'sw', area: '남서', label: '대정', towns: '대정읍·안덕면', lat: 33.2216, lng: 126.2512 },
  { key: 's', area: '남', label: '서귀포시', towns: '서귀포시 동 지역', lat: 33.2541, lng: 126.5601 },
  { key: 'se', area: '남동', label: '성산', towns: '남원읍·표선면·성산읍', lat: 33.43, lng: 126.86 },
]

// 읍·면 → 지역 (읍·면이 없는 동 지역은 행정시 기준으로 가운데 지역)
const TOWN_REGION = {
  애월읍: 'nw', 한림읍: 'nw', 한경면: 'nw',
  조천읍: 'ne', 구좌읍: 'ne', 우도면: 'ne',
  대정읍: 'sw', 안덕면: 'sw',
  남원읍: 'se', 표선면: 'se', 성산읍: 'se',
}

// 공식 소재지(예: '제주특별자치도 제주시 애월읍 봉성리 산124')로 지역 키를 구함
export function regionKeyOf(oreum) {
  const parts = String(oreum?.addr ?? '').split(/\s+/)
  const town = parts.find((p) => TOWN_REGION[p])
  if (town) return TOWN_REGION[town]
  return parts.includes('서귀포시') || /서귀포/.test(String(oreum?.city ?? '')) ? 's' : 'n'
}

// 지역별 진행: [{ ...지역, total, count, percent, done }] (REGIONS 순서)
export function regionProgress(oreums = [], visitedIds = new Set()) {
  const rows = new Map(REGIONS.map((r) => [r.key, { ...r, total: 0, count: 0 }]))
  for (const o of oreums) {
    const r = rows.get(regionKeyOf(o))
    r.total++
    if (visitedIds.has(String(o.id))) r.count++
  }
  return [...rows.values()].map((r) => ({ ...r, percent: r.total ? Math.floor((r.count / r.total) * 100) : 0, done: r.total > 0 && r.count === r.total }))
}
