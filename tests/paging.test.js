import { describe, expect, it } from 'vitest'
import { pageCount, pageList } from '../src/lib/paging.js'

describe('paging — 쪽 번호', () => {
  it('쪽 수: 12개씩, 한 개라도 남으면 한 쪽 더, 비어도 최소 1쪽', () => {
    expect(pageCount(368, 12)).toBe(31)
    expect(pageCount(12, 12)).toBe(1)
    expect(pageCount(13, 12)).toBe(2)
    expect(pageCount(0, 12)).toBe(1)
  })
  it('현재 쪽 둘레 연속 5개 + 맨 처음·맨 끝, 사이는 …', () => {
    expect(pageList(1, 31)).toEqual([1, 2, 3, 4, 5, '…', 31])
    expect(pageList(3, 31)).toEqual([1, 2, 3, 4, 5, '…', 31])
    expect(pageList(8, 31)).toEqual([1, '…', 6, 7, 8, 9, 10, '…', 31])
    expect(pageList(31, 31)).toEqual([1, '…', 27, 28, 29, 30, 31])
  })
  it('사이가 한 쪽만 비면 … 대신 그 번호, 쪽이 적으면 전부 나열', () => {
    expect(pageList(5, 31)).toEqual([1, 2, 3, 4, 5, 6, 7, '…', 31])
    expect(pageList(2, 4)).toEqual([1, 2, 3, 4])
    expect(pageList(1, 1)).toEqual([1])
    expect(pageList(2, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })
})
