import { describe, expect, it } from 'vitest'
import { heightAt, isJejuCoord, toXZ } from '../src/lib/geo.js'

describe('geo', () => {
  it('제주 중심은 원점', () => {
    const [x, z] = toXZ(33.38, 126.55)
    expect(x).toBeCloseTo(0); expect(z).toBeCloseTo(0)
  })
  it('동쪽은 +x, 남쪽은 +z', () => {
    expect(toXZ(33.38, 126.9)[0]).toBeGreaterThan(0)
    expect(toXZ(33.25, 126.55)[1]).toBeGreaterThan(0)
  })
  it('유효 좌표 판별', () => {
    expect(isJejuCoord('33.45', '126.5')).toBe(true)
    expect(isJejuCoord(0, 0)).toBe(false)
    expect(isJejuCoord('', '')).toBe(false)
    expect(isJejuCoord(37.5, 127)).toBe(false)
  })
  it('한라산이 가장 높다', () => {
    expect(heightAt(0, 0)).toBeGreaterThan(heightAt(3, 0))
    expect(heightAt(20, 20)).toBeCloseTo(0)
  })
})
