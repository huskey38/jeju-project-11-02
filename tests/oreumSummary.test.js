import { describe, expect, it, vi } from 'vitest'
import summary from '../server/data/oreumSummary.js'
import data from '../server/data/oreum.js'
import { searchOreum } from '../server/oreum.js'
import { strip } from '../scripts/oreum-summary-strip.mjs'

vi.mock('../server/tour.js', () => ({ searchNearby: vi.fn(), searchFestivals: vi.fn(), searchTour: vi.fn(), getTourDetail: vi.fn() }))

describe('strip — 요약설명의 틀 문장 걷어내기', () => {
  it('"비고 N m의 ○형 화구를 지닌 화산체이다" 틀을 떼고 이름 유래·특징만 남김', () => {
    expect(strip('비고 101m의 말굽형(남서향) 화구를 지닌 화산체이다. 오름의 형세가 가세(가위)를 닮았다고 해서 붙여진 명칭이다.')).toBe('오름의 형세가 가세(가위)를 닮았다고 해서 붙여진 명칭이다.')
    expect(strip('비고 154m. 말굽형 형태의 오름. 산체가 밤알을 닮아 알밤오름이라 명칭되었다.')).toBe('산체가 밤알을 닮아 알밤오름이라 명칭되었다.')
  })
  it('틀뿐이면 빈 문자열(넣지 않음), 문장 주어가 잘리면 빈 문자열', () => {
    expect(strip('비고 49m의 원형 화구를 지닌 화산체이다.')).toBe('')
    expect(strip('비고 83m의 으로 잘 알려져 있다.')).toBe('')
  })
  it('"오름으로서" 같은 낱말은 틀로 보지 않고 떼지 않으며, 마침표를 쉼표로 쓴 곳은 이어 줌, 5.16 같은 숫자는 그대로', () => {
    expect(strip('비고 130m의 오름으로서 갖춰야 할 입지가 뚜렷하다.')).toBe('오름으로서 갖춰야 할 입지가 뚜렷하다.')
    expect(strip('비고 60m의 말굽형 화구를 지닌 화산체. 비고가 낮아 오르기 쉽고. 전망도 좋다.')).toBe('비고가 낮아 오르기 쉽고, 전망도 좋다.')
    expect(strip('비고 70m. 산책로가 5.16도로까지 이어져있다.')).toBe('산책로가 5.16도로까지 이어져있다.')
  })
})

describe('오름 이름 유래·특징 데이터 (scripts/build-oreum-summary.mjs 결과)', () => {
  const ids = Object.keys(summary.items)
  it('공식 오름 id 로만 연결되고, 한 이름은 한 오름에만, 안전 거리(2.5km) 안, 틀 문장이 남아 있지 않음', () => {
    expect(ids.length).toBeGreaterThan(60)
    expect(ids.every((id) => data.items.some((o) => o.id === id))).toBe(true)
    const names = ids.map((id) => summary.items[id].name)
    expect(new Set(names).size).toBe(names.length)
    for (const id of ids) {
      const e = summary.items[id]
      expect(e.dist).toBeLessThanOrEqual(2500)
      expect(e.text.length).toBeGreaterThan(8)
      expect(e.text).not.toMatch(/^비고\s*\d+\s*m|화구를 (?:지닌|가진) 화산체/)
    }
  })
  it('searchOreum 결과에 summary 가 합쳐지고, 연결 안 된 오름에는 없음', () => {
    const o = searchOreum({ keyword: '가시오름' }).find((x) => x.name === '가시오름')
    expect(o.summary).toContain('가시나무')
    const none = searchOreum({ rows: 400 }).find((x) => !summary.items[x.id])
    expect(none.summary).toBeUndefined()
  })
})
