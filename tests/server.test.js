import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { searchTour } from '../server/tour.js'
import { getForecast, getWeather, midBase, midDay, summarizeShort, toGrid } from '../server/weather.js'
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
  it('분류체계 코드: 4자는 lclsSystm2, 8자(소분류)는 lclsSystm3 로 요청', async () => {
    const f = mockFetch({ response: { body: { items: { item: [item] } } } })
    vi.stubGlobal('fetch', f)
    await searchTour({ contentTypeId: '39', lclsSystm2: 'FD01' })
    expect(f.mock.calls[0][0]).toContain('lclsSystm2=FD01')
    await searchTour({ contentTypeId: '39', lclsSystm2: 'FD020100', keyword: '짜장' })
    expect(f.mock.calls[1][0]).toContain('lclsSystm3=FD020100')
    expect(f.mock.calls[1][0]).not.toContain('lclsSystm2=')
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

describe('server/weather — 장소·날짜별 예보', () => {
  it('위경도 → 기상청 격자: 제주시청 (53,38)', () => {
    expect(toGrid(33.4996, 126.5312)).toEqual([53, 38])
    const [x] = toGrid(33.458, 126.942)   // 성산 쪽은 더 동쪽 격자
    expect(x).toBeGreaterThan(53)
  })
  it('중기예보 발표 시각: 06·18시 + 30분 뒤부터, 그 전이면 직전 발표', () => {
    const at = (kst) => midBase(Date.parse(`${kst}+09:00`))
    expect(at('2026-11-02T12:00:00')).toEqual({ date: '2026-11-02', tmFc: '202611020600' })
    expect(at('2026-11-02T18:10:00')).toEqual({ date: '2026-11-02', tmFc: '202611020600' })   // 아직 18시 발표 전
    expect(at('2026-11-02T18:40:00')).toEqual({ date: '2026-11-02', tmFc: '202611021800' })
    expect(at('2026-11-02T03:00:00')).toEqual({ date: '2026-11-01', tmFc: '202611011800' })
  })
  it('단기예보를 날짜별로 요약 (최저·최고, 낮 하늘, 강수, 강수확률 최대)', () => {
    const row = (d, t, category, v) => ({ fcstDate: d, fcstTime: t, category, fcstValue: String(v) })
    const items = [
      row('20261102', '0900', 'TMP', 14), row('20261102', '1500', 'TMP', 18), row('20261102', '0900', 'SKY', 1), row('20261102', '1500', 'SKY', 1),
      row('20261102', '1500', 'PTY', 0), row('20261102', '0900', 'POP', 10), row('20261102', '1500', 'POP', 30),
      row('20261103', '0900', 'TMN', 12), row('20261103', '1500', 'TMX', 20), row('20261103', '0900', 'TMP', 13),
      row('20261103', '1200', 'SKY', 4), row('20261103', '1500', 'SKY', 4), row('20261103', '1200', 'PTY', 1), row('20261103', '1200', 'POP', 70),
    ]
    expect(summarizeShort(items)).toEqual({
      '2026-11-02': { tmin: 14, tmax: 18, sky: '맑음', precip: '', pop: 30 },
      '2026-11-03': { tmin: 12, tmax: 20, sky: '흐림', precip: '비', pop: 70 },
    })
  })
  it('중기예보: 4~7일은 오전·오후, 8~10일은 하루 하나', () => {
    const land = { wf4Am: '구름많음', wf4Pm: '구름많고 비', rnSt4Am: 20, rnSt4Pm: 60, wf8: '맑음', rnSt8: 10 }
    const ta = { taMin4: 15, taMax4: 18, taMin8: 12, taMax8: 16 }
    expect(midDay(land, ta, 4)).toEqual({ tmin: 15, tmax: 18, sky: '구름많음 → 구름많고 비', precip: '비', pop: 60 })
    expect(midDay(land, ta, 8)).toEqual({ tmin: 12, tmax: 16, sky: '맑음', precip: '', pop: 10 })
  })
  it('getForecast: 3일 이내는 이 좌표의 단기예보, 4~10일은 중기예보(제주 전체), 그 밖은 none', async () => {
    const now = Date.parse('2026-11-02T12:00:00+09:00')
    const shortItems = ['20261102', '20261104'].flatMap((d) => [{ fcstDate: d, fcstTime: '1200', category: 'TMP', fcstValue: '15' }, { fcstDate: d, fcstTime: '1200', category: 'SKY', fcstValue: '1' }])
    const f = vi.fn(async (url) => ({
      text: async () => JSON.stringify(
        url.includes('getVilageFcst') ? { response: { body: { items: { item: shortItems } } } }
          : url.includes('getMidLandFcst') ? { response: { body: { items: { item: [{ wf6Am: '맑음', wf6Pm: '맑음', rnSt6Am: 10, rnSt6Pm: 0 }] } } } }
            : { response: { body: { items: { item: [{ taMin6: 9, taMax6: 14 }] } } } }),
    }))
    vi.stubGlobal('fetch', f)
    const r = await getForecast({ lat: 33.4996, lng: 126.5312, dates: ['2026-11-02', '2026-11-08', '2026-11-20', '2026-11-01'] }, now)
    expect(r.map((x) => x.kind)).toEqual(['short', 'mid', 'none', 'none'])
    expect(r[1]).toMatchObject({ tmin: 9, tmax: 14, sky: '맑음', pop: 10 })
    expect(f.mock.calls.some(([u]) => u.includes('nx=53') && u.includes('ny=38'))).toBe(true)
    expect(f.mock.calls.find(([u]) => u.includes('getMidLandFcst'))[0]).toContain('regId=11G00000')
    // 단기예보 범위 안의 날짜만 요청하면 중기예보는 부르지 않음
    f.mockClear()
    await getForecast({ lat: 33.4996, lng: 126.5312, dates: ['2026-11-02', '2026-11-04'] }, now)
    expect(f.mock.calls.some(([u]) => u.includes('MidFcst'))).toBe(false)
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

describe('server — 분류 필터·국가유산 페이지', () => {
  it('tour: lclsSystm2 를 파라미터로 보내고 결과에 lcls 포함', async () => {
    const f = mockFetch({ response: { body: { items: { item: [{ contentid: '1', title: '카페', addr1: 'a', firstimage: '', mapx: '126', mapy: '33', contenttypeid: '39', lclsSystm2: 'FD05' }] } } } })
    vi.stubGlobal('fetch', f)
    const r = await searchTour({ contentTypeId: '39', lclsSystm2: 'FD05' })
    expect(f.mock.calls[0][0]).toContain('lclsSystm2=FD05')
    expect(r[0].lcls).toBe('FD05')
    await searchTour({ contentTypeId: '39' })
    expect(f.mock.calls[1][0]).not.toContain('lclsSystm2')
  })
  it('heritage: page 가 pageIndex 로 전달', async () => {
    const f = mockFetch('<result></result>')
    vi.stubGlobal('fetch', f)
    await searchHeritage({ page: 4, rows: 12 })
    expect(f.mock.calls[0][0]).toContain('pageIndex=4')
    expect(f.mock.calls[0][0]).toContain('pageUnit=12')
  })
})

// ── 위치 기반 · 축제 기간 · 숙박 제외 ───────────────────────────────────
import { isLodging, searchFestivals, searchNearby } from '../server/tour.js'
import { todayKst, ymd } from '../server/text.js'

const row = (over = {}) => ({ contentid: '1', title: 't', addr1: 'a', firstimage: '', mapx: '126.5', mapy: '33.5', contenttypeid: '39', lclsSystm1: 'FD', lclsSystm2: 'FD01', ...over })
const resp = (items) => ({ response: { body: { items: items.length ? { item: items } : '' } } })

describe('숙박 제외', () => {
  it('isLodging: 유형 32 또는 분류 대분류 AC', () => {
    expect(isLodging({ contenttypeid: '32' })).toBe(true)
    expect(isLodging({ contenttypeid: 32 })).toBe(true)
    expect(isLodging({ contenttypeid: '12', lclsSystm1: 'AC' })).toBe(true)
    expect(isLodging({ contenttypeid: '12', lclsSystm1: 'VE' })).toBe(false)
  })
  it('searchTour: 유형 32 는 호출 없이 빈 결과, 유형을 비워도 숙박은 걸러냄', async () => {
    const f = mockFetch(resp([row({ contentid: '1' }), row({ contentid: '2', contenttypeid: '32', lclsSystm1: 'AC' })]))
    vi.stubGlobal('fetch', f)
    expect(await searchTour({ contentTypeId: '32' })).toEqual([])
    expect(f).not.toHaveBeenCalled()
    const r = await searchTour({ contentTypeId: '', keyword: '호텔' })
    expect(r.map((x) => x.id)).toEqual(['1'])
  })
})

describe('searchNearby (위치 기반)', () => {
  it('좌표·반경을 mapX/mapY/radius 로 보내고 거리순(arrange=E), 지역 제한 없이, dist 는 반올림 미터', async () => {
    const f = mockFetch(resp([row({ dist: '286.36' })]))
    vi.stubGlobal('fetch', f)
    const r = await searchNearby({ lat: 33.4996, lng: 126.5312, radius: 3000 })
    const url = f.mock.calls[0][0]
    expect(url).toContain('locationBasedList2')
    expect(url).toContain('mapX=126.5312'); expect(url).toContain('mapY=33.4996'); expect(url).toContain('radius=3000'); expect(url).toContain('arrange=E')
    expect(url).not.toContain('lDongRegnCd')
    expect(r[0].dist).toBe(286)
  })
  it('반경은 100m~20km 로 제한, 유형·분류 필터 전달', async () => {
    const f = mockFetch(resp([]))
    vi.stubGlobal('fetch', f)
    await searchNearby({ lat: 33.5, lng: 126.5, radius: 999999, contentTypeId: '39', lclsSystm2: 'FD05' })
    expect(f.mock.calls[0][0]).toContain('radius=20000')
    expect(f.mock.calls[0][0]).toContain('contentTypeId=39')
    expect(f.mock.calls[0][0]).toContain('lclsSystm2=FD05')
    await searchNearby({ lat: 33.5, lng: 126.5, radius: 5 })
    expect(f.mock.calls[1][0]).toContain('radius=100')
  })
  it('제주 밖 좌표·잘못된 값은 에러(호출 안 함), 숙박 유형은 빈 결과', async () => {
    const f = mockFetch(resp([]))
    vi.stubGlobal('fetch', f)
    await expect(searchNearby({ lat: 37.5, lng: 127 })).rejects.toThrow('제주')
    await expect(searchNearby({})).rejects.toThrow('제주')
    expect(await searchNearby({ lat: 33.5, lng: 126.5, contentTypeId: '32' })).toEqual([])
    expect(f).not.toHaveBeenCalled()
  })
  it('숙박을 빼고도 쪽 크기가 유지됨 (원본 100건씩 읽어 걸러낸 뒤 자름)', async () => {
    const raw = Array.from({ length: 30 }, (_, i) => row({ contentid: String(i), contenttypeid: i % 3 === 0 ? '32' : '39', lclsSystm1: i % 3 === 0 ? 'AC' : 'FD' }))
    vi.stubGlobal('fetch', mockFetch(resp(raw)))
    const p1 = await searchNearby({ lat: 33.5, lng: 126.5, rows: 8, page: 1 })
    const p2 = await searchNearby({ lat: 33.5, lng: 126.5, rows: 8, page: 2 })
    const p3 = await searchNearby({ lat: 33.5, lng: 126.5, rows: 8, page: 3 })
    expect([p1.length, p2.length, p3.length]).toEqual([8, 8, 4])           // 비숙박 20건
    expect(new Set([...p1, ...p2, ...p3].map((x) => x.id)).size).toBe(20)    // 겹침 없음
    expect([...p1, ...p2, ...p3].some((x) => x.type === '32')).toBe(false)
  })
  it('lclsExclude: 음식점에서 카페 제외', async () => {
    vi.stubGlobal('fetch', mockFetch(resp([row({ contentid: '1', lclsSystm2: 'FD05' }), row({ contentid: '2', lclsSystm2: 'FD01' })])))
    const r = await searchNearby({ lat: 33.5, lng: 126.5, contentTypeId: '39', lclsExclude: 'FD05' })
    expect(r.map((x) => x.id)).toEqual(['2'])
  })
})

describe('searchFestivals (축제 기간)', () => {
  const fest = (id, title, s, e) => row({ contentid: id, title, contenttypeid: '15', eventstartdate: s, eventenddate: e })
  it('시작일을 eventStartDate 로(기본 오늘), 기간을 YYYY-MM-DD 로 정리', async () => {
    const f = mockFetch(resp([fest('1', '벚꽃축제', '20260404', '20260405')]))
    vi.stubGlobal('fetch', f)
    const r = await searchFestivals({})
    const url = f.mock.calls[0][0]
    expect(url).toContain('searchFestival2')
    expect(url).toContain(`eventStartDate=${todayKst()}`)
    expect(url).toContain('lDongRegnCd=50')
    expect(r[0]).toMatchObject({ title: '벚꽃축제', start: '2026-04-04', end: '2026-04-05' })
  })
  it('from·to 는 대시 있는 형식도 받고, 이상한 값은 무시', async () => {
    const f = mockFetch(resp([]))
    vi.stubGlobal('fetch', f)
    await searchFestivals({ from: '2026-01-01', to: '2026-12-31' })
    expect(f.mock.calls[0][0]).toContain('eventStartDate=20260101')
    expect(f.mock.calls[0][0]).toContain('eventEndDate=20261231')
    await searchFestivals({ from: 'abc', to: '내일' })
    expect(f.mock.calls[1][0]).toContain(`eventStartDate=${todayKst()}`)
    expect(f.mock.calls[1][0]).not.toContain('eventEndDate')
  })
  it('키워드는 행사명 포함 여부, 쪽 나누기', async () => {
    const list = ['A축제', 'B축제', 'C공연', 'D축제', 'E축제'].map((t, i) => fest(String(i), t, '20260101', '20260102'))
    vi.stubGlobal('fetch', mockFetch(resp(list)))
    expect((await searchFestivals({ keyword: '축제' })).map((x) => x.title)).toEqual(['A축제', 'B축제', 'D축제', 'E축제'])
    expect((await searchFestivals({ keyword: '축제', rows: 3, page: 2 })).map((x) => x.title)).toEqual(['E축제'])
    expect(await searchFestivals({ keyword: '없음' })).toEqual([])
  })
})

describe('날짜 도우미', () => {
  it('ymd', () => {
    expect(ymd('2026-11-02')).toBe('20261102')
    expect(ymd('20261102')).toBe('20261102')
    expect(ymd('내일')).toBe('')
    expect(ymd(undefined)).toBe('')
  })
})
