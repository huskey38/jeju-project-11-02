import { describe, expect, it } from 'vitest'
import data from '../server/data/oreum.js'
import { REGIONS, regionKeyOf, regionProgress } from '../src/lib/oreumRegions.js'
import { atmosphereAt } from '../src/lib/oreumAtmosphere.js'

describe('regionKeyOf — 오름 6지역', () => {
  it('읍·면은 지역으로, 동 지역은 제주시=북·서귀포시=남', () => {
    const at = (addr) => regionKeyOf({ addr })
    expect(at('제주특별자치도 제주시 애월읍 봉성리 산124')).toBe('nw')
    expect(at('제주특별자치도 제주시 한경면 청수리 1202')).toBe('nw')
    expect(at('제주특별자치도 제주시 조천읍 선흘리')).toBe('ne')
    expect(at('제주특별자치도 제주시 우도면 연평리')).toBe('ne')
    expect(at('제주특별자치도 서귀포시 대정읍 동일리 1209')).toBe('sw')
    expect(at('제주특별자치도 서귀포시 성산읍 고성리 887')).toBe('se')
    expect(at('제주특별자치도 제주시 오라동 1234')).toBe('n')
    expect(at('제주특별자치도 서귀포시 중문동 1234')).toBe('s')
  })
  it('공식 368곳이 빠짐없이 6지역에 나뉨 (북서 79·북 59·북동 72·남서 39·남 37·남동 82)', () => {
    const rows = regionProgress(data.items, new Set())
    expect(rows.map((r) => r.key)).toEqual(REGIONS.map((r) => r.key))
    expect(rows.reduce((a, r) => a + r.total, 0)).toBe(368)
    expect(rows.map((r) => r.total)).toEqual([79, 59, 72, 39, 37, 82])
  })
})

describe('regionProgress — 지역 달성률', () => {
  const list = [
    { id: '1', addr: '제주시 애월읍 a' }, { id: '2', addr: '제주시 애월읍 b' }, { id: '3', addr: '서귀포시 남원읍 c' },
  ]
  it('지역별 오른 수·비율, 다 오르면 done', () => {
    const r = Object.fromEntries(regionProgress(list, new Set(['1', '2'])).map((x) => [x.key, x]))
    expect(r.nw).toMatchObject({ total: 2, count: 2, percent: 100, done: true })
    expect(r.se).toMatchObject({ total: 1, count: 0, percent: 0, done: false })
    expect(r.n).toMatchObject({ total: 0, done: false })   // 오름이 없는 지역은 완주로 치지 않음
  })
})

describe('atmosphereAt — 등반률에 따른 하늘·바다 색', () => {
  it('0% 는 흐린 회청색, 5%~ 점점 맑아지고, 60% 이상은 노을빛 황금(그 뒤로 같음)', () => {
    expect(atmosphereAt(0).skyTop).toBe('#a9b5be')
    expect(atmosphereAt(60).skyTop).toBe('#f3a96b')
    expect(atmosphereAt(100)).toEqual(atmosphereAt(60))
    expect(atmosphereAt(-5)).toEqual(atmosphereAt(0))
  })
  it('중간 값은 두 단계 사이를 부드럽게 섞음 — 색 문자열 형식 유지', () => {
    const mid = atmosphereAt(25)
    for (const v of Object.values(mid)) expect(v).toMatch(/^#[0-9a-f]{6}$/)
    expect(mid.skyTop).not.toBe(atmosphereAt(15).skyTop)
    expect(mid.skyTop).not.toBe(atmosphereAt(35).skyTop)
  })
})
