import { describe, expect, it } from 'vitest'
import { TIERS, oreumProgress, tierOf } from '../src/lib/oreumProgress.js'
import { TERRAIN, TERRAIN_BBOX, heightAt, isJejuCoord, setHeightField, toXZ } from '../src/lib/geo.js'

// 관광공사에 등록된 오름은 tourId 가 있고(기록은 source 'tour'), 나머지는 공식 연번(기록은 source 'oreum')
const oreums = Array.from({ length: 10 }, (_, i) => ({ id: String(100 + i), ...(i < 5 && { tourId: String(9000 + i) }), title: `오름${i}`, lat: '33.4', lng: '126.5' }))
const tourOf = (id) => oreums.find((o) => o.id === String(id))?.tourId
const visit = (id, source) => (source ? { source, item_id: String(id) } : tourOf(id) ? { source: 'tour', item_id: tourOf(id) } : { source: 'oreum', item_id: String(id) })

describe('oreumProgress — 오름 등반률', () => {
  it('아무것도 안 가면 0/전체, 0%, 준비 중 칭호', () => {
    const p = oreumProgress([], oreums)
    expect(p).toMatchObject({ total: 10, count: 0, percent: 0, remaining: 10, done: false })
    expect(p.tier.title).toBe('오름 탐방 준비 중')
    expect(p.visitedIds.size).toBe(0)
  })
  it('가본 오름이 하나 체크될 때마다 1씩 오른다', () => {
    const rows = []
    const counts = []
    for (const id of ['100', '101', '102']) { rows.push(visit(id)); counts.push(oreumProgress(rows, oreums).count) }
    expect(counts).toEqual([1, 2, 3])
    expect(oreumProgress(rows, oreums).percent).toBe(30)
  })
  it('오름이 아닌 곳(다른 id·음식점 등 종류가 다른 것)과 중복 기록은 세지 않음', () => {
    const p = oreumProgress([visit(100), visit(100), visit(999, 'tour'), visit(101, 'rest'), visit(102, 'heritage'), visit(103)], oreums)
    expect(p.count).toBe(2)
    expect([...p.visitedIds].sort()).toEqual(['100', '103'])
  })
  it('id 가 숫자여도 문자열로 비교, 전부 가면 100% 와 done', () => {
    const p = oreumProgress(oreums.map((o) => visit(Number(o.id))), oreums)
    expect(p).toMatchObject({ count: 10, percent: 100, remaining: 0, done: true })
    expect(p.tier.title).toBe('오름 달인')
  })
  it('등록된 오름이 없으면 0% (0 으로 나누지 않음), 99.x% 는 100% 로 올리지 않음', () => {
    expect(oreumProgress([visit(1)], [])).toMatchObject({ total: 0, count: 0, percent: 0, done: false })
    const big = Array.from({ length: 368 }, (_, i) => ({ id: String(i) }))
    const p = oreumProgress(big.slice(0, 367).map((o) => ({ source: 'oreum', item_id: o.id })), big)
    expect(p.percent).toBe(99)
    expect(p.done).toBe(false)
  })
  it('칭호: 등반률 구간별', () => {
    expect(tierOf(0).title).toBe('오름 탐방 준비 중')
    expect(tierOf(1).title).toBe('오름 새내기')
    expect(tierOf(4).title).toBe('오름 새내기')
    expect(tierOf(5).title).toBe('오름 산책가')
    expect(tierOf(15).title).toBe('오름 탐험가')
    expect(tierOf(35).title).toBe('오름 지킴이')
    expect(tierOf(60).title).toBe('오름 달인')
    expect(tierOf(100).title).toBe('오름 달인')
    expect(TIERS.map((t) => t.min)).toEqual([0, 1, 5, 15, 35, 60])
  })
})

describe('geo — 3D 제주 좌표', () => {
  it('제주 범위 판별', () => {
    expect(isJejuCoord('33.45', '126.5')).toBe(true)
    expect(isJejuCoord(0, 0)).toBe(false)
    expect(isJejuCoord(37.5, 127)).toBe(false)
  })
  it('제주 중심은 원점, 동쪽은 +x, 남쪽은 +z', () => {
    const [x, z] = toXZ(33.38, 126.55)
    expect(x).toBeCloseTo(0); expect(z).toBeCloseTo(0)
    expect(toXZ(33.38, 126.9)[0]).toBeGreaterThan(0)
    expect(toXZ(33.25, 126.55)[1]).toBeGreaterThan(0)
  })
  it('지형 범위는 섬 모양에 맞게 좁혀져 있고 중심이 계산됨', () => {
    expect(TERRAIN.bbox).toBe(TERRAIN_BBOX)
    expect(TERRAIN.width).toBeCloseTo((TERRAIN_BBOX.east - TERRAIN_BBOX.west) * 20)
    expect(TERRAIN.depth).toBeCloseTo((TERRAIN_BBOX.north - TERRAIN_BBOX.south) * 20)
    for (const [la, ln] of [[33.45, 126.9], [33.10, 126.27], [33.52, 126.95]]) expect(isJejuCoord(la, ln)).toBe(true)   // 우도·마라도 방향도 범위 안
    const [hx, hz] = toXZ(33.36, 126.53)   // 한라산 정상 근처
    setHeightField(null)
    expect(heightAt(hx, hz)).toBeGreaterThan(heightAt(hx + 6, hz))   // 높이맵 없으면 한라산 쪽이 높은 종 모양
  })
  it('높이맵이 등록되면 그 높이를(3D 단위로) 돌려줌', () => {
    const w = 11, h = 11
    const data = new Float32Array(w * h).fill(100)
    setHeightField({ data, w, h })
    const [x, z] = toXZ(33.38, 126.55)
    expect(heightAt(x, z)).toBeCloseTo(100 * TERRAIN.metersToUnit)
    expect(heightAt(999, 999)).toBe(0)     // 범위 밖은 0
    setHeightField(null)
  })
})
