import { FORM_GROUPS, formGroupOf } from './oreumForms'

// 메인의 '오름에 대해 더 자세히' 말풍선에 쓰는 숫자들 — 공식 오름 목록에서 직접 계산 (데이터가 바뀌면 글도 따라 바뀜)
export const EASY_ELEV = 300   // m 이하면 '비교적 가볍게' 오를 수 있는 높이로 봄

export function oreumFacts(list = []) {
  const total = list.length
  if (!total) return null
  const byForm = FORM_GROUPS.map((g) => ({ ...g, count: list.filter((o) => formGroupOf(o.form).key === g.key).length }))
  const withElev = list.filter((o) => Number.isFinite(o.elev))
  const lowest = [...withElev].sort((a, b) => a.elev - b.elev)[0] ?? null
  const highest = [...withElev].sort((a, b) => b.elev - a.elev)[0] ?? null
  const easy = withElev.filter((o) => o.elev <= EASY_ELEV).length
  return {
    total,
    byForm,
    mostForm: [...byForm].sort((a, b) => b.count - a.count)[0],
    lowest, highest,
    easy, easyPercent: withElev.length ? Math.round((easy / withElev.length) * 100) : 0,
  }
}
