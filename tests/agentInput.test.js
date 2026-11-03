import { describe, expect, it } from 'vitest'
import { MAX_HISTORY, MAX_MESSAGE, clientIp, createLimiter, parseAgentInput } from '../server/agentInput.js'

describe('parseAgentInput — 질문·대화기록 검사', () => {
  it('질문이 없거나 글이 아니거나 비어 있으면 거절', () => {
    for (const body of [undefined, null, {}, { message: 12345 }, { message: '   ' }, { message: ['a'] }]) {
      expect(parseAgentInput(body).ok).toBe(false)
    }
  })
  it('질문은 앞뒤 공백을 지우고, 500자를 넘으면 거절', () => {
    expect(parseAgentInput({ message: '  안녕  ' })).toMatchObject({ ok: true, message: '안녕', history: [] })
    expect(parseAgentInput({ message: 'a'.repeat(MAX_MESSAGE) }).ok).toBe(true)
    expect(parseAgentInput({ message: 'a'.repeat(MAX_MESSAGE + 1) }).ok).toBe(false)
  })
  it('대화 기록은 배열이어야 하고, 항목은 {role, content} 형식이어야 함', () => {
    expect(parseAgentInput({ message: 'a', history: 'x' }).ok).toBe(false)
    expect(parseAgentInput({ message: 'a', history: [{ role: 'system', content: 'x' }] }).ok).toBe(false)
    expect(parseAgentInput({ message: 'a', history: [{ role: 'user', content: 5 }] }).ok).toBe(false)
    expect(parseAgentInput({ message: 'a', history: [null] }).ok).toBe(false)
    expect(parseAgentInput({ message: 'a', history: null })).toMatchObject({ ok: true, history: [] })
  })
  it('대화 기록은 최근 10개만, 너무 긴 글은 잘라서, 빈 내용은 빼고, 사용자 말로 시작하게 정리', () => {
    const many = Array.from({ length: 14 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `m${i}` }))
    const r = parseAgentInput({ message: 'a', history: many })
    expect(r.history.length).toBeLessThanOrEqual(MAX_HISTORY)
    expect(r.history[0].role).toBe('user')
    expect(r.history.at(-1).content).toBe('m13')
    const long = parseAgentInput({ message: 'a', history: [{ role: 'user', content: 'x'.repeat(5000) }] })
    expect(long.history[0].content).toHaveLength(2000)
    expect(parseAgentInput({ message: 'a', history: [{ role: 'user', content: '  ' }] }).history).toEqual([])
  })
})

describe('clientIp', () => {
  it('x-forwarded-for 의 첫 주소, 없으면 소켓 주소, 둘 다 없으면 null', () => {
    expect(clientIp({ headers: { 'x-forwarded-for': '1.2.3.4, 10.0.0.1' } })).toBe('1.2.3.4')
    expect(clientIp({ headers: {}, socket: { remoteAddress: '::1' } })).toBe('::1')
    expect(clientIp({})).toBeNull()
  })
})

describe('createLimiter — 같은 주소의 호출 제한', () => {
  it('창 안에서 max 번까지만 허용하고, 시간이 지나면 다시 허용, 주소마다 따로 셈', () => {
    let t = 0
    const check = createLimiter({ max: 2, windowMs: 1000, now: () => t })
    expect(check('a').ok).toBe(true)
    expect(check('a').ok).toBe(true)
    const third = check('a')
    expect(third.ok).toBe(false)
    expect(third.retryAfterSec).toBeGreaterThanOrEqual(1)
    expect(check('b').ok).toBe(true)
    t = 1001
    expect(check('a').ok).toBe(true)
  })
})
