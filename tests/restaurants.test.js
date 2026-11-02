import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BIZ_TYPES, getRestaurant, searchRestaurants } from '../server/restaurants.js'
import { badgeOf, recommendModeOf, subtitleOf } from '../src/lib/placeCategories.js'

const mockFetch = (items) => vi.fn(async () => ({ text: async () => JSON.stringify({ response: { body: { items: { item: items } } } }) }))
beforeEach(() => { process.env.DATA_GO_KR_KEY = 'test-key' })
afterEach(() => vi.unstubAllGlobals())

// 곽지 해변 근처 실제 좌표(중부원점 TM)
const raw = (extra = {}) => ({
  MNG_NO: '6510000-101-2026-00725', BPLC_NM: '애월혼술바연결고리', BZSTAT_SE_NM: '한식',
  ROAD_NM_ADDR: '제주특별자치도 제주시 애월읍 곽지1길 26-7, 1층', LOTNO_ADDR: '제주특별자치도 제주시 애월읍 곽지리 1581-7',
  CRD_INFO_X: '135233.818366405', CRD_INFO_Y: '-5054.50065964259', TELNO: '', LCPMT_YMD: '2026-10-30', DTL_SALS_STTS_NM: '영업', ...extra,
})

describe('server/restaurants — 일반음식점(행정안전부)', () => {
  it('영업 중·제주 조건과 이름·업태 조건으로 요청, 쪽 크기는 100 까지', async () => {
    const f = mockFetch([raw()])
    vi.stubGlobal('fetch', f)
    await searchRestaurants({ keyword: ' 흑돼지 ', biz: '횟집', rows: 500, page: 3 })
    const url = decodeURIComponent(f.mock.calls[0][0])
    expect(url).toContain('/1741000/general_restaurants/info')
    expect(url).toContain('cond[SALS_STTS_CD::EQ]=01')
    expect(url).toContain('cond[ROAD_NM_ADDR::LIKE]=제주특별자치도')
    expect(url).toContain('cond[BPLC_NM::LIKE]=흑돼지')
    expect(url).toContain('cond[BZSTAT_SE_NM::EQ]=횟집')
    expect(url).toContain('numOfRows=100')
    expect(url).toContain('pageNo=3')
  })
  it('모르는 업태·빈 검색어는 조건에 넣지 않음', async () => {
    const f = mockFetch([])
    vi.stubGlobal('fetch', f)
    await searchRestaurants({ keyword: '  ', biz: '이상한업태' })
    const url = decodeURIComponent(f.mock.calls[0][0])
    expect(url).not.toContain('BPLC_NM')
    expect(url).not.toContain('BZSTAT_SE_NM')
  })
  it('화면용 항목으로 바꾸고 TM 좌표를 위경도로 변환 (곽지 해변 근처)', async () => {
    vi.stubGlobal('fetch', mockFetch(raw({ TELNO: '064-111-2222' })))
    const [r] = await searchRestaurants()
    expect(r).toMatchObject({ id: '6510000-101-2026-00725', title: '애월혼술바연결고리', biz: '한식', tel: '064-111-2222' })
    expect(r.addr).toContain('곽지1길')
    expect(Number(r.lat)).toBeCloseTo(33.449, 2)
    expect(Number(r.lng)).toBeCloseTo(126.304, 2)
  })
  it('도로명주소가 없으면 지번주소, 좌표가 없으면 빈 값, 응답이 한 개(객체)여도 배열', async () => {
    vi.stubGlobal('fetch', mockFetch(raw({ ROAD_NM_ADDR: '', CRD_INFO_X: '', CRD_INFO_Y: '' })))
    const list = await searchRestaurants()
    expect(list).toHaveLength(1)
    expect(list[0].addr).toContain('곽지리')
    expect(list[0].lat).toBe('')
    expect(list[0].lng).toBe('')
  })
  it('빈 결과는 빈 배열, JSON 이 아니면 에러', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ text: async () => JSON.stringify({ response: { body: { items: '' } } }) })))
    expect(await searchRestaurants()).toEqual([])
    vi.stubGlobal('fetch', vi.fn(async () => ({ text: async () => '<xml>ERR</xml>' })))
    await expect(searchRestaurants()).rejects.toThrow('일반음식점')
  })
  it('상세: 관리번호로 조회하고 이용 정보(업태·전화·지번·허가일·상태) 목록을 만듦, 없으면 에러', async () => {
    const f = mockFetch([raw({ TELNO: '064-1' })])
    vi.stubGlobal('fetch', f)
    const d = await getRestaurant({ id: '6510000-101-2026-00725' })
    expect(decodeURIComponent(f.mock.calls[0][0])).toContain('cond[MNG_NO::EQ]=6510000-101-2026-00725')
    expect(d.info.map((x) => x.label)).toEqual(['업태', '전화', '지번 주소', '허가일', '영업 상태'])
    vi.stubGlobal('fetch', mockFetch([]))
    await expect(getRestaurant({ id: 'x' })).rejects.toThrow('찾을 수 없어요')
    await expect(getRestaurant({})).rejects.toThrow('id')
  })
  it('관광공사 음식점과 이름이 같고 300m 안이면 dup 표시 (다른 동네의 같은 이름은 아님)', async () => {
    // 색인에서 음식점 하나를 골라 그 자리에 같은 이름을 만들어 봄
    const idx = (await import('../server/data/placeIndex.js')).default
    const t = idx.items.find((i) => i.type === '39' && i.lat && i.lng && !/[()]/.test(i.title))
    // 위경도 → TM 역변환은 proj4 로
    const proj4 = (await import('proj4')).default
    const [x, y] = proj4('WGS84', 'EPSG:5174', [Number(t.lng), Number(t.lat)])
    vi.stubGlobal('fetch', mockFetch([raw({ BPLC_NM: t.title, CRD_INFO_X: String(x), CRD_INFO_Y: String(y) }), raw({ BPLC_NM: t.title + ' ' })]))
    const [same, elsewhere] = await searchRestaurants()
    expect(same.dup).toBe(true)
    expect(elsewhere.dup).toBeUndefined()   // 곽지 쪽 좌표라 멀리 떨어져 있음
  })
  it('업태 목록', () => {
    expect(BIZ_TYPES).toEqual(expect.arrayContaining(['한식', '횟집', '식육(숯불구이)', '분식']))
  })
})

describe('일반음식점 카드 표시', () => {
  const r = { kind: 'rest', id: '1', title: '성산막회', biz: '횟집', addr: '서귀포시 성산읍', tel: '064-1', lat: '33.46', lng: '126.93' }
  it('배지·부제목·근처 관광지 추천', () => {
    expect(badgeOf(r)).toBe('음식점·횟집')
    expect(badgeOf({ ...r, biz: '' })).toBe('음식점')
    expect(subtitleOf(r)).toBe('서귀포시 성산읍 · 064-1')
    expect(recommendModeOf(r)).toBe('food')
    expect(recommendModeOf({ ...r, lat: '', lng: '' })).toBeNull()
  })
})
