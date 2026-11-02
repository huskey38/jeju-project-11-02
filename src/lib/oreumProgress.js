// 오름 등반률: '가본 곳'에 체크한 오름 수 ÷ 제주 오름 현황의 오름 수(공식 368곳)
// visits: Supabase visits 행 [{ source, item_id }]  /  oreums: 오름 목록 [{ id, tourId?, title, lat, lng }] (오름 탭과 같은 현황)
// 기록 키: 관광공사에 등록된 오름은 예전처럼 source 'tour' + 관광공사 id, 그 밖의 오름은 source 'oreum' + 공식 연번 — 둘 다 같은 오름으로 셈.
// 오름이 아닌 곳(음식점·카페 등)을 가본 곳에 담아도 등반률에는 들어가지 않음. 같은 오름을 두 번 세지 않음.

// 등반률(%)에 따른 등급(새내기 → 산책가 → 탐험가 → 지킴이 → 달인): min 이상이면 해당 등급
export const TIERS = [
  { min: 0, title: '오름 탐방 준비 중', hint: '첫 오름에 체크하면 지도에 마크가 찍혀요' },   // 0% 는 등급 없이 시작 상태
  { min: 1, title: '오름 새내기', hint: '첫 발걸음! 다음 오름도 찍어 보세요' },
  { min: 5, title: '오름 산책가', hint: '제주 오름이 점점 익숙해져요' },
  { min: 15, title: '오름 탐험가', hint: '형태와 지역을 넓혀 가고 있어요' },
  { min: 35, title: '오름 지킴이', hint: '제주 오름을 지켜 주는 단골이에요' },
  { min: 60, title: '오름 달인', hint: '제주 오름의 대부분을 올랐어요' },
]

export function tierOf(percent) {
  return [...TIERS].reverse().find((t) => percent >= t.min) ?? TIERS[0]
}

// 기록 한 줄이 가리키는 오름의 공식 id (오름이 아니면 null)
export function oreumIdOf(visit, oreums) {
  const id = String(visit.item_id)
  if (visit.source === 'oreum') return oreums.some((o) => String(o.id) === id) ? id : null
  if (visit.source === 'tour') return oreums.find((o) => o.tourId && String(o.tourId) === id)?.id.toString() ?? null
  return null
}

export function oreumProgress(visits = [], oreums = []) {
  const visitedIds = new Set()
  for (const v of visits) { const id = oreumIdOf(v, oreums); if (id !== null) visitedIds.add(id) }
  const total = oreums.length
  const count = visitedIds.size
  const percent = total ? Math.floor((count / total) * 100) : 0   // 100% 는 전부 올랐을 때만
  return { total, count, percent, remaining: total - count, visitedIds, tier: tierOf(percent), done: total > 0 && count === total }
}
