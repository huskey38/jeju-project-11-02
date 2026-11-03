import { describe, expect, it } from 'vitest'
import { RETRY_MESSAGE, friendlyMessage } from '../src/lib/friendlyError.js'

describe('friendlyMessage — 화면에 보이는 오류 문구', () => {
  it('배포(prod)에서는 공공데이터·서버 원문 오류를 감추고 "잠시 후 다시 시도해 주세요"', () => {
    expect(friendlyMessage(500, 'TourAPI 오류: SERVICE_KEY_IS_NOT_REGISTERED_ERROR', { prod: true })).toBe('잠시 후 다시 시도해 주세요')
    expect(friendlyMessage(502, '일반음식점 응답이 JSON이 아님: <html>', { prod: true })).toBe(RETRY_MESSAGE)
    expect(friendlyMessage(0, 'Failed to fetch', { prod: true })).toBe(RETRY_MESSAGE)   // 네트워크 끊김
    expect(friendlyMessage(404, '', { prod: true })).toBe(RETRY_MESSAGE)
  })
  it('429(사용량 한도)는 서버가 준 "1분 뒤 다시"라는 안내를 그대로 보여 줌', () => {
    expect(friendlyMessage(429, '사용량이 많아요. 1분 뒤 다시 시도하세요.', { prod: true })).toBe('사용량이 많아요. 1분 뒤 다시 시도하세요.')
  })
  it('개발 중(dev)에는 원인을 알 수 있게 원문을 그대로', () => {
    expect(friendlyMessage(500, 'TourAPI 오류: SERVICE_KEY_IS_NOT_REGISTERED_ERROR', { prod: false })).toBe('TourAPI 오류: SERVICE_KEY_IS_NOT_REGISTERED_ERROR')
    expect(friendlyMessage(500, '', { prod: false })).toBe(RETRY_MESSAGE)
  })
})
