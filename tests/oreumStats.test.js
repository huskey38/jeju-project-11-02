import { describe, expect, it } from 'vitest'
import { breakdown, byCity, byForm, fmtDist, nearestUnvisited, nextTier, visitDates } from '../src/lib/oreumStats.js'
import { FEATURES } from '../src/lib/features.js'

const oreums = [
  { id: '1', name: 'A', city: '제주시', form: '원추형', lat: 33.40, lng: 126.50, tourId: '900' },
  { id: '2', name: 'B', city: '제주시', form: '말굽형(북향)', lat: 33.41, lng: 126.51 },
  { id: '3', name: 'C', city: '서귀포시', form: '말굽형(서향)', lat: 33.30, lng: 126.60 },
  { id: '4', name: 'D', city: '서귀포시', form: '복합형', lat: 33.31, lng: 126.61 },
]

describe('기능 스위치', () => {
  it('모든 기능이 켜짐/꺼짐 값(boolean)', () => {
    expect(Object.keys(FEATURES).sort()).toEqual(['homeProgress', 'nextStep', 'progressBreakdown', 'stampBook', 'visitEffect', 'visitPhoto', 'visitedFilter'])
    expect(Object.values(FEATURES).every((v) => typeof v === 'boolean')).toBe(true)
  })
})

describe('visitDates — 오름을 처음 가본 날', () => {
  it('오름 아닌 기록은 제외, 두 방식 기록은 더 이른 날', () => {
    const m = visitDates([
      { source: 'tour', item_id: '900', created_at: '2026-11-03T00:00:00Z' },
      { source: 'oreum', item_id: '1', created_at: '2026-11-01T00:00:00Z' },
      { source: 'oreum', item_id: '3', created_at: '2026-11-02T00:00:00Z' },
      { source: 'rest', item_id: '9', created_at: '2026-11-02T00:00:00Z' },
    ], oreums)
    expect([...m.keys()].sort()).toEqual(['1', '3'])
    expect(m.get('1')).toBe('2026-11-01T00:00:00Z')
  })
})

describe('형태·지역별 진행률', () => {
  const visited = new Set(['1', '3'])
  it('형태 묶음(방향 표기는 묶음)별 가본 수·비율', () => {
    const r = byForm(oreums, visited)
    expect(r.map((x) => [x.label, x.count, x.total, x.percent])).toEqual([['원추형', 1, 1, 100], ['말굽형', 1, 2, 50], ['복합형', 0, 1, 0]])
  })
  it('지역별', () => {
    expect(byCity(oreums, visited).map((x) => [x.label, x.count, x.total])).toEqual([['서귀포시', 1, 2], ['제주시', 1, 2]])
  })
  it('빈 묶음은 숨김, 목록이 비어도 안 깨짐', () => {
    expect(breakdown([], new Set(), (o) => o.city, [{ key: 'x', label: 'x' }])).toEqual([])
  })
})

describe('nextTier — 다음 등급까지', () => {
  it('368곳 기준: 4곳이 새내기(1%), 19곳이 산책가(5%)', () => {
    expect(nextTier(0, 368)).toMatchObject({ tier: { title: '오름 새내기' }, needTotal: 4, needCount: 4 })
    expect(nextTier(4, 368)).toMatchObject({ tier: { title: '오름 산책가' }, needTotal: 19, needCount: 15 })
  })
  it('마지막 등급이면 null, 전체가 0 이어도 null', () => {
    expect(nextTier(250, 368)).toBeNull()
    expect(nextTier(0, 0)).toBeNull()
  })
})

describe('nearestUnvisited — 가까운 안 가 본 오름', () => {
  it('가본 곳은 빼고 가까운 순으로 n 곳', () => {
    const r = nearestUnvisited(oreums, new Set(['2']), 33.40, 126.50, 2)
    expect(r.map((o) => o.id)).toEqual(['1', '4'])
    expect(r[0].dist).toBeLessThan(r[1].dist)
  })
  it('거리 표기', () => { expect(fmtDist(850)).toBe('850m'); expect(fmtDist(1540)).toBe('1.5km') })
})
