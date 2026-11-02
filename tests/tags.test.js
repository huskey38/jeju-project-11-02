import { describe, expect, it } from 'vitest'
import { TAG_RULES, tabOfItem, tagsOf } from '../src/lib/placeTags.js'
import { parseTags, sourcesFor, toggleTag } from '../src/lib/placeCategories.js'
import { filterByTags, indexInfo, searchTagged } from '../server/tags.js'
import { isOreum } from '../src/lib/placeTags.js'

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
  it('태그를 고르면 색인 소스, 음식점 종류 칩은 함께 반영, 내 주변이 우선(오름은 내 주변과 태그를 함께 씀)', () => {
    expect(sourcesFor('food', 'japanese', false, ['seafood'])).toEqual([{ api: 'tagged', tab: 'food', tags: ['seafood'], lcls: 'FD020200' }])
    expect(sourcesFor('cafe', 'all', false, ['dessert'])).toEqual([{ api: 'tagged', tab: 'cafe', tags: ['dessert'], lcls: '' }])
    expect(sourcesFor('cafe', 'all', true, ['dessert'])).toEqual([{ api: 'near', type: '39', lcls: 'FD05' }])
    expect(sourcesFor('saved', 'all', false, ['sea'])).toEqual([])
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

describe('오름 탭 — 분류 NA010100 관광지', () => {
  it('오름 판별: 관광지(12) 중 소분류 NA010100', () => {
    expect(isOreum({ type: '12', lcls3: 'NA010100' })).toBe(true)
    expect(isOreum({ type: 12, lclsSystm3: 'NA010100' })).toBe(true)
    expect(isOreum({ type: '12', lcls3: 'NA020100' })).toBe(false)
    expect(isOreum({ type: '39', lcls3: 'NA010100' })).toBe(false)
  })
  it('색인에서 오름만 나오고 태그(AND)·이름으로 거를 수 있음, 태그는 오름 전용 키', () => {
    const all = searchTagged({ tab: 'oreum', rows: 500 })
    expect(all.length).toBeGreaterThan(60)
    expect(all.length).toBeLessThan(200)
    expect(all.some((p) => p.title.includes('오름'))).toBe(true)
    expect(all.every((p) => p.type === '12')).toBe(true)
    const sun = searchTagged({ tab: 'oreum', tags: ['sunrise'], rows: 500 })
    expect(sun.length).toBeGreaterThan(0)
    expect(sun.length).toBeLessThan(all.length)
    expect(searchTagged({ tab: 'oreum', tags: ['sunrise', 'grass', 'family'], rows: 500 }).length).toBeLessThanOrEqual(sun.length)
    expect(searchTagged({ tab: 'oreum', keyword: '새별', rows: 50 }).every((p) => p.title.includes('새별'))).toBe(true)
    expect(searchTagged({ tab: 'oreum', tags: ['sea'], rows: 50 })).toEqual([])   // 관광지 탭의 태그 키는 오름에 없음
  })
  it('내 위치 반경 안의 오름을 가까운 순으로 (dist 포함), 반경 밖은 제외, 위치 없으면 dist 없음', () => {
    const near = searchTagged({ tab: 'oreum', lat: 33.4996, lng: 126.5312, radius: 8000, rows: 100 })
    expect(near.length).toBeGreaterThan(0)
    expect(near.every((p) => p.dist <= 8000)).toBe(true)
    expect(near.map((p) => p.dist)).toEqual([...near.map((p) => p.dist)].sort((a, b) => a - b))
    expect(searchTagged({ tab: 'oreum', lat: 33.4996, lng: 126.5312, radius: 1, rows: 100 })).toEqual([])
    expect(searchTagged({ tab: 'oreum', rows: 3 })[0].dist).toBeUndefined()
  })
})
