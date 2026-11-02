import { describe, expect, it, vi } from 'vitest'

const create = vi.fn()
vi.mock('@anthropic-ai/sdk', () => ({ default: class { messages = { create } } }))
vi.mock('../server/tour.js', () => ({
  searchTour: vi.fn(async () => [{ title: '해녀박물관' }, { title: '두번째' }]),
  getTourDetail: vi.fn(async ({ id }) => ({ id, title: '화조원', type: '12', addr: '애월', overview: '체험형 조류 동물원이다. ' + 'a'.repeat(600), info: [1, 2, 3, 4, 5].map((n) => ({ label: `l${n}`, value: 'v' })) })),
  searchNearby: vi.fn(async () => [{ id: '1', title: '라토커피제주', type: '39', lcls: 'FD05', addr: 'a', dist: 286, lat: '33.5', lng: '126.5', image: 'x.jpg' }]),
  searchFestivals: vi.fn(async () => [{ id: '2', title: '벚꽃축제', start: '2026-04-04', end: '2026-04-05', image: 'x.jpg' }]),
}))
vi.mock('../server/restaurants.js', () => ({ BIZ_TYPES: ['한식', '횟집'], searchRestaurants: vi.fn(async () => [{ id: 'r1', title: '성산막회', biz: '횟집', addr: 'a', tel: '064', lat: '33.4', lng: '126.9', dup: true, extra: 'x' }]) }))
vi.mock('../server/weather.js', () => ({ getWeather: vi.fn(async () => []) }))
vi.mock('../server/heritage.js', () => ({ searchHeritage: vi.fn(async () => []) }))

const mkRes = () => {
  const res = {}
  res.status = (c) => { res.code = c; return res }
  res.json = (b) => { res.body = b; return res }
  return res
}

describe('api/agent (Claude 모킹)', () => {
  it('POST 가 아니면 405', async () => {
    const { default: h } = await import('../api/agent.js')
    const res = mkRes(); await h({ method: 'GET' }, res)
    expect(res.code).toBe(405)
  })
  it('도구 호출 → 결과 전달 → 최종 답 (steps 기록)', async () => {
    create
      .mockResolvedValueOnce({ stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'search_tour_places', input: { keyword: '해녀' } }] })
      .mockResolvedValueOnce({ stop_reason: 'end_turn', content: [{ type: 'text', text: '해녀박물관을 추천해요' }] })
    const { default: h } = await import('../api/agent.js')
    const res = mkRes(); await h({ method: 'POST', body: { message: '해녀', history: [] } }, res)
    expect(res.code).toBe(200)
    expect(res.body.answer).toContain('해녀박물관')
    expect(res.body.steps).toEqual([{ tool: 'search_tour_places', args: { keyword: '해녀' }, count: 2 }])
    const second = create.mock.calls[1][0].messages.at(-1)
    expect(second.content[0]).toMatchObject({ type: 'tool_result', tool_use_id: 't1' })
  })
  it('429 는 친절한 메시지', async () => {
    create.mockRejectedValueOnce(Object.assign(new Error('x'), { status: 429 }))
    const { default: h } = await import('../api/agent.js')
    const res = mkRes(); await h({ method: 'POST', body: { message: 'a' } }, res)
    expect(res.code).toBe(429)
    expect(res.body.error).toContain('사용량')
  })
})

describe('api/agent — 위치 기반·축제 기간 도구', () => {
  const toolUse = (id, name, input) => ({ stop_reason: 'tool_use', content: [{ type: 'tool_use', id, name, input }] })
  const done = { stop_reason: 'end_turn', content: [{ type: 'text', text: '답' }] }
  const run = async (message = 'q') => {
    const { default: h } = await import('../api/agent.js')
    const res = mkRes(); await h({ method: 'POST', body: { message } }, res)
    return res
  }

  it('도구 목록에 search_nearby·search_festivals 가 있고 숙박 도구는 없음', async () => {
    create.mockClear()
    create.mockResolvedValueOnce(done)
    await run()
    const names = create.mock.calls[0][0].tools.map((t) => t.name)
    expect(names).toEqual(expect.arrayContaining(['search_tour_places', 'get_weather', 'search_heritage', 'search_nearby', 'search_festivals']))
    expect(names.some((n) => /stay|lodg|hotel/i.test(n))).toBe(false)
  })
  it('시스템 프롬프트에 오늘 날짜(한국 시간)와 숙박 제외 규칙', async () => {
    create.mockClear()
    create.mockResolvedValueOnce(done)
    await run()
    const sys = create.mock.calls[0][0].system
    expect(sys).toContain(new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10))
    expect(sys).toContain('숙박')
    expect(sys).toContain('search_nearby')
  })
  it('search_nearby: category 를 검색 조건으로 바꿔 호출하고 결과는 필요한 필드만 전달', async () => {
    const tour = await import('../server/tour.js')
    create.mockReset()
    create
      .mockResolvedValueOnce(toolUse('n1', 'search_nearby', { lat: 33.4996, lng: 126.5312, radius_m: 2000, category: 'cafe' }))
      .mockResolvedValueOnce(done)
    const res = await run('시청 근처 카페')
    expect(tour.searchNearby).toHaveBeenLastCalledWith(expect.objectContaining({ lat: 33.4996, lng: 126.5312, radius: 2000, contentTypeId: '39', lclsSystm2: 'FD05' }))
    expect(res.body.steps).toEqual([{ tool: 'search_nearby', args: { lat: 33.4996, lng: 126.5312, radius_m: 2000, category: 'cafe' }, count: 1 }])
    const sent = JSON.parse(create.mock.calls[1][0].messages.at(-1).content[0].content)
    expect(sent[0]).toEqual({ id: '1', title: '라토커피제주', type: '39', lcls: 'FD05', addr: 'a', dist: 286, lat: '33.5', lng: '126.5' })
    expect(sent[0].image).toBeUndefined()
  })
  it('search_nearby 음식점은 카페 제외 조건으로', async () => {
    const tour = await import('../server/tour.js')
    create.mockReset()
    create.mockResolvedValueOnce(toolUse('n2', 'search_nearby', { lat: 33.5, lng: 126.5, category: 'food' })).mockResolvedValueOnce(done)
    await run()
    expect(tour.searchNearby).toHaveBeenLastCalledWith(expect.objectContaining({ contentTypeId: '39', lclsExclude: 'FD05' }))
  })
  it('search_festivals: 기간 인자 전달', async () => {
    const tour = await import('../server/tour.js')
    create.mockReset()
    create.mockResolvedValueOnce(toolUse('f1', 'search_festivals', { from: '2026-11-01', to: '2026-11-30' })).mockResolvedValueOnce(done)
    const res = await run('11월 축제')
    expect(tour.searchFestivals).toHaveBeenLastCalledWith(expect.objectContaining({ from: '2026-11-01', to: '2026-11-30' }))
    expect(res.body.steps[0]).toMatchObject({ tool: 'search_festivals', count: 1 })
  })
  it('도구가 에러를 던지면 에러를 결과로 돌려주고 루프는 계속', async () => {
    const tour = await import('../server/tour.js')
    tour.searchNearby.mockRejectedValueOnce(new Error('제주 안의 위도·경도(lat, lng)가 필요해요'))
    create.mockReset()
    create.mockResolvedValueOnce(toolUse('e1', 'search_nearby', { lat: 37, lng: 127 })).mockResolvedValueOnce(done)
    const res = await run()
    expect(res.code).toBe(200)
    expect(JSON.parse(create.mock.calls[1][0].messages.at(-1).content[0].content)).toEqual({ error: '제주 안의 위도·경도(lat, lng)가 필요해요' })
    expect(res.body.steps[0].count).toBe(0)
  })
})

describe('api/agent — 분류 검색·상세 확인 (동물원 → 화조원)', () => {
  const toolUse = (id, name, input) => ({ stop_reason: 'tool_use', content: [{ type: 'tool_use', id, name, input }] })
  const done = { stop_reason: 'end_turn', content: [{ type: 'text', text: '답' }] }
  const run = async () => {
    const { default: h } = await import('../api/agent.js')
    const res = mkRes(); await h({ method: 'POST', body: { message: '동물원 알려줘' } }, res)
    return res
  }

  it('도구 목록에 get_place_detail 과 lcls 가 있고, 지침에 분류로 재시도하라는 말이 있음', async () => {
    create.mockClear(); create.mockResolvedValueOnce(done)
    await run()
    const call = create.mock.calls[0][0]
    expect(call.tools.map((t) => t.name)).toContain('get_place_detail')
    expect(call.tools.find((t) => t.name === 'search_tour_places').input_schema.properties).toHaveProperty('lcls')
    expect(call.system).toContain('VE02')
  })
  it('lcls 로 검색하면 유형 제한을 풀고 30곳까지, 잘못된 코드·숙박(AC)은 무시', async () => {
    const tour = await import('../server/tour.js')
    create.mockClear()
    create.mockResolvedValueOnce(toolUse('a', 'search_tour_places', { keyword: '', lcls: 'VE02' })).mockResolvedValueOnce(done)
    await run()
    expect(tour.searchTour).toHaveBeenLastCalledWith({ keyword: '', contentTypeId: '', lclsSystm2: 'VE02', rows: 30 })
    create.mockResolvedValueOnce(toolUse('b', 'search_tour_places', { keyword: '해녀', lcls: 'AC01' })).mockResolvedValueOnce(done)
    await run()
    expect(tour.searchTour).toHaveBeenLastCalledWith({ keyword: '해녀', contentTypeId: '12', lclsSystm2: '', rows: 10 })
    create.mockResolvedValueOnce(toolUse('c', 'search_tour_places', { lcls: 'bad&x' })).mockResolvedValueOnce(done)
    await run()
    expect(tour.searchTour).toHaveBeenLastCalledWith(expect.objectContaining({ lclsSystm2: '' }))
  })
  it('get_place_detail: 소개글은 400자까지, 이용정보는 4개까지만 모델에게 전달', async () => {
    create.mockClear()
    create.mockResolvedValueOnce(toolUse('d', 'get_place_detail', { id: '2606209' })).mockResolvedValueOnce(done)
    const res = await run()
    expect(res.body.steps[0]).toMatchObject({ tool: 'get_place_detail', count: 0 })
    const sent = JSON.parse(create.mock.calls[1][0].messages.at(-1).content[0].content)
    expect(sent.title).toBe('화조원')
    expect(sent.overview).toHaveLength(400)
    expect(sent.overview).toContain('조류 동물원')
    expect(sent.info).toHaveLength(4)
  })
  it('도구가 던져도(없는 장소 등) 에이전트는 계속 진행', async () => {
    const tour = await import('../server/tour.js')
    tour.getTourDetail.mockRejectedValueOnce(new Error('장소를 찾을 수 없어요'))
    create.mockClear()
    create.mockResolvedValueOnce(toolUse('e', 'get_place_detail', { id: 'x' })).mockResolvedValueOnce(done)
    const res = await run()
    expect(res.code).toBe(200)
    expect(create.mock.calls[1][0].messages.at(-1).content[0].content).toContain('장소를 찾을 수 없어요')
  })
})

describe('api/agent — 일반음식점 도구', () => {
  const toolUse = (id, name, input) => ({ stop_reason: 'tool_use', content: [{ type: 'tool_use', id, name, input }] })
  const done = { stop_reason: 'end_turn', content: [{ type: 'text', text: '답' }] }
  it('search_restaurants: 업태 목록을 도구에 알리고, 필요한 필드만 전달', async () => {
    const rest = await import('../server/restaurants.js')
    create.mockClear()
    create.mockResolvedValueOnce(toolUse('r', 'search_restaurants', { keyword: '막회', biz: '횟집' })).mockResolvedValueOnce(done)
    const { default: h } = await import('../api/agent.js')
    const res = mkRes(); await h({ method: 'POST', body: { message: '횟집' } }, res)
    const tool = create.mock.calls[0][0].tools.find((t) => t.name === 'search_restaurants')
    expect(tool.input_schema.properties.biz.enum).toEqual(['한식', '횟집'])
    expect(rest.searchRestaurants).toHaveBeenLastCalledWith({ keyword: '막회', biz: '횟집', rows: 15 })
    const sent = JSON.parse(create.mock.calls[1][0].messages.at(-1).content[0].content)
    expect(sent[0]).toEqual({ id: 'r1', title: '성산막회', biz: '횟집', addr: 'a', tel: '064', lat: '33.4', lng: '126.9', dup: true })
    expect(res.body.steps[0]).toMatchObject({ tool: 'search_restaurants', count: 1 })
  })
})
