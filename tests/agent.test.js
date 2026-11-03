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
vi.mock('../server/oreum.js', () => ({ searchOreum: vi.fn(() => [{ id: '7', title: '새별오름', name: '새별오름', city: '제주시', addr: '애월', elev: 519.3, form: '말굽형', lat: 33.36, lng: 126.36, dist: 900, tourId: '555', image: 'x.jpg', area: 1 }]) }))
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
  it('잘못된 입력은 Claude 를 부르지 않고 400 (원문 오류 없음)', async () => {
    const { default: h } = await import('../api/agent.js')
    create.mockClear()
    for (const body of [{}, { message: 12345 }, { message: '안녕', history: 'x' }, { message: 'a'.repeat(501) }]) {
      const res = mkRes(); await h({ method: 'POST', body }, res)
      expect(res.code).toBe(400)
      expect(res.body.error).not.toMatch(/messages\.|Field required/)
    }
    expect(create).not.toHaveBeenCalled()
  })
  it('그 밖의 Claude 오류는 원문 대신 일반 문구 (500)', async () => {
    create.mockRejectedValueOnce(Object.assign(new Error('messages.0.content: Field required request_id=req_123'), { status: 400 }))
    const { default: h } = await import('../api/agent.js')
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = mkRes(); await h({ method: 'POST', body: { message: '안녕' } }, res)
    expect(res.code).toBe(500)
    expect(res.body.error).toBe('잠시 후 다시 시도해 주세요')
    expect(spy).toHaveBeenCalled(); spy.mockRestore()
  })
  it('같은 주소가 1분에 10번을 넘으면 429 + Retry-After', async () => {
    const { default: h } = await import('../api/agent.js')
    create.mockResolvedValue({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'ok' }] })
    const req = { method: 'POST', headers: { 'x-forwarded-for': '9.9.9.9' }, body: { message: '안녕' } }
    const codes = []
    let header
    for (let i = 0; i < 11; i++) { const res = mkRes(); res.setHeader = (k, v) => { header = [k, v] }; await h(req, res); codes.push(res.code) }
    expect(codes.slice(0, 10).every((c) => c === 200)).toBe(true)
    expect(codes[10]).toBe(429)
    expect(header[0]).toBe('Retry-After')
    create.mockReset()
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

describe('api/agent — 오름 중심 (오름 도구·지침·루프 상한 5회)', () => {
  const toolUse = (id, name, input) => ({ stop_reason: 'tool_use', content: [{ type: 'tool_use', id, name, input }] })
  const done = { stop_reason: 'end_turn', content: [{ type: 'text', text: '답' }] }
  const run = async () => {
    const { default: h } = await import('../api/agent.js')
    const res = mkRes(); await h({ method: 'POST', body: { message: '억새 오름' } }, res)
    return res
  }
  it('지침은 오름 가이드, search_oreum 도구에 태그 목록이 있음', async () => {
    create.mockClear(); create.mockResolvedValueOnce(done)
    await run()
    const call = create.mock.calls[0][0]
    expect(call.system).toContain('오름 가이드')
    expect(call.system).toContain('search_oreum')
    const tool = call.tools.find((t) => t.name === 'search_oreum')
    expect(tool.input_schema.properties.tag.enum).toEqual(['sunrise', 'grass', 'view', 'crater', 'easy', 'family', 'forest'])
    expect(tool.input_schema.properties.form.enum).toEqual(['cone', 'round', 'horseshoe', 'mixed'])
    expect(tool.description).toContain('368')
  })
  it('search_oreum: 이름·형태·정렬·태그·좌표·반경을 공식 현황 조회로 넘기고 필요한 필드만(tour_id 포함) 전달, 잘못된 태그는 무시', async () => {
    const oreum = await import('../server/oreum.js')
    create.mockClear()
    create.mockResolvedValueOnce(toolUse('a', 'search_oreum', { tag: 'grass', form: 'horseshoe', sort: 'elev', lat: 33.5, lng: 126.5, radius_m: 999999 })).mockResolvedValueOnce(done)
    const res = await run()
    expect(oreum.searchOreum).toHaveBeenLastCalledWith({ keyword: '', form: 'horseshoe', sort: 'elev', tags: ['grass'], rows: 10, lat: 33.5, lng: 126.5, radius: 30000 })
    expect(JSON.parse(create.mock.calls[1][0].messages.at(-1).content[0].content)[0]).toEqual({ id: '7', title: '새별오름', city: '제주시', addr: '애월', elev: 519.3, form: '말굽형', lat: 33.36, lng: 126.36, dist: 900, tour_id: '555' })
    expect(res.body.steps[0]).toMatchObject({ tool: 'search_oreum', count: 1 })
    create.mockResolvedValueOnce(toolUse('b', 'search_oreum', { tag: 'nope', keyword: '새별' })).mockResolvedValueOnce(done)
    await run()
    expect(oreum.searchOreum).toHaveBeenLastCalledWith({ keyword: '새별', form: '', sort: '', tags: [], rows: 10 })
  })
  it('도구를 끝없이 부르면 5번째에서 멈춤 (루프 상한 5회)', async () => {
    create.mockClear()
    create.mockResolvedValue(toolUse('loop', 'get_weather', { place: '제주시' }))
    const res = await run()
    expect(create).toHaveBeenCalledTimes(5)
    expect(res.body.answer).toContain('너무 많아')
    create.mockReset()
  })
})
