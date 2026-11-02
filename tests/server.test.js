import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { searchTour } from '../server/tour.js'
import { getWeather } from '../server/weather.js'
import { searchHeritage } from '../server/heritage.js'

const mockFetch = (body) => vi.fn(async () => ({ text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) }))
beforeEach(() => { process.env.DATA_GO_KR_KEY = 'test-key' })
afterEach(() => vi.unstubAllGlobals())

describe('server/tour', () => {
  const item = { contentid: '1', title: '성산일출봉', addr1: '서귀포', firstimage: '', mapx: '126.94', mapy: '33.46', contenttypeid: '12' }
  it('키워드가 있으면 searchKeyword2, 없으면 areaBasedList2', async () => {
    const f = mockFetch({ response: { body: { items: { item: [item] } } } })
    vi.stubGlobal('fetch', f)
    await searchTour({ keyword: '해녀' })
    expect(f.mock.calls[0][0]).toContain('searchKeyword2')
    await searchTour({})
    expect(f.mock.calls[1][0]).toContain('areaBasedList2')
    expect(f.mock.calls[1][0]).toContain('lDongRegnCd=50')
  })
  it('결과를 정규화하고 단일 객체도 배열로', async () => {
    vi.stubGlobal('fetch', mockFetch({ response: { body: { items: { item } } } }))
    expect(await searchTour({})).toEqual([{ id: '1', title: '성산일출봉', addr: '서귀포', image: '', lng: '126.94', lat: '33.46', type: '12' }])
  })
  it('결과 없음 → 빈 배열', async () => {
    vi.stubGlobal('fetch', mockFetch({ response: { body: { items: '' } } }))
    expect(await searchTour({})).toEqual([])
  })
  it('JSON 이 아니면 에러', async () => {
    vi.stubGlobal('fetch', mockFetch('<xml>SERVICE_KEY_ERROR</xml>'))
    await expect(searchTour({})).rejects.toThrow('TourAPI')
  })
})

describe('server/weather', () => {
  it('슬롯별로 묶고 6개까지 반환', async () => {
    const item = []
    for (const t of ['0600', '0700', '0800', '0900', '1000', '1100', '1200']) {
      for (const [category, v] of [['TMP', '18'], ['SKY', '1'], ['PTY', '0'], ['POP', '20']])
        item.push({ fcstDate: '20261102', fcstTime: t, category, fcstValue: v })
    }
    const f = mockFetch({ response: { body: { items: { item } } } })
    vi.stubGlobal('fetch', f)
    const r = await getWeather({ place: '서귀포시' })
    expect(r).toHaveLength(6)
    expect(r[0]).toMatchObject({ place: '서귀포시', temp: 18, sky: '맑음', rain: '없음', pop: 20 })
    expect(f.mock.calls[0][0]).toContain('nx=52')
    expect(f.mock.calls[0][0]).toMatch(/base_time=\d{4}/)
  })
  it('알 수 없는 지역은 제주시 격자', async () => {
    const f = mockFetch({ response: { body: { items: { item: [] } } } })
    vi.stubGlobal('fetch', f)
    await getWeather({ place: '없는곳' })
    expect(f.mock.calls[0][0]).toContain('nx=53')
  })
})

describe('server/heritage', () => {
  const xml = `<result><item><ccbaMnm1>관덕정</ccbaMnm1><ccmaName>보물</ccmaName><ccsiName>제주시</ccsiName><latitude>33.51</latitude><longitude>126.52</longitude></item></result>`
  it('XML 파싱', async () => {
    const f = mockFetch(xml)
    vi.stubGlobal('fetch', f)
    expect(await searchHeritage({ keyword: '관덕정' })).toEqual([{ name: '관덕정', kind: '보물', city: '제주시', lat: 33.51, lng: 126.52 }])
    expect(f.mock.calls[0][0]).toContain('ccbaCtcd=50')
  })
  it('결과 없음 → 빈 배열', async () => {
    vi.stubGlobal('fetch', mockFetch('<result></result>'))
    expect(await searchHeritage({})).toEqual([])
  })
})

describe('server/tour — 페이지·이미지·지역코드', () => {
  const item = { contentid: '1', title: 'x', addr1: 'a', firstimage: 'http://tong.visitkorea.or.kr/a.jpg', mapx: '126', mapy: '33', contenttypeid: '12' }
  it('page·rows 를 pageNo·numOfRows 로 전달, 제주 법정동 코드 사용', async () => {
    const f = mockFetch({ response: { body: { items: { item: [item] } } } })
    vi.stubGlobal('fetch', f)
    await searchTour({ keyword: '오름', page: 3, rows: 12 })
    const url = f.mock.calls[0][0]
    expect(url).toContain('pageNo=3')
    expect(url).toContain('numOfRows=12')
    expect(url).toContain('lDongRegnCd=50')
    expect(url).not.toContain('areaCode=')
  })
  it('이미지 http → https', async () => {
    vi.stubGlobal('fetch', mockFetch({ response: { body: { items: { item: [item, { ...item, contentid: '2', firstimage: '' }] } } } }))
    const r = await searchTour({})
    expect(r[0].image).toBe('https://tong.visitkorea.or.kr/a.jpg')
    expect(r[1].image).toBe('')
  })
  it('contentTypeId 를 비우면 전체 유형', async () => {
    const f = mockFetch({ response: { body: { items: '' } } })
    vi.stubGlobal('fetch', f)
    await searchTour({ keyword: '해녀', contentTypeId: '' })
    expect(f.mock.calls[0][0]).not.toContain('contentTypeId')
  })
})
