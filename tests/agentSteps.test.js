import { describe, expect, it } from 'vitest'
import { TOOL_API, TOOL_LABEL, apiOf, stepText, stepsText } from '../src/lib/agentSteps.js'

describe('agentSteps — 호출한 도구를 읽기 쉽게', () => {
  it('도구 이름은 한글 라벨로, 핵심 인자와 건수를 함께', () => {
    expect(stepText({ tool: 'search_tour_places', args: { keyword: '해녀' }, count: 2 })).toBe('장소 검색 · 해녀 → 2건')
    expect(stepText({ tool: 'get_weather', args: { place: '서귀포시' }, count: 6 })).toBe('날씨 조회 · 서귀포시 → 6건')
    expect(stepText({ tool: 'search_tour_places', args: { lcls: 'VE02' }, count: 26 })).toBe('장소 검색 · VE02 → 26건')
    expect(stepText({ tool: 'search_nearby', args: { lat: 33.4, lng: 126.5, category: 'cafe' }, count: 3 })).toBe('주변 검색 · cafe → 3건')
    expect(stepText({ tool: 'search_nearby', args: { lat: 33.4, lng: 126.5 }, count: 0 })).toBe('주변 검색 · 좌표 주변 → 0건')
  })
  it('오름 검색은 특징(태그)·이름을 인자로 보여줌', () => {
    expect(stepText({ tool: 'search_oreum', args: { tag: 'grass' }, count: 29 })).toBe('오름 검색 · 억새·꽃 → 29건')
    expect(stepText({ tool: 'search_oreum', args: { keyword: '새별' }, count: 1 })).toBe('오름 검색 · 새별 → 1건')
    expect(stepText({ tool: 'search_oreum', args: { sort: 'elev' }, count: 10 })).toBe('오름 검색 · 표고 높은 순 → 10건')
    expect(stepText({ tool: 'search_oreum', args: { form: 'horseshoe' }, count: 10 })).toBe('오름 검색 · 말굽형 → 10건')
    expect(TOOL_LABEL.search_oreum).toBe('오름 검색')
  })
  it('소개글 확인은 건수 없이, 인자가 없으면 이름만, 모르는 도구는 이름 그대로', () => {
    expect(stepText({ tool: 'get_place_detail', args: { id: '2606209' }, count: 0 })).toBe('소개글 확인')
    expect(stepText({ tool: 'search_heritage', args: {}, count: 4 })).toBe('국가유산 검색 → 4건')
    expect(stepText({ tool: 'new_tool', args: {}, count: 1 })).toBe('new_tool → 1건')
  })
  it('여러 도구는 화살표로 이어 붙임, 에이전트의 모든 도구에 라벨이 있음', () => {
    expect(stepsText([{ tool: 'get_weather', args: { place: '제주시' }, count: 6 }, { tool: 'search_tour_places', args: { keyword: '박물관' }, count: 3 }]))
      .toBe('날씨 조회 · 제주시 → 6건 → 장소 검색 · 박물관 → 3건')
    expect(stepsText([])).toBe('')
    for (const name of ['search_tour_places', 'search_nearby', 'search_festivals', 'search_heritage', 'search_restaurants', 'get_weather', 'get_place_detail']) expect(TOOL_LABEL[name]).toBeTruthy()
  })
})

describe('apiOf — 도구가 쓰는 검색 API 이름', () => {
  it('모든 도구에 API 이름이 있고, 도구별로 맞는 출처를 돌려줌', () => {
    expect(Object.keys(TOOL_API).sort()).toEqual(Object.keys(TOOL_LABEL).sort())
    expect(apiOf({ tool: 'search_oreum' })).toBe('제주 오름현황(공공데이터)')
    expect(apiOf({ tool: 'get_weather' })).toBe('기상청 단기·중기예보')
    expect(apiOf({ tool: 'search_restaurants' })).toBe('행정안전부 일반음식점')
    expect(apiOf({ tool: 'search_nearby' })).toBe('한국관광공사 TourAPI')
    expect(apiOf({ tool: 'unknown' })).toBe('')
  })
})
