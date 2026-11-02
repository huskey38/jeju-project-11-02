import { describe, expect, it, vi } from 'vitest'

vi.mock('../server/tour.js', () => ({ searchTour: vi.fn(async (a) => [{ id: '1', title: 'T', args: a }]) }))
vi.mock('../server/tags.js', () => ({ searchTagged: vi.fn((a) => [a]), filterByTags: vi.fn((l) => l.slice(0, 1)) }))
vi.mock('../server/restaurants.js', () => ({ searchRestaurants: vi.fn(async (a) => [a]), getRestaurant: vi.fn(async (a) => ({ got: a.id })) }))
vi.mock('../server/weather.js', () => ({ getWeather: vi.fn(async (a) => [{ place: a.place }]), getForecast: vi.fn(async (a) => a.dates.map((date) => ({ date, kind: 'short' }))) }))
vi.mock('../server/heritage.js', () => ({ searchHeritage: vi.fn(async (a) => [{ name: 'H', args: a }]) }))

const mkRes = () => {
  const res = { code: 0, body: null }
  res.status = (c) => { res.code = c; return res }
  res.json = (b) => { res.body = b; return res }
  return res
}

describe('api handlers', () => {
  it('hello: 키 값은 숨기고 있는지만 알려줌', async () => {
    process.env.DATA_GO_KR_KEY = 'secret'
    delete process.env.ANTHROPIC_API_KEY
    const { default: h } = await import('../api/hello.js')
    const res = mkRes(); h({}, res)
    expect(res.body).toMatchObject({ ok: true, hasDataKey: true, hasClaudeKey: false })
    expect(JSON.stringify(res.body)).not.toContain('secret')
  })
  it('tour: 쿼리를 함수 인자로 전달', async () => {
    const { default: h } = await import('../api/tour.js')
    const res = mkRes(); await h({ query: { keyword: '해녀', type: '14' } }, res)
    expect(res.code).toBe(200)
    expect(res.body[0].args).toEqual({ keyword: '해녀', contentTypeId: '14', lclsSystm2: '', page: 1, rows: 10 })
  })
  it('weather', async () => {
    const { default: h } = await import('../api/weather.js')
    const res = mkRes(); await h({ query: { place: '서귀포시' } }, res)
    expect(res.body).toEqual([{ place: '서귀포시' }])
  })
  it('weather: 좌표·날짜별 예보 (좌표가 제주 밖이거나 날짜 형식이 틀리면 400, 날짜는 3개까지)', async () => {
    const { default: h } = await import('../api/weather.js')
    const ok = mkRes(); await h({ query: { lat: '33.5', lng: '126.5', dates: '2026-11-02,2026-11-06,bad,2026-11-07,2026-11-08' } }, ok)
    expect(ok.code).toBe(200)
    expect(ok.body.map((x) => x.date)).toEqual(['2026-11-02', '2026-11-06', '2026-11-07'])
    const far = mkRes(); await h({ query: { lat: '37.5', lng: '127', dates: '2026-11-02' } }, far)
    expect(far.code).toBe(400)
    const bad = mkRes(); await h({ query: { lat: '33.5', lng: '126.5', dates: 'x' } }, bad)
    expect(bad.code).toBe(400)
  })
  it('restaurant: 목록(검색어·업태·쪽, rows 는 100 까지) / 상세(id)', async () => {
    const { default: h } = await import('../api/restaurant.js')
    const list = mkRes(); await h({ query: { keyword: '흑돼지', biz: '횟집', page: '2', rows: '500' } }, list)
    expect(list.body[0]).toEqual({ keyword: '흑돼지', biz: '횟집', page: 2, rows: 100 })
    const one = mkRes(); await h({ query: { id: '6510000-1' } }, one)
    expect(one.body).toEqual({ got: '6510000-1' })
  })
  it('heritage', async () => {
    const { default: h } = await import('../api/heritage.js')
    const res = mkRes(); await h({ query: { keyword: 'x' } }, res)
    expect(res.body[0].args).toEqual({ keyword: 'x', page: 1, rows: 10 })
  })
  it('내부 함수가 던지면 500 + error', async () => {
    const tour = await import('../server/tour.js')
    tour.searchTour.mockRejectedValueOnce(new Error('boom'))
    const { default: h } = await import('../api/tour.js')
    const res = mkRes(); await h({ query: {} }, res)
    expect(res.code).toBe(500); expect(res.body.error).toBe('boom')
  })
})

describe('api/tour — page·rows', () => {
  it('page·rows 전달(rows 상한 50), 잘못된 값은 기본값', async () => {
    vi.resetModules()
    const search = vi.fn(async () => [])
    vi.doMock('../server/tour.js', () => ({ searchTour: search }))
    const { default: h } = await import('../api/tour.js')
    await h({ query: { keyword: '오름', type: '', page: '2', rows: '999' } }, mkRes())
    expect(search).toHaveBeenLastCalledWith({ keyword: '오름', contentTypeId: '', lclsSystm2: '', page: 2, rows: 50 })
    await h({ query: { page: 'x', rows: '' } }, mkRes())
    expect(search).toHaveBeenLastCalledWith({ keyword: '', contentTypeId: '12', lclsSystm2: '', page: 1, rows: 10 })
  })
})

describe('api 상세 분기', () => {
  it('tour: id 가 있으면 상세, heritage: asno 가 있으면 상세', async () => {
    vi.resetModules()
    vi.doMock('../server/tour.js', () => ({ searchTour: vi.fn(async () => ['list']), getTourDetail: vi.fn(async (a) => ({ detail: a })) }))
    vi.doMock('../server/heritage.js', () => ({ searchHeritage: vi.fn(async () => ['list']), getHeritageDetail: vi.fn(async (a) => ({ detail: a })) }))
    const tour = (await import('../api/tour.js')).default
    const heritage = (await import('../api/heritage.js')).default
    let res = mkRes(); await tour({ query: { id: '7' } }, res)
    expect(res.body).toEqual({ detail: { id: '7' } })
    res = mkRes(); await tour({ query: { keyword: 'x' } }, res)
    expect(res.body).toEqual(['list'])
    res = mkRes(); await heritage({ query: { kdcd: '12', asno: '0003', ctcd: '50' } }, res)
    expect(res.body).toEqual({ detail: { kdcd: '12', asno: '0003', ctcd: '50' } })
    res = mkRes(); await heritage({ query: { keyword: 'x' } }, res)
    expect(res.body).toEqual(['list'])
  })
  it('상세 조회 에러는 500', async () => {
    vi.resetModules()
    vi.doMock('../server/tour.js', () => ({ searchTour: vi.fn(), getTourDetail: vi.fn(async () => { throw new Error('없음') }) }))
    const tour = (await import('../api/tour.js')).default
    const res = mkRes(); await tour({ query: { id: '1' } }, res)
    expect(res.code).toBe(500)
    expect(res.body.error).toBe('없음')
  })
})

describe('api — 분류(lcls)·국가유산 페이지', () => {
  it('tour: lcls 는 분류체계 중분류 형식(FD05)만 전달, 이상한 값은 버림', async () => {
    vi.resetModules()
    const search = vi.fn(async () => [])
    vi.doMock('../server/tour.js', () => ({ searchTour: search, getTourDetail: vi.fn() }))
    const { default: h } = await import('../api/tour.js')
    await h({ query: { type: '39', lcls: 'FD05' } }, mkRes())
    expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ contentTypeId: '39', lclsSystm2: 'FD05' }))
    await h({ query: { type: '39', lcls: 'FD05&x=1' } }, mkRes())
    expect(search).toHaveBeenLastCalledWith(expect.objectContaining({ lclsSystm2: '' }))
  })
  it('heritage: page·rows 전달(상한 50)', async () => {
    vi.resetModules()
    const search = vi.fn(async () => [])
    vi.doMock('../server/heritage.js', () => ({ searchHeritage: search, getHeritageDetail: vi.fn() }))
    const { default: h } = await import('../api/heritage.js')
    await h({ query: { keyword: '관덕정', page: '3', rows: '999' } }, mkRes())
    expect(search).toHaveBeenLastCalledWith({ keyword: '관덕정', page: 3, rows: 50 })
  })
})

describe('api/tour — 주변·축제 모드', () => {
  it('mode=near: 좌표·반경·유형·제외 분류 전달, 유형을 비우면 전체, 이상한 분류는 버림', async () => {
    vi.resetModules()
    const near = vi.fn(async () => [])
    vi.doMock('../server/tour.js', () => ({ searchNearby: near, searchFestivals: vi.fn(), searchTour: vi.fn(), getTourDetail: vi.fn() }))
    const { default: h } = await import('../api/tour.js')
    await h({ query: { mode: 'near', lat: '33.5', lng: '126.5', radius: '5000', type: '39', xlcls: 'FD05', page: '2', rows: '12' } }, mkRes())
    expect(near).toHaveBeenLastCalledWith({ lat: '33.5', lng: '126.5', radius: 5000, contentTypeId: '39', lclsSystm2: '', lclsExclude: 'FD05', page: 2, rows: 12 })
    await h({ query: { mode: 'near', lat: '33.5', lng: '126.5', type: '39', lcls: 'FD020100' } }, mkRes())
    expect(near).toHaveBeenLastCalledWith(expect.objectContaining({ lclsSystm2: 'FD020100' }))   // 소분류 코드도 통과
    await h({ query: { mode: 'near', lat: '33.5', lng: '126.5', lcls: 'bad&x' } }, mkRes())
    expect(near).toHaveBeenLastCalledWith(expect.objectContaining({ contentTypeId: '', lclsSystm2: '', radius: 3000 }))
  })
  it('mode=festival: 기간·검색어·쪽 전달', async () => {
    vi.resetModules()
    const fest = vi.fn(async () => [])
    vi.doMock('../server/tour.js', () => ({ searchNearby: vi.fn(), searchFestivals: fest, searchTour: vi.fn(), getTourDetail: vi.fn() }))
    const { default: h } = await import('../api/tour.js')
    await h({ query: { mode: 'festival', from: '2026-11-01', to: '2026-11-30', keyword: '축제', page: '1', rows: '12' } }, mkRes())
    expect(fest).toHaveBeenLastCalledWith({ from: '2026-11-01', to: '2026-11-30', keyword: '축제', page: 1, rows: 12 })
  })
  it('mode=tagged: 탭·태그·분류·검색어·쪽 전달, 잘못된 탭은 400, 태그는 소문자만', async () => {
    vi.resetModules()
    vi.doMock('../server/tour.js', () => ({ searchNearby: vi.fn(), searchFestivals: vi.fn(), searchTour: vi.fn(), getTourDetail: vi.fn() }))
    const tagsMod = { searchTagged: vi.fn(() => []), filterByTags: vi.fn((l) => l) }
    vi.doMock('../server/tags.js', () => tagsMod)
    const { default: h } = await import('../api/tour.js')
    const ok = mkRes(); await h({ query: { mode: 'tagged', tab: 'food', tags: 'seafood,BAD,noodle', lcls: 'FD020200', keyword: '회', page: '2', rows: '12' } }, ok)
    expect(ok.code).toBe(200)
    expect(tagsMod.searchTagged).toHaveBeenLastCalledWith({ tab: 'food', tags: ['seafood', 'noodle'], lcls: 'FD020200', keyword: '회', page: 2, rows: 12 })
    const bad = mkRes(); await h({ query: { mode: 'tagged', tab: 'hack' } }, bad)
    expect(bad.code).toBe(400)
  })
  it('mode=festival + tags: 기간 안 행사를 한 번에 받아 태그로 거른 뒤 쪽으로 자름', async () => {
    vi.resetModules()
    const fest = vi.fn(async () => Array.from({ length: 30 }, (_, i) => ({ id: String(i) })))
    vi.doMock('../server/tour.js', () => ({ searchNearby: vi.fn(), searchFestivals: fest, searchTour: vi.fn(), getTourDetail: vi.fn() }))
    vi.doMock('../server/tags.js', () => ({ searchTagged: vi.fn(), filterByTags: vi.fn((l) => l) }))
    const { default: h } = await import('../api/tour.js')
    const res = mkRes(); await h({ query: { mode: 'festival', tags: 'music', page: '2', rows: '12' } }, res)
    expect(fest).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, rows: 100 }))
    expect(res.body.map((x) => x.id)).toEqual(Array.from({ length: 12 }, (_, i) => String(12 + i)))
  })
  it('주변 검색 에러(제주 밖 좌표 등)는 500 + 메시지', async () => {
    vi.resetModules()
    vi.doMock('../server/tour.js', () => ({ searchNearby: vi.fn(async () => { throw new Error('제주 안의 위도·경도가 필요해요') }), searchFestivals: vi.fn(), searchTour: vi.fn(), getTourDetail: vi.fn() }))
    const { default: h } = await import('../api/tour.js')
    const res = mkRes(); await h({ query: { mode: 'near', lat: '37', lng: '127' } }, res)
    expect(res.code).toBe(500)
    expect(res.body.error).toContain('제주')
  })
})
