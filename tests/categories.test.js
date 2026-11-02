import { describe, expect, it } from 'vitest'
import { CATEGORIES, NEAR_TYPES, RADII, SUBS, advance, badgeOf, fmtDist, sourcesFor, subsOf, subtitleOf } from '../src/lib/placeCategories.js'

describe('분류 버튼', () => {
  it('요청한 6개 분류 + 내 주변, 관광지 하위 선택 3개', () => {
    expect(CATEGORIES.map((c) => c.label)).toEqual(['전체', '관광지', '문화시설', '축제·행사', '음식점', '카페', '내 주변'])
    expect(SUBS.map((s) => s.label)).toEqual(['전체', '일반', '국가유산'])
  })
  it('하위 선택: 관광지 = 국가유산 등, 내 주변 = 유형(내 주변 자신은 제외), 그 외는 없음', () => {
    expect(subsOf('spot')).toBe(SUBS)
    expect(subsOf('near')).toBe(NEAR_TYPES)
    expect(NEAR_TYPES.map((t) => t.key)).toEqual(['all', 'spot', 'culture', 'festival', 'food', 'cafe'])
    expect(subsOf('cafe')).toBeNull()
    expect(RADII).toEqual([1, 3, 5, 10])
  })
})

describe('sourcesFor — 분류별 데이터 소스', () => {
  it('전체 = 숙박(32)을 뺀 TourAPI 유형들 → 국가유산', () => {
    const s = sourcesFor('all')
    expect(s.filter((x) => x.api === 'tour').map((x) => x.type)).toEqual(['12', '14', '15', '28', '38', '39'])
    expect(s.at(-1)).toEqual({ api: 'heritage' })
    expect(sourcesFor('아무거나')).toEqual(s)
  })
  it('숙박(유형 32)은 어떤 분류에도 없음', () => {
    const cats = CATEGORIES.map((c) => c.key)
    for (const c of cats) for (const sub of ['all', 'general', 'heritage', ...NEAR_TYPES.map((t) => t.key)]) {
      expect(sourcesFor(c, sub).some((x) => x.type === '32')).toBe(false)
    }
  })
  it('관광지: 전체(일반→국가유산) / 일반 / 국가유산', () => {
    expect(sourcesFor('spot', 'all')).toEqual([{ api: 'tour', type: '12' }, { api: 'heritage' }])
    expect(sourcesFor('spot', 'general')).toEqual([{ api: 'tour', type: '12' }])
    expect(sourcesFor('spot', 'heritage')).toEqual([{ api: 'heritage' }])
  })
  it('문화시설·카페, 축제는 기간 검색 소스', () => {
    expect(sourcesFor('culture')).toEqual([{ api: 'tour', type: '14' }])
    expect(sourcesFor('festival')).toEqual([{ api: 'festival' }])
    expect(sourcesFor('cafe')).toEqual([{ api: 'tour', type: '39', lcls: 'FD05' }])
  })
  it('음식점은 카페(FD05)를 뺀 한식·양식·일식 순', () => {
    const lcls = sourcesFor('food').map((s) => s.lcls)
    expect(lcls).toEqual(['FD01', 'FD02', 'FD03'])
    expect(lcls).not.toContain('FD05')
  })
  it('내 주변: 유형별 조건 (음식점은 카페 제외, 카페는 FD05만)', () => {
    expect(sourcesFor('near')).toEqual([{ api: 'near' }])
    expect(sourcesFor('near', 'spot')).toEqual([{ api: 'near', type: '12' }])
    expect(sourcesFor('near', 'food')).toEqual([{ api: 'near', type: '39', xlcls: 'FD05' }])
    expect(sourcesFor('near', 'cafe')).toEqual([{ api: 'near', type: '39', lcls: 'FD05' }])
    expect(sourcesFor('near', '없는유형')).toEqual([{ api: 'near' }])
  })
})

describe('advance — 쪽/소스 이동', () => {
  it('가득 찬 쪽이면 같은 소스의 다음 쪽', () => {
    expect(advance({ i: 0, page: 1 }, 12, 12)).toEqual({ i: 0, page: 2 })
    expect(advance({ i: 1, page: 4 }, 12, 12)).toEqual({ i: 1, page: 5 })
  })
  it('덜 찼거나 비면 다음 소스의 첫 쪽', () => {
    expect(advance({ i: 0, page: 3 }, 5, 12)).toEqual({ i: 1, page: 1 })
    expect(advance({ i: 0, page: 2 }, 0, 12)).toEqual({ i: 1, page: 1 })
  })
  it('소스 목록을 끝까지 소진하는 시뮬레이션 (한식 25 → 양식 3 → 일식 0)', () => {
    const sizes = [25, 3, 0]
    const rows = 12
    let cur = { i: 0, page: 1 }, got = 0, calls = 0
    while (cur.i < sizes.length) {
      const n = Math.max(0, Math.min(rows, sizes[cur.i] - (cur.page - 1) * rows))
      got += n; calls++
      cur = advance(cur, n, rows)
    }
    expect(got).toBe(28)
    expect(calls).toBe(5)
  })
})

describe('badgeOf', () => {
  it('국가유산·카페·유형 배지, 숙박은 라벨 없음', () => {
    expect(badgeOf({ kind: 'heritage', kindName: '보물' })).toBe('국가유산·보물')
    expect(badgeOf({ kind: 'heritage' })).toBe('국가유산')
    expect(badgeOf({ kind: 'tour', type: '39', lcls: 'FD05' })).toBe('카페')
    expect(badgeOf({ kind: 'tour', type: '39', lcls: 'FD01' })).toBe('음식점')
    expect(badgeOf({ kind: 'tour', type: '12' })).toBe('관광지')
    expect(badgeOf({ kind: 'tour', type: '28' })).toBe('레포츠')
    expect(badgeOf({ kind: 'tour', type: '32' })).toBeUndefined()
  })
})

describe('거리·부제목', () => {
  it('fmtDist', () => {
    expect(fmtDist(286)).toBe('286m')
    expect(fmtDist(999)).toBe('999m')
    expect(fmtDist(1234)).toBe('1.2km')
  })
  it('subtitleOf: 거리 · 기간 · 주소 (있는 것만), 국가유산은 시·군', () => {
    expect(subtitleOf({ kind: 'tour', dist: 286, addr: '제주시 광양10길' })).toBe('286m · 제주시 광양10길')
    expect(subtitleOf({ kind: 'tour', start: '2026-11-06', end: '2026-11-10', addr: '제주시' })).toBe('2026-11-06 ~ 2026-11-10 · 제주시')
    expect(subtitleOf({ kind: 'tour', start: '2026-11-06', end: '2026-11-06', addr: '제주시' })).toBe('2026-11-06 · 제주시')
    expect(subtitleOf({ kind: 'tour', addr: '제주시' })).toBe('제주시')
    expect(subtitleOf({ kind: 'heritage', city: '제주시' })).toBe('제주시')
    expect(subtitleOf({ kind: 'tour', dist: 0, addr: '제주시' })).toBe('0m · 제주시')
  })
})
