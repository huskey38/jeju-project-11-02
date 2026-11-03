// 오름 한 걸음의 '채워 가는 느낌' 기능들이 함께 쓰는 순수 계산 (화면 없음 → 테스트하기 쉽고, 기능을 빼도 남겨 둘 수 있음)
import { FORM_GROUPS, formGroupOf } from './oreumForms'
import { TIERS, oreumIdOf } from './oreumProgress'

const meters = (la1, ln1, la2, ln2) => {
  const k = 111320, dy = (la1 - la2) * k, dx = (ln1 - ln2) * k * Math.cos((la1 * Math.PI) / 180)
  return Math.hypot(dx, dy)
}

// 오름 id → 처음 가본 날(ISO 문자열). 같은 오름을 두 방식(관광공사 id·공식 연번)으로 기록했으면 더 이른 날
export function visitDates(visits = [], oreums = []) {
  const m = new Map()
  for (const v of visits) {
    const id = oreumIdOf(v, oreums)
    if (id === null) continue
    const at = v.created_at ?? ''
    if (!m.has(id) || (at && at < m.get(id))) m.set(id, at)
  }
  return m
}

// 묶음별 진행: keyOf(오름) → 묶음 키, groups: [{ key, label }] 순서. 합계가 0 인 묶음은 뺌
export function breakdown(oreums = [], visitedIds = new Set(), keyOf, groups) {
  const rows = new Map(groups.map((g) => [g.key, { ...g, total: 0, count: 0 }]))
  for (const o of oreums) {
    const r = rows.get(keyOf(o))
    if (!r) continue
    r.total++
    if (visitedIds.has(String(o.id))) r.count++
  }
  return [...rows.values()].filter((r) => r.total > 0).map((r) => ({ ...r, percent: Math.floor((r.count / r.total) * 100) }))
}

export const byForm = (oreums, visitedIds) => breakdown(oreums, visitedIds, (o) => formGroupOf(o.form).key, [...FORM_GROUPS, { key: 'etc', label: '기타' }])

export function byCity(oreums, visitedIds) {
  const cities = [...new Set(oreums.map((o) => o.city).filter(Boolean))].sort()
  return breakdown(oreums, visitedIds, (o) => o.city, cities.map((c) => ({ key: c, label: c })))
}

// 다음 등급까지: { tier(다음 등급), needCount(남은 오름 수), needTotal(그 등급에 필요한 총 오름 수) } — 마지막 등급이면 null
export function nextTier(count, total) {
  const percent = total ? Math.floor((count / total) * 100) : 0
  const next = TIERS.find((t) => t.min > percent)
  if (!next || !total) return null
  const needTotal = Math.ceil((next.min * total) / 100)
  return { tier: next, needTotal, needCount: Math.max(0, needTotal - count) }
}

// 기준 좌표에서 가까운 안 가 본 오름 n 곳 (dist: m)
export function nearestUnvisited(oreums = [], visitedIds = new Set(), lat, lng, n = 3) {
  return oreums
    .filter((o) => !visitedIds.has(String(o.id)) && Number.isFinite(Number(o.lat)))
    .map((o) => ({ ...o, dist: Math.round(meters(Number(lat), Number(lng), Number(o.lat), Number(o.lng))) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, n)
}

export const fmtDist = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${m}m`)
export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('ko-KR', { year: '2-digit', month: 'numeric', day: 'numeric' }) : '')
