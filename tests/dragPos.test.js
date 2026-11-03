import { describe, expect, it } from 'vitest'
import { DRAG_THRESHOLD, clampPos, movedEnough, panelPlace, parsePos } from '../src/lib/dragPos.js'

describe('clampPos — 버튼을 화면 안에 가둠', () => {
  it('화면 안이면 그대로, 밖이면 가장자리(여백 8px)로', () => {
    expect(clampPos({ x: 100, y: 200 }, 1000, 800)).toEqual({ x: 100, y: 200 })
    expect(clampPos({ x: -50, y: -10 }, 1000, 800)).toEqual({ x: 8, y: 8 })
    expect(clampPos({ x: 5000, y: 5000 }, 1000, 800)).toEqual({ x: 1000 - 56 - 8, y: 800 - 56 - 8 })
  })
  it('화면이 버튼보다 작아도 깨지지 않음', () => {
    expect(clampPos({ x: 100, y: 100 }, 40, 40)).toEqual({ x: 8, y: 8 })
  })
})

describe('panelPlace — 대화창을 버튼 가까이에', () => {
  it('위쪽에 자리가 있으면 버튼 위에, 오른쪽 끝을 맞춤', () => {
    const p = panelPlace({ x: 900, y: 700 }, 1000, 800)
    expect(p.top + p.height + 12).toBe(700)
    expect(p.left + p.width).toBe(900 + 56)
    expect(p).toMatchObject({ right: 'auto', bottom: 'auto' })
  })
  it('위쪽에 자리가 없으면 버튼 아래에', () => {
    const p = panelPlace({ x: 500, y: 20 }, 1000, 800)
    expect(p.top).toBe(20 + 56 + 12)
  })
  it('왼쪽 가장자리 버튼이어도 대화창이 화면 밖으로 나가지 않음', () => {
    const p = panelPlace({ x: 8, y: 700 }, 1000, 800)
    expect(p.left).toBeGreaterThanOrEqual(16)
    expect(p.left + p.width).toBeLessThanOrEqual(1000 - 16)
  })
})

describe('끌기 판정·저장값', () => {
  it('조금 움직인 것은 클릭, 기준을 넘으면 끌기', () => {
    expect(movedEnough(2, 2)).toBe(false)
    expect(movedEnough(DRAG_THRESHOLD + 1, 0)).toBe(true)
  })
  it('저장된 위치 읽기: 잘못된 값은 null', () => {
    expect(parsePos('{"x":10,"y":20}')).toEqual({ x: 10, y: 20 })
    expect(parsePos('이상한값')).toBeNull()
    expect(parsePos('{"x":"a"}')).toBeNull()
    expect(parsePos(null)).toBeNull()
  })
})
