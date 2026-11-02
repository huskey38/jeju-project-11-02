import { describe, expect, it } from 'vitest'
import { isJejuCoord } from '../src/lib/geo.js'

describe('geo', () => {
  it('유효 좌표 판별', () => {
    expect(isJejuCoord('33.45', '126.5')).toBe(true)
    expect(isJejuCoord(0, 0)).toBe(false)
    expect(isJejuCoord('', '')).toBe(false)
    expect(isJejuCoord(37.5, 127)).toBe(false)
  })
})
