import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchRetry } from '../server/text.js'

afterEach(() => vi.unstubAllGlobals())

describe('fetchRetry — 일시적 네트워크 오류는 1회만 다시 시도', () => {
  it('첫 시도가 fetch failed 면 한 번 더 해서 성공하면 그 응답', async () => {
    const f = vi.fn().mockRejectedValueOnce(new TypeError('fetch failed')).mockResolvedValueOnce({ ok: true })
    vi.stubGlobal('fetch', f)
    await expect(fetchRetry('http://x')).resolves.toEqual({ ok: true })
    expect(f).toHaveBeenCalledTimes(2)
  })
  it('두 번 다 실패하면 오류를 던짐(2회까지만)', async () => {
    const f = vi.fn().mockRejectedValue(new TypeError('fetch failed'))
    vi.stubGlobal('fetch', f)
    await expect(fetchRetry('http://x')).rejects.toThrow('fetch failed')
    expect(f).toHaveBeenCalledTimes(2)
  })
  it('서버가 준 오류 응답(500)은 다시 시도하지 않음', async () => {
    const f = vi.fn().mockResolvedValue({ ok: false, status: 500 })
    vi.stubGlobal('fetch', f)
    expect((await fetchRetry('http://x')).status).toBe(500)
    expect(f).toHaveBeenCalledTimes(1)
  })
})
