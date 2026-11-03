import { describe, expect, it } from 'vitest'
import data from '../server/data/oreum.js'
import { EASY_ELEV, oreumFacts } from '../src/lib/oreumFacts.js'

describe('oreumFacts — 오름 소개 말풍선의 숫자', () => {
  it('공식 368곳: 형태별 합이 전체, 가장 많은 형태, 낮은·높은 오름', () => {
    const f = oreumFacts(data.items)
    expect(f.total).toBe(368)
    expect(f.byForm.reduce((a, g) => a + g.count, 0)).toBeLessThanOrEqual(368)
    expect(f.mostForm.label).toBe('말굽형')
    expect(f.lowest.elev).toBeLessThan(100)
    expect(f.highest.elev).toBeGreaterThan(1500)
    expect(f.easy).toBe(data.items.filter((o) => o.elev <= EASY_ELEV).length)
    expect(f.easyPercent).toBe(Math.round((f.easy / data.items.filter((o) => Number.isFinite(o.elev)).length) * 100))
  })
  it('작은 목록 계산 / 빈 목록은 null / 표고 없는 오름은 높이 계산에서 제외', () => {
    const f = oreumFacts([{ name: 'A', form: '원추형', elev: 100 }, { name: 'B', form: '원형', elev: EASY_ELEV + 1 }, { name: 'C', form: '원형', elev: null }])
    expect(f).toMatchObject({ total: 3, easy: 1, easyPercent: 50 })
    expect(f.lowest.name).toBe('A'); expect(f.highest.name).toBe('B')
    expect(oreumFacts([])).toBeNull()
  })
})
