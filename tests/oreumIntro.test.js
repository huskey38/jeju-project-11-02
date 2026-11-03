import { describe, expect, it, vi } from 'vitest'
import intro from '../server/data/oreumIntro.js'
import data from '../server/data/oreum.js'
import { searchOreum } from '../server/oreum.js'
import { FIX, applyFix } from '../scripts/oreum-fix.mjs'

vi.mock('../server/tour.js', () => ({ searchNearby: vi.fn(), searchFestivals: vi.fn(), searchTour: vi.fn(), getTourDetail: vi.fn() }))

describe('오름 소개 보강 데이터 (scripts/build-oreum-intro.mjs 결과)', () => {
  const ids = Object.keys(intro.items)
  it('공식 오름 id 로만 연결되고, 한 관광지데이터 행(이름)은 한 오름에만 붙음', () => {
    expect(ids.length).toBeGreaterThan(70)
    expect(ids.every((id) => data.items.some((o) => o.id === id))).toBe(true)
    const names = ids.map((id) => intro.items[id].name)
    expect(new Set(names).size).toBe(names.length)
  })
  it('소개글이 있고, 안전 거리(2.5km) 안이며, 숙박 정보는 담지 않음', () => {
    for (const id of ids) {
      const e = intro.items[id]
      expect(e.intro.length).toBeGreaterThan(10)
      expect(e.dist).toBeLessThanOrEqual(2500)
      expect(Object.keys(e)).not.toContain('lodging')
      expect(e.intro).not.toMatch(/·\s/)   // 원본의 쉼표→'·' 깨짐을 고쳐 둠
    }
  })
  it('searchOreum 결과에 소개·편의시설·주차가 합쳐지고, 연결 안 된 오름에는 없음', () => {
    const o = searchOreum({ keyword: '가메오름' }).find((x) => x.name === '가메오름')
    expect(o.intro).toContain('분화구')
    expect(o.org).toBe('제주특별자치도청')
    const none = searchOreum({ rows: 400 }).find((x) => !intro.items[x.id])
    expect(none.intro).toBeUndefined()
  })
})

describe('좌표 수정표 (scripts/oreum-fix.mjs)', () => {
  it('수정한 7곳의 좌표가 적용돼 있고, 연결 해제한 오름은 관광공사 연결·사진이 없음', () => {
    for (const [id, f] of Object.entries(FIX)) {
      const o = data.items.find((x) => x.id === id)
      expect(o.lat).toBeCloseTo(f.lat, 5)
      expect(o.lng).toBeCloseTo(f.lng, 5)
      if (f.unlink) expect(o.tourId).toBeUndefined()
    }
  })
  it('applyFix 는 수정표에 없는 오름을 건드리지 않음', () => {
    const items = [{ id: '1', lat: 1, lng: 2, tourId: 'x' }, { id: '7', name: 'A', lat: 1, lng: 2, tourId: 'y', image: 'i' }]
    expect(applyFix(items)).toEqual(['A'])
    expect(items[0]).toEqual({ id: '1', lat: 1, lng: 2, tourId: 'x' })
    expect(items[1].tourId).toBeUndefined()
  })
})

describe('비짓제주 보완 사진 (scripts/build-oreum-photos.mjs)', () => {
  it('보완 사진은 https 이고 출처(by)가 있으며, 비짓제주 사진은 화면용 출처 표시가 붙음', async () => {
    const { default: images } = await import('../server/data/oreumImages.js')
    const entries = Object.entries(images)
    expect(entries.length).toBeGreaterThan(35)
    expect(entries.every(([, e]) => (/^https:\/\//.test(e.image) || /^\/oreum-photos\/\d+\.jpg$/.test(e.image)) && ['tour', 'visitjeju', 'jeju-aerial'].includes(e.by))).toBe(true)
    const [id] = entries.find(([, e]) => e.by === 'visitjeju')
    const o = searchOreum({ id })[0]
    expect(o.image).toMatch(/visitjeju/)
    expect(o.imageCredit).toBe('비짓제주(제주관광공사)')
    const t = entries.find(([, e]) => e.by === 'tour')
    if (t) expect(searchOreum({ id: t[0] })[0].imageCredit).toBe('한국관광공사')
    const own = data.items.find((x) => x.image)
    expect(searchOreum({ id: own.id })[0].imageCredit).toBe('한국관광공사')   // 관광공사 연결 사진도 출처 표기
  })
  it('관광공사 사진이 이미 있는 오름은 보완 사진으로 덮어쓰지 않음', () => {
    const withTour = data.items.find((o) => o.image)
    expect(searchOreum({ id: withTour.id })[0].image).toBe(withTour.image)
  })
})

describe('제주특별자치도 항공뷰에서 만든 일반 사진 (scripts/build-oreum-aerial.py)', () => {
  it('4곳(밝은오름·천아오름·갯거리오름·명월오름)의 사진 파일이 public 에 있고 용량이 작으며, 출처 표기가 붙음', async () => {
    const { existsSync, statSync } = await import('node:fs')
    const { default: images } = await import('../server/data/oreumImages.js')
    const aerial = Object.entries(images).filter(([, e]) => e.by === 'jeju-aerial')
    expect(aerial.map(([id]) => id).sort()).toEqual(['135', '16', '162', '345'])
    for (const [id, e] of aerial) {
      const file = new URL('../public' + e.image, import.meta.url)
      expect(existsSync(file)).toBe(true)
      expect(statSync(file).size).toBeLessThan(300 * 1024)
      const o = searchOreum({ id })[0]
      expect(o.image).toBe(e.image)
      expect(o.imageCredit).toBe('제주특별자치도(오름 항공뷰)')
    }
  })
})

