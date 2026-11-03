import { describe, expect, it } from 'vitest'
import { CATEGORIES, DEFAULT_CAT, NEAR_CATS, RADII, RECOMMEND_GROUPS, RECOMMEND_RADII, advance, badgeOf, fmtDist, recommendModeOf, sourcesFor, subsOf, subtitleOf, FOOD_TYPES, todayKst, parseSub } from '../src/lib/placeCategories.js'

describe('분류 버튼', () => {
  it('오름이 맨 앞·기본 분류, 음식점·카페, 그 뒤에 가볼만한 곳·가본 곳 (관광지·문화시설·축제·전체는 없음)', () => {
    expect(CATEGORIES.map((c) => c.label)).toEqual(['오름 찾기', '음식점', '카페', '담아둔 곳', '오른 오름'])
  })
  it('하위 선택은 음식점만, 내 주변은 오름·음식점·카페에서 반경 1·3·5km (가볼만한 곳·가본 곳은 내 주변 없음)', () => {
    expect(subsOf('oreum')).toBeNull()
    expect(subsOf('cafe')).toBeNull()
    expect(NEAR_CATS).toEqual(['oreum', 'food', 'cafe'])
    expect(RADII).toEqual([1, 3, 5])
  })
})

describe('오름 분류', () => {
  it('기본 분류는 오름, 소스는 색인(태그)이고 내 주변이면 near 표시', () => {
    expect(DEFAULT_CAT).toBe('oreum')
    expect(sourcesFor('oreum')).toEqual([{ api: 'oreum', tags: [], near: false, form: '', sort: '' }])
    expect(sourcesFor('oreum', 'all', false, ['sunrise'])).toEqual([{ api: 'oreum', tags: ['sunrise'], near: false, form: '', sort: '' }])
    expect(sourcesFor('oreum', 'all', true, ['view'])).toEqual([{ api: 'oreum', tags: ['view'], near: true, form: '', sort: '' }])   // 오름은 내 주변에서도 태그를 함께 씀
    expect(sourcesFor('oreum', 'all', false, [], { form: 'horseshoe', sort: 'elev' })).toEqual([{ api: 'oreum', tags: [], near: false, form: 'horseshoe', sort: 'elev' }])
  })
  it('오름 카드: 배지(형태, 방향 제외)·부제목(거리·행정시·표고)·근처 음식점·카페 추천', () => {
    const o = { kind: 'oreum', title: '가마오름', form: '말굽형(북동향)', city: '제주시', elev: 140.5, lat: 33.3, lng: 126.2 }
    expect(badgeOf(o)).toBe('오름·말굽형')
    expect(badgeOf({ kind: 'oreum' })).toBe('오름')
    expect(subtitleOf(o)).toBe('제주시 · 표고 140.5m')
    expect(subtitleOf({ ...o, dist: 2436 })).toBe('2.4km · 제주시 · 표고 140.5m')
    expect(recommendModeOf(o)).toBe('spot')
    expect(recommendModeOf({ ...o, lat: null, lng: null })).toBeNull()
  })
})

describe('sourcesFor — 분류별 데이터 소스', () => {
  it('지워진 분류(전체·관광지·문화시설·축제·행사)와 모르는 분류는 소스가 없음', () => {
    for (const c of ['all', 'spot', 'culture', 'festival', '아무거나']) expect(sourcesFor(c)).toEqual([])
  })
  it('숙박(유형 32)은 어떤 분류에도 없음', () => {
    const cats = CATEGORIES.map((c) => c.key)
    for (const c of cats) for (const sub of ['all', 'raw']) for (const near of [false, true]) {
      expect(sourcesFor(c, sub, near).some((x) => x.type === '32')).toBe(false)
    }
  })
  it('카페는 FD05 한 가지', () => {
    expect(sourcesFor('cafe')).toEqual([{ api: 'tour', type: '39', lcls: 'FD05' }])
  })
  it('음식점은 카페(FD05)를 뺀 한식·양식·일식 순', () => {
    const food = sourcesFor('food')
    const lcls = food.filter((s) => s.api === 'tour').map((s) => s.lcls)
    expect(lcls).toEqual(['FD01', 'FD02', 'FD03'])
    expect(lcls).not.toContain('FD05')
    expect(food.at(-1)).toEqual({ api: 'rest', biz: '' })   // 관광공사 음식점 뒤에 일반음식점이 이어짐
  })
  it('음식점 종류 선택: 관광공사 분류코드(lcls)와 일반음식점 업태(biz)를 합쳐서, 하나만 있으면 그 쪽만', () => {
    expect(subsOf('food')).toBe(FOOD_TYPES)
    expect(subsOf('cafe')).toBeNull()
    expect(parseSub('food', 'raw')).toBe('raw')
    expect(parseSub('food', 'xx')).toBe('all')
    expect(sourcesFor('food', 'korean')).toEqual([{ api: 'tour', type: '39', lcls: 'FD01' }, { api: 'rest', biz: '한식' }])
    expect(sourcesFor('food', 'japanese')).toEqual([{ api: 'tour', type: '39', lcls: 'FD020200' }, { api: 'rest', biz: '일식' }])
    expect(sourcesFor('food', 'raw')).toEqual([{ api: 'rest', biz: '횟집' }])       // 업태만 있는 칩
    expect(sourcesFor('food', 'all')).toHaveLength(4)
    expect(sourcesFor('food', 'snack', true)).toEqual([{ api: 'near', type: '39', lcls: 'FD030400' }])   // 위치 검색은 관광공사 데이터만
    expect(sourcesFor('food', 'raw', true)).toEqual([{ api: 'near', type: '39', xlcls: 'FD05' }])        // 업태만 있는 칩은 위치 검색에 반영 안 됨
    expect(sourcesFor('food', 'all', true)).toEqual([{ api: 'near', type: '39', xlcls: 'FD05' }])
    expect(sourcesFor('cafe', 'chinese')).toEqual([{ api: 'tour', type: '39', lcls: 'FD05' }])   // 음식점 종류는 카페에 영향 없음
    for (const t of FOOD_TYPES.filter((x) => x.lcls)) expect(t.lcls).not.toMatch(/^FD05/)          // 카페 코드는 섞이지 않음
  })
  it('내 주변을 켜면 분류별 유형 조건으로 위치 검색 (음식점은 카페 제외, 카페는 FD05만, 가볼만한 곳은 해당 없음)', () => {
    expect(sourcesFor('food', 'all', true)).toEqual([{ api: 'near', type: '39', xlcls: 'FD05' }])
    expect(sourcesFor('cafe', 'all', true)).toEqual([{ api: 'near', type: '39', lcls: 'FD05' }])
    expect(sourcesFor('saved', 'all', true)).toEqual([])
    expect(sourcesFor('food')).toHaveLength(4)   // 끄면 원래 소스(관광공사 3 + 일반음식점)
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

describe('todayKst', () => {
  it('한국 시간 오늘 (YYYY-MM-DD)', () => {
    expect(todayKst()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('근처 추천 규칙 (recommendModeOf · RECOMMEND_GROUPS)', () => {
  it('관광지·문화시설·축제·레포츠·국가유산 → spot (근처 음식점·카페 추천)', () => {
    for (const type of ['12', '14', '15', '28', 12]) expect(recommendModeOf({ kind: 'tour', type })).toBe('spot')
    expect(recommendModeOf({ kind: 'heritage' })).toBe('spot')
  })
  it('음식점·카페(유형 39, FD05 포함) → food (근처 관광지 추천)', () => {
    expect(recommendModeOf({ kind: 'tour', type: '39', lcls: 'FD01' })).toBe('food')
    expect(recommendModeOf({ kind: 'tour', type: '39', lcls: 'FD05' })).toBe('food')
    expect(recommendModeOf({ kind: 'tour', type: 39 })).toBe('food')
  })
  it('공연장(좌표 없음)·숙박·쇼핑·알 수 없는 항목은 추천 없음', () => {
    expect(recommendModeOf({ kind: 'venue' })).toBeNull()
    expect(recommendModeOf({ kind: 'tour', type: '32' })).toBeNull()
    expect(recommendModeOf({ kind: 'tour', type: '38' })).toBeNull()
    expect(recommendModeOf({ kind: 'tour' })).toBeNull()
    expect(recommendModeOf(null)).toBeNull()
    expect(recommendModeOf(undefined)).toBeNull()
  })
  it('spot 은 음식점(카페 제외)과 카페 두 묶음, food 는 관광지 한 묶음', () => {
    expect(RECOMMEND_GROUPS.spot.map((g) => g.key)).toEqual(['food', 'cafe'])
    expect(RECOMMEND_GROUPS.spot[0].query).toEqual({ type: '39', xlcls: 'FD05' })   // 음식점에서 카페는 빼서 두 묶음이 겹치지 않음
    expect(RECOMMEND_GROUPS.spot[1].query).toEqual({ type: '39', lcls: 'FD05' })
    expect(RECOMMEND_GROUPS.food.map((g) => g.key)).toEqual(['spot'])
    expect(RECOMMEND_GROUPS.food[0].query).toEqual({ type: '12' })
  })
  it('추천 묶음에 숙박(32)이 없고, 반경은 3km → 10km', () => {
    const all = [...RECOMMEND_GROUPS.spot, ...RECOMMEND_GROUPS.food]
    expect(all.some((g) => g.query.type === '32')).toBe(false)
    expect(all.every((g) => g.count > 0 && g.title && g.icon)).toBe(true)
    expect(RECOMMEND_RADII).toEqual([3, 10])
  })
})

describe('가볼만한 곳 (저장된 목록)', () => {
  it('가볼만한 곳 바로 옆(맨 끝)에 가본 곳, 둘 다 API 소스가 없으며 내 주변·하위 선택 대상이 아님', () => {
    expect(CATEGORIES.slice(-2)).toEqual([{ key: 'saved', label: '담아둔 곳' }, { key: 'visited', label: '오른 오름' }])
    expect(sourcesFor('visited')).toEqual([])
    expect(subsOf('visited')).toBeNull()
    expect(NEAR_CATS).not.toContain('visited')
    expect(sourcesFor('saved')).toEqual([])
    expect(sourcesFor('saved', 'heritage')).toEqual([])
    expect(subsOf('saved')).toBeNull()
    expect(NEAR_CATS).not.toContain('saved')
  })
})
