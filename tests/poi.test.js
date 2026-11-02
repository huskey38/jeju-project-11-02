import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { POI_CATEGORIES, searchPoi } from '../server/poi.js'

const doc = { id: '623129921', place_name: '세븐일레븐 서귀포중문오성점', address_name: '서귀포시 색달동 2506-1', road_address_name: '서귀포시 중문관광로 31', phone: '064-1', distance: '177', x: '126.4144', y: '33.2553', place_url: 'http://place.map.kakao.com/623129921' }
const mockFetch = (body, ok = true, status = 200) => vi.fn(async () => ({ ok, status, json: async () => body }))
beforeEach(() => { process.env.KAKAO_REST_KEY = 'rest-key' })
afterEach(() => vi.unstubAllGlobals())

describe('server/poi — 카카오 주변 편의점·주차장', () => {
  it('카테고리·좌표·반경을 카카오에 전달하고 REST 키는 헤더로만 보냄', async () => {
    const f = mockFetch({ documents: [doc] })
    vi.stubGlobal('fetch', f)
    await searchPoi({ lat: '33.2548', lng: '126.4127', cat: 'CS2', radius: 800, rows: 99 })
    const [url, init] = f.mock.calls[0]
    expect(url).toContain('/v2/local/search/category.json')
    expect(url).toContain('category_group_code=CS2')
    expect(url).toContain('x=126.4127')
    expect(url).toContain('y=33.2548')
    expect(url).toContain('sort=distance')
    expect(url).toContain('radius=800')
    expect(url).toContain('size=15')                         // 한 쪽 최대 15
    expect(url).not.toContain('rest-key')
    expect(init.headers.Authorization).toBe('KakaoAK rest-key')
  })
  it('화면용 항목: 도로명주소 우선, 거리는 숫자, 링크는 https', async () => {
    vi.stubGlobal('fetch', mockFetch({ documents: [doc, { ...doc, id: '2', road_address_name: '', phone: '', place_url: '' }] }))
    const [a, b] = await searchPoi({ lat: 33.25, lng: 126.41, cat: 'PK6' })
    expect(a).toEqual({ id: '623129921', title: '세븐일레븐 서귀포중문오성점', addr: '서귀포시 중문관광로 31', tel: '064-1', dist: 177, lat: '33.2553', lng: '126.4144', url: 'https://place.map.kakao.com/623129921' })
    expect(b).toMatchObject({ addr: '서귀포시 색달동 2506-1', tel: '', url: '' })
  })
  it('주차장: 공영(하위 분류 또는 이름의 "공영")을 먼저, 각각 가까운 순 — 이름 검색과 카테고리 2쪽을 합치고 중복 제거', async () => {
    const lot = (id, name, dist, cat = '교통,수송 > 교통시설 > 주차장') => ({ id, place_name: name, category_name: cat, distance: String(dist), x: '126.5', y: '33.5', address_name: 'a', category_group_code: 'PK6' })
    const priv1 = lot('p1', '맥도날드 주차장', 50), priv2 = lot('p2', '스타벅스 주차장', 90)
    const pubSub = lot('g1', '시청 주차장1', 300, '교통,수송 > 교통시설 > 주차장 > 공영주차장')
    const pubName = lot('g2', '성산 공영주차장', 200)
    const f = vi.fn(async (url) => ({
      ok: true, status: 200,
      json: async () => ({ documents: url.includes('keyword.json') ? [pubName] : url.includes('page=2') ? [pubSub, priv2] : [priv1, pubName] }),
    }))
    vi.stubGlobal('fetch', f)
    const r = await searchPoi({ lat: 33.5, lng: 126.5, cat: 'PK6', rows: 3 })
    expect(r.map((x) => x.id)).toEqual(['g2', 'g1', 'p1'])        // 공영(가까운 순) → 민간(가까운 순), 3곳까지, g2 중복 없음
    expect(r.map((x) => !!x.public)).toEqual([true, true, false])
    const urls = f.mock.calls.map(([u]) => decodeURIComponent(u))
    expect(urls.some((u) => u.includes('keyword.json') && u.includes('query=공영주차장') && u.includes('category_group_code=PK6'))).toBe(true)
    expect(urls.filter((u) => u.includes('category.json')).length).toBe(2)
    // 편의점·주유소는 이전처럼 카테고리 검색 한 번, public 표시 없음
    const g = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ documents: [{ ...doc, place_name: '공영 편의점', category_group_code: 'CS2' }] }) }))
    vi.stubGlobal('fetch', g)
    const cs = await searchPoi({ lat: 33.5, lng: 126.5, cat: 'CS2' })
    expect(g).toHaveBeenCalledTimes(1)
    expect(cs[0].public).toBeUndefined()                           // 공영 표시는 주차장만
  })
  it('반경은 100~2000m 로 보정, 알 수 없는 카테고리·제주 밖 좌표·키 없음은 에러', async () => {
    const f = mockFetch({ documents: [] })
    vi.stubGlobal('fetch', f)
    await searchPoi({ lat: 33.25, lng: 126.41, cat: 'CS2', radius: 99999 })
    expect(f.mock.calls[0][0]).toContain('radius=2000')
    await searchPoi({ lat: 33.25, lng: 126.41, cat: 'CS2', radius: 10 })
    expect(f.mock.calls[1][0]).toContain('radius=100')
    await expect(searchPoi({ lat: 33.25, lng: 126.41, cat: 'BK9' })).rejects.toThrow('CS2')
    await expect(searchPoi({ lat: 33.25, lng: 126.41, cat: 'OL7' })).resolves.toEqual([])   // 주유소는 허용
    await expect(searchPoi({ lat: 37.5, lng: 127, cat: 'CS2' })).rejects.toThrow('제주 안의')
    delete process.env.KAKAO_REST_KEY
    await expect(searchPoi({ lat: 33.25, lng: 126.41, cat: 'CS2' })).rejects.toThrow('KAKAO_REST_KEY')
  })
  it('카카오가 오류를 주면 상태 코드와 메시지를 담은 에러', async () => {
    vi.stubGlobal('fetch', mockFetch({ msg: 'disabled OPEN_MAP_AND_LOCAL service' }, false, 403))
    await expect(searchPoi({ lat: 33.25, lng: 126.41, cat: 'CS2' })).rejects.toThrow('403')
    vi.stubGlobal('fetch', mockFetch({}))
    expect(await searchPoi({ lat: 33.25, lng: 126.41, cat: 'CS2' })).toEqual([])
  })
  it('편의점·주차장·주유소만', () => {
    expect(POI_CATEGORIES).toEqual({ CS2: '편의점', PK6: '주차장', OL7: '주유소' })
  })
})
