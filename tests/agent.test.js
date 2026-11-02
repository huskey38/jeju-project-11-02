import { describe, expect, it, vi } from 'vitest'

const create = vi.fn()
vi.mock('@anthropic-ai/sdk', () => ({ default: class { messages = { create } } }))
vi.mock('../server/tour.js', () => ({ searchTour: vi.fn(async () => [{ title: '해녀박물관' }, { title: '두번째' }]) }))
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
