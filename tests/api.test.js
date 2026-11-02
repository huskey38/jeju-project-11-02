import { describe, expect, it, vi } from 'vitest'

vi.mock('../server/tour.js', () => ({ searchTour: vi.fn(async (a) => [{ id: '1', title: 'T', args: a }]) }))
vi.mock('../server/weather.js', () => ({ getWeather: vi.fn(async (a) => [{ place: a.place }]) }))
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
    expect(res.body[0].args).toEqual({ keyword: '해녀', contentTypeId: '14', page: 1, rows: 10 })
  })
  it('weather', async () => {
    const { default: h } = await import('../api/weather.js')
    const res = mkRes(); await h({ query: { place: '서귀포시' } }, res)
    expect(res.body).toEqual([{ place: '서귀포시' }])
  })
  it('heritage', async () => {
    const { default: h } = await import('../api/heritage.js')
    const res = mkRes(); await h({ query: { keyword: 'x' } }, res)
    expect(res.body[0].args).toEqual({ keyword: 'x' })
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
    expect(search).toHaveBeenLastCalledWith({ keyword: '오름', contentTypeId: '', page: 2, rows: 50 })
    await h({ query: { page: 'x', rows: '' } }, mkRes())
    expect(search).toHaveBeenLastCalledWith({ keyword: '', contentTypeId: '12', page: 1, rows: 10 })
  })
})
