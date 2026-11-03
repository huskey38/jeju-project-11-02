import { describe, expect, it } from 'vitest'
import { EASY_M, FEATURED, searchOreum } from '../server/oreum.js'

describe('오름 추천순 (처음 온 사람용 기본 정렬)', () => {
  const list = searchOreum({ sort: 'recommend', rows: 400 })
  it('368곳이 빠짐없이 나오고, 맨 앞은 대표 오름이 정해진 순서대로', () => {
    expect(list).toHaveLength(368)
    expect(list.slice(0, FEATURED.length).map((o) => o.id)).toEqual(FEATURED)
    expect(list.slice(0, 3).map((o) => o.name)).toEqual(['새별오름', '용눈이오름', '다랑쉬'])
  })
  it('그다음은 사진이 있고 표고 400m 이하인 오름이 낮은 순으로', () => {
    const next = list.slice(FEATURED.length, FEATURED.length + 20)
    expect(next.every((o) => o.image && o.elev <= EASY_M)).toBe(true)
    const e = next.map((o) => o.elev)
    expect(e).toEqual([...e].sort((a, b) => a - b))
  })
  it('이름순(기본값)·표고순은 그대로 — 추천순은 sort=recommend 일 때만', () => {
    expect(searchOreum({ rows: 2 }).map((o) => o.name)).toEqual(searchOreum({ sort: '', rows: 2 }).map((o) => o.name))
    expect(searchOreum({ sort: 'elev', rows: 1 })[0].elev).toBeGreaterThan(1700)
  })
})
