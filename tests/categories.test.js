import { describe, expect, it } from 'vitest'
import { CATEGORIES, NEAR_CATS, RADII, RECOMMEND_GROUPS, RECOMMEND_RADII, advance, badgeOf, festivalStatus, fmtDist, recommendModeOf, sourcesFor, subsOf, subtitleOf, FOOD_TYPES, MENU_WORDS, todayKst, parseSub } from '../src/lib/placeCategories.js'

describe('분류 버튼', () => {
  it('6개 분류 + 가볼만한 곳(내 주변 분류는 없음)', () => {
    expect(CATEGORIES.map((c) => c.label)).toEqual(['전체', '음식점', '카페', '관광지', '문화시설', '축제·행사', '가볼만한 곳'])
  })
  it('하위 선택은 관광지만, 내 주변 반경은 1·3·5km (가볼만한 곳은 내 주변 없음)', () => {
    expect(subsOf('spot')).toBeNull()
    expect(subsOf('cafe')).toBeNull()
    expect(NEAR_CATS).toEqual(['all', 'spot', 'culture', 'festival', 'food', 'cafe'])
    expect(RADII).toEqual([1, 3, 5])
  })
})

describe('sourcesFor — 분류별 데이터 소스', () => {
  it('전체 = 숙박(32)을 뺀 TourAPI 유형들 → 국가유산', () => {
    const s = sourcesFor('all')
    expect(s.filter((x) => x.api === 'tour').map((x) => x.type)).toEqual(['12', '14', '15', '28', '38', '39'])
    expect(s.slice(-2)).toEqual([{ api: 'heritage' }, { api: 'venue' }])   // 국가유산 → 공연장(파일 데이터) 순
    expect(sourcesFor('아무거나')).toEqual(s)
  })
  it('숙박(유형 32)은 어떤 분류에도 없음', () => {
    const cats = CATEGORIES.map((c) => c.key)
    for (const c of cats) for (const sub of ['all', 'raw']) for (const near of [false, true]) {
      expect(sourcesFor(c, sub, near).some((x) => x.type === '32')).toBe(false)
    }
  })
  it('관광지: 전체(일반→국가유산) / 일반 / 국가유산', () => {
    expect(sourcesFor('spot', 'all')).toEqual([{ api: 'tour', type: '12' }, { api: 'heritage' }])
    expect(sourcesFor('spot', 'no-oreum')).toEqual([{ api: 'tour', type: '12' }, { api: 'heritage' }])   // 예전 주소(sub=no-oreum 등)는 무시되고 전체
    expect(sourcesFor('spot', 'general')).toEqual([{ api: 'tour', type: '12' }, { api: 'heritage' }])   // 예전 주소(sub=general)도 국가유산 포함
  })
  it('문화시설·카페, 축제는 기간 검색 소스', () => {
    expect(sourcesFor('culture')).toEqual([{ api: 'tour', type: '14' }, { api: 'venue' }])   // 문화시설 → 공연장
    expect(sourcesFor('festival')).toEqual([{ api: 'festival' }])
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
    expect(sourcesFor('food', 'chicken')).toEqual([{ api: 'rest', biz: '통닭(치킨)' }])
    expect(sourcesFor('food', 'bakery')).toEqual([{ api: 'tour', type: '39', lcls: 'FD030100' }])   // 분류코드만 있는 칩
    expect(sourcesFor('food', 'all')).toHaveLength(4)
    expect(sourcesFor('food', 'snack', true)).toEqual([{ api: 'near', type: '39', lcls: 'FD030400' }])   // 위치 검색은 관광공사 데이터만
    expect(sourcesFor('food', 'raw', true)).toEqual([{ api: 'near', type: '39', xlcls: 'FD05' }])        // 업태만 있는 칩은 위치 검색에 반영 안 됨
    expect(sourcesFor('food', 'all', true)).toEqual([{ api: 'near', type: '39', xlcls: 'FD05' }])
    expect(sourcesFor('cafe', 'chinese')).toEqual([{ api: 'tour', type: '39', lcls: 'FD05' }])   // 음식점 종류는 카페에 영향 없음
    for (const t of FOOD_TYPES.filter((x) => x.lcls)) expect(t.lcls).not.toMatch(/^FD05/)          // 카페 코드는 섞이지 않음
  })
  it('인기 메뉴 바로가기는 음식점·카페만', () => {
    expect(Object.keys(MENU_WORDS)).toEqual(['food', 'cafe'])
    for (const list of Object.values(MENU_WORDS)) expect(list.length).toBeGreaterThan(3)
  })
  it('내 주변을 켜면 분류별 유형 조건으로 위치 검색 (음식점은 카페 제외, 카페는 FD05만, 가볼만한 곳은 해당 없음)', () => {
    expect(sourcesFor('all', 'all', true)).toEqual([{ api: 'near' }])
    expect(sourcesFor('spot', 'all', true)).toEqual([{ api: 'near', type: '12' }])
    expect(sourcesFor('culture', 'all', true)).toEqual([{ api: 'near', type: '14' }])
    expect(sourcesFor('festival', 'all', true)).toEqual([{ api: 'near', type: '15' }])
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

describe('festivalStatus — 축제 진행률·상태 칩', () => {
  const T = '2026-11-02'
  it('기간이 없거나 날짜가 이상하면 null', () => {
    expect(festivalStatus('', '', T)).toBeNull()
    expect(festivalStatus(undefined, undefined, T)).toBeNull()
    expect(festivalStatus('abc', 'def', T)).toBeNull()
  })
  it('시작 전: 0%, D-n 시작, 7일 이내면 감귤(citrus), 아니면 금색(gold)', () => {
    expect(festivalStatus('2026-11-06', '2026-11-10', T)).toEqual({ state: 'upcoming', pct: 0, label: 'D-4 시작', tone: 'citrus' })
    expect(festivalStatus('2026-11-09', '2026-11-10', T)).toMatchObject({ label: 'D-7 시작', tone: 'citrus' })
    expect(festivalStatus('2026-11-19', '2026-11-22', T)).toMatchObject({ label: 'D-17 시작', tone: 'gold' })
  })
  it('진행 중: 기간 중 오늘의 위치(%)와 남은 날, 곧 끝나면 감귤색', () => {
    // 8/25~11/15 = 83일, 오늘(11/2)은 70일째 → 84%, 13일 남음
    expect(festivalStatus('2026-08-25', '2026-11-15', T)).toEqual({ state: 'ongoing', pct: 84, label: '진행 중 · D-13 종료', tone: 'good' })
    expect(festivalStatus('2026-11-01', '2026-11-04', T)).toMatchObject({ pct: 50, label: '진행 중 · D-2 종료', tone: 'citrus' })
    expect(festivalStatus('2026-11-02', '2026-11-05', T)).toMatchObject({ pct: 25 })   // 시작 당일 = 첫날
  })
  it('마지막 날·하루짜리 행사는 "오늘 종료" 100%', () => {
    expect(festivalStatus('2026-10-30', '2026-11-02', T)).toMatchObject({ pct: 100, label: '오늘 종료', tone: 'citrus' })
    expect(festivalStatus('2026-11-02', '2026-11-02', T)).toMatchObject({ pct: 100, label: '오늘 종료' })
    expect(festivalStatus('2026-11-02', undefined, T)).toMatchObject({ state: 'ongoing', pct: 100 })   // 종료일 없으면 하루 행사
  })
  it('종료: 100%, 회색(muted)', () => {
    expect(festivalStatus('2026-04-04', '2026-04-05', T)).toEqual({ state: 'ended', pct: 100, label: '종료', tone: 'muted' })
  })
  it('today 를 안 주면 한국 시간 오늘 (YYYY-MM-DD)', () => {
    expect(todayKst()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    const t = todayKst()
    expect(festivalStatus(t, t)).toMatchObject({ state: 'ongoing', label: '오늘 종료' })
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
  it('분류 버튼 맨 끝에 있고, API 소스가 없으며 내 주변·하위 선택 대상이 아님', () => {
    expect(CATEGORIES.at(-1)).toEqual({ key: 'saved', label: '가볼만한 곳' })
    expect(sourcesFor('saved')).toEqual([])
    expect(sourcesFor('saved', 'heritage')).toEqual([])
    expect(subsOf('saved')).toBeNull()
    expect(NEAR_CATS).not.toContain('saved')
  })
})
