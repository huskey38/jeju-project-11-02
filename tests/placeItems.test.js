import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/api/client', () => ({
  fetchRestaurants: vi.fn(), fetchOreum: vi.fn(), fetchNearby: vi.fn(), fetchPlaces: vi.fn(),
}))
const client = await import('../src/api/client')
const { ROWS, favOf, fetchPage, oreumExtraRows, serverSort, valid } = await import('../src/lib/placeItems.js')

beforeEach(() => vi.clearAllMocks())

describe('favOf — 목록 항목 → 즐겨찾기 키 (Places 분리 후에도 같은 규칙)', () => {
  it('국가유산은 이름, 공연장·음식점은 id, 관광지는 tour id', () => {
    expect(favOf({ kind: 'heritage', name: '해녀노래' })).toEqual({ source: 'heritage', id: '해녀노래', title: '해녀노래' })
    expect(favOf({ kind: 'venue', id: 'v1', title: '대극장' })).toEqual({ source: 'venue', id: 'v1', title: '대극장' })
    expect(favOf({ kind: 'rest', id: 'r1', title: '식당' })).toEqual({ source: 'rest', id: 'r1', title: '식당' })
    expect(favOf({ kind: 'tour', id: '123', title: '장소' })).toEqual({ source: 'tour', id: '123', title: '장소' })
  })
  it('오름은 관광공사 id 가 있으면 예전 기록과 같은 키(tour), 없으면 공식 연번(oreum)', () => {
    expect(favOf({ kind: 'oreum', id: '214', tourId: '555', title: '새별오름' })).toEqual({ source: 'tour', id: '555', title: '새별오름' })
    expect(favOf({ kind: 'oreum', id: '7', title: '이름만있는오름' })).toEqual({ source: 'oreum', id: '7', title: '이름만있는오름' })
  })
})

describe('화면 키 → 서버 정렬 값, 유효한 분류 고르기', () => {
  it("'' = 추천순(recommend), 'name' = 서버 기본(이름순), 나머지는 그대로", () => {
    expect(serverSort('')).toBe('recommend')
    expect(serverSort('name')).toBe('')
    expect(serverSort('elev')).toBe('elev')
    expect(serverSort('elev_asc')).toBe('elev_asc')
  })
  it('valid: 목록에 있는 키만, 아니면 기본값', () => {
    const list = [{ key: 'a' }, { key: 'b' }]
    expect(valid(list, 'b', 'a')).toBe('b')
    expect(valid(list, 'zzz', 'a')).toBe('a')
    expect(valid(list, null, 'a')).toBe('a')
  })
})

describe('fetchPage — 소스 하나의 한 쪽을 화면용 항목으로', () => {
  it('음식점: kind rest, key r-id', async () => {
    client.fetchRestaurants.mockResolvedValue([{ id: '9', title: '가게' }])
    const r = await fetchPage({ api: 'rest', biz: '한식' }, { keyword: '국수' }, 2)
    expect(client.fetchRestaurants).toHaveBeenCalledWith('국수', '한식', 2, ROWS)
    expect(r).toEqual([{ id: '9', title: '가게', kind: 'rest', key: 'r-9' }])
  })
  it('오름: 쪽 단위로 받고 kind oreum, key o-id', async () => {
    client.fetchOreum.mockResolvedValue([{ id: '214', title: '새별오름' }])
    const r = await fetchPage({ api: 'oreum', form: '', tags: [], sort: 'recommend', near: false }, { keyword: '', visitedKeys: new Set() }, 1)
    expect(client.fetchOreum).toHaveBeenCalledWith(expect.objectContaining({ sort: 'recommend', page: 1, rows: ROWS }))
    expect(r[0]).toMatchObject({ kind: 'oreum', key: 'o-214' })
  })
  it('오름 + 안 오른 오름만: 같은 조건으로 전부 받아 오른 오름을 빼고 쪽을 직접 나눔', async () => {
    client.fetchOreum.mockResolvedValue([{ id: '1', title: 'a' }, { id: '2', title: 'b', tourId: '77' }, { id: '3', title: 'c' }])
    const visitedKeys = new Set(['tour:77', 'oreum:3'])   // 2번(관광공사 id 77)·3번(공식 연번) 오름
    const r = await fetchPage({ api: 'oreum', tags: [], sort: '', near: false }, { keyword: '', unvisited: true, visitedKeys }, 1)
    expect(client.fetchOreum).toHaveBeenCalledWith(expect.objectContaining({ page: 1, rows: 400 }))
    expect(r.map((o) => o.id)).toEqual(['1'])
  })
  it('내 주변: 위치·반경(m)·유형을 서버에 넘기고 kind tour', async () => {
    client.fetchNearby.mockResolvedValue([{ id: '5', title: '카페' }])
    const r = await fetchPage({ api: 'near', type: '39', lcls: 'FD05', xlcls: '' }, { coords: { lat: 33.5, lng: 126.5 }, radiusKm: 3 }, 1)
    expect(client.fetchNearby).toHaveBeenCalledWith(expect.objectContaining({ lat: 33.5, lng: 126.5, radius: 3000, type: '39', lcls: 'FD05', rows: ROWS }))
    expect(r[0]).toMatchObject({ kind: 'tour', key: 't-5' })
  })
  it('그 밖(관광공사 검색): fetchPlaces 로 받아 kind tour', async () => {
    client.fetchPlaces.mockResolvedValue([{ id: '8', title: '장소' }])
    const r = await fetchPage({ api: 'tour', type: '12', lcls: '' }, { keyword: '오름' }, 1)
    expect(client.fetchPlaces).toHaveBeenCalledWith('오름', '12', 1, ROWS, '')
    expect(r[0].key).toBe('t-8')
  })
})

describe('oreumExtraRows — 오름 정보 카드의 공식 보강 줄', () => {
  it('요약·편의시설·주차·관리를 줄로 만들고, 소개를 쓰는 경우에만 소개 출처를 붙임', () => {
    const b = { summary: '이름 유래', facilities: ['화장실', '쉼터'], parking: 15, org: '제주도청', tel: '064', intro: '소개글' }
    const labels = (usesIntro) => oreumExtraRows(b, usesIntro).filter((r) => r.value).map((r) => r.label)
    expect(labels(true)).toEqual(['이름·특징', '특징 출처', '편의시설', '주차', '관리', '소개 출처'])
    expect(labels(false)).not.toContain('소개 출처')
    expect(oreumExtraRows(b, false).find((r) => r.label === '주차').value).toBe('15대')
  })
})
