import { describe, expect, it } from 'vitest'
import { TAG_RULES, tabOfItem, tagsOf } from '../src/lib/placeTags.js'
import { parseTags, sourcesFor, toggleTag } from '../src/lib/placeCategories.js'
import { filterByTags, indexInfo, searchTagged } from '../server/tags.js'

describe('placeTags — 소개글에서 태그 뽑기', () => {
  it('탭 키: 12 관광지 · 14 문화시설 · 15 축제 · 39 음식점(FD05 는 카페), 그 밖은 없음', () => {
    expect(tabOfItem({ type: '12' })).toBe('spot')
    expect(tabOfItem({ type: 14 })).toBe('culture')
    expect(tabOfItem({ type: '15' })).toBe('festival')
    expect(tabOfItem({ type: '39', lcls: 'FD01' })).toBe('food')
    expect(tabOfItem({ type: '39', lcls: 'FD05' })).toBe('cafe')
    expect(tabOfItem({ type: '28' })).toBeNull()
  })
  it('단어가 하나라도 있으면 태그가 붙고, 여러 태그가 함께 붙을 수 있음', () => {
    expect(tagsOf('spot', '바다가 보이는 오름. 아이와 함께 걷기 좋아요')).toEqual(['sea', 'forest', 'family'])
    expect(tagsOf('cafe', '오션뷰 베이커리 카페, 반려견 동반 가능')).toEqual(expect.arrayContaining(['oceanview', 'dessert']))
    expect(tagsOf('food', '흑돼지 전문점')).toContain('blackpork')
    expect(tagsOf('spot', '')).toEqual([])
    expect(tagsOf('없는탭', '바다')).toEqual([])
  })
  it('태그 키는 탭 안에서 중복 없이 소문자', () => {
    for (const [tab, rules] of Object.entries(TAG_RULES)) {
      const keys = rules.map((r) => r.key)
      expect(new Set(keys).size, tab).toBe(keys.length)
      for (const k of keys) expect(k).toMatch(/^[a-z]+$/)
    }
  })
})

describe('분류·화면 쪽 규칙', () => {
  it('주소의 태그: 그 탭의 유효한 키만, 중복 제거', () => {
    expect(parseTags('spot', 'sea,forest,xx,sea')).toEqual(['sea', 'forest'])
    expect(parseTags('cafe', 'sea')).toEqual([])
    expect(parseTags('all', 'sea')).toEqual([])
    expect(toggleTag(['sea'], 'forest')).toEqual(['sea', 'forest'])
    expect(toggleTag(['sea', 'forest'], 'sea')).toEqual(['forest'])
  })
  it('태그를 고르면 색인 소스, 축제는 기간 검색에 태그를 얹음, 분류 칩은 함께 반영, 내 주변이 우선', () => {
    expect(sourcesFor('spot', 'all', false, ['sea'])).toEqual([{ api: 'tagged', tab: 'spot', tags: ['sea'], lcls: '' }])
    expect(sourcesFor('food', 'japanese', false, ['seafood'])).toEqual([{ api: 'tagged', tab: 'food', tags: ['seafood'], lcls: 'FD020200' }])
    expect(sourcesFor('cafe', 'all', false, ['dessert'])).toEqual([{ api: 'tagged', tab: 'cafe', tags: ['dessert'], lcls: '' }])
    expect(sourcesFor('festival', 'all', false, ['music'])).toEqual([{ api: 'festival', tags: ['music'] }])
    expect(sourcesFor('spot', 'all', true, ['sea'])).toEqual([{ api: 'near', type: '12' }])
    expect(sourcesFor('all', 'all', false, ['sea']).length).toBeGreaterThan(5)   // 전체 탭은 태그 없음(원래 소스)
  })
})

describe('server/tags — 색인 조회', () => {
  it('색인에 장소가 있고 소개글이 반영됨', () => {
    const info = indexInfo()
    expect(info.count).toBeGreaterThan(1000)
    expect(info.withText).toBeGreaterThan(500)
  })
  it('탭·태그(AND)·분류·이름·쪽 거르기', () => {
    const sea = searchTagged({ tab: 'spot', tags: ['sea'], rows: 500 })
    expect(sea.length).toBeGreaterThan(10)
    expect(sea.every((p) => p.type === '12')).toBe(true)
    const both = searchTagged({ tab: 'spot', tags: ['sea', 'family'], rows: 500 })
    expect(both.length).toBeLessThanOrEqual(sea.length)
    expect(searchTagged({ tab: 'spot', tags: ['sea'], rows: 5, page: 1 })).toHaveLength(5)
    expect(searchTagged({ tab: 'spot', tags: ['sea'], rows: 5, page: 2 }).map((p) => p.id)).not.toEqual(searchTagged({ tab: 'spot', tags: ['sea'], rows: 5, page: 1 }).map((p) => p.id))
    const cafes = searchTagged({ tab: 'cafe', tags: [], rows: 500 })
    expect(cafes.every((p) => p.lcls === 'FD05')).toBe(true)
    expect(searchTagged({ tab: 'food', tags: [], rows: 500 }).some((p) => p.lcls === 'FD05')).toBe(false)
    const korean = searchTagged({ tab: 'food', tags: [], lcls: 'FD01', rows: 500 })
    expect(korean.length).toBeGreaterThan(50)
    expect(korean.every((p) => p.lcls === 'FD01')).toBe(true)
    expect(searchTagged({ tab: 'food', tags: [], keyword: '흑돼지', rows: 500 }).every((p) => p.title.includes('흑돼지'))).toBe(true)
  })
  it('화조원은 소개글(조류 동물원)로 테마파크·정원 태그가 붙음', () => {
    expect(searchTagged({ tab: 'spot', tags: ['theme'], lcls: 'VE02', rows: 100 }).some((p) => p.title === '화조원')).toBe(true)
  })
  it('목록에서 태그로 거르기: 색인에 없는 항목은 빠짐', () => {
    const first = searchTagged({ tab: 'festival', tags: [], rows: 3 })
    const list = [...first, { id: 'nope', title: '없는행사' }]
    expect(filterByTags(list, []).length).toBe(list.length)
    expect(filterByTags(list, ['zzz'])).toEqual([])
  })
})
