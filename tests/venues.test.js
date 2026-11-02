import { describe, expect, it, vi } from 'vitest'
import { build, cleanAddr, geoAddr, parseCsv, splitName } from '../scripts/build-venues.mjs'
import { geocode, pickCoord } from '../scripts/geocode-venues.mjs'
import { getVenueDetail, searchVenues } from '../server/venues.js'
import venues from '../server/data/venues.js'
import { badgeOf, sourcesFor, subtitleOf } from '../src/lib/placeCategories.js'

describe('CSV 변환 (build-venues)', () => {
  it('parseCsv: 따옴표 안의 쉼표, 줄바꿈(CRLF), 빈 줄', () => {
    expect(parseCsv('a,b\r\n1,"x, y"\r\n\r\n2,z\r\n')).toEqual([['a', 'b'], ['1', 'x, y'], ['2', 'z']])
  })
  it('splitName: 개관일·부가 표기 분리', () => {
    expect(splitName('제주도문예회관 대극장(1988-08-25)')).toEqual({ name: '제주도문예회관 대극장', open: '1988-08-25', note: '' })
    expect(splitName('제주해변공연장(1995-03-28) - 야외')).toMatchObject({ name: '제주해변공연장', note: '야외' })
    expect(splitName('라바 스테이지(2017-08-22) -야외').note).toBe('야외')
    expect(splitName('한라아트홀(대극장)(2001-09-11)').name).toBe('한라아트홀(대극장)')
    expect(splitName('제주 난타극장 (2017-01-10)').name).toBe('제주 난타극장')
    expect(splitName('이름만')).toEqual({ name: '이름만', open: '', note: '' })
  })
  it('splitName: 원본의 오탈자·깨진 글자 보정', () => {
    expect(splitName('에술극장(1996-07-01)').name).toBe('예술극장')
    expect(splitName('노형수퍼마�R(2005-03-24)').name).toBe('노형수퍼마켙')
  })
  it('cleanAddr: 띄어쓰기·오탈자 정리', () => {
    expect(cleanAddr('제주시오남로 231 (오라이동)')).toBe('제주시 오남로 231 (오라이동)')
    expect(cleanAddr('제주시 선독목동길 56-=26(오등동)')).toBe('제주시 선독목동길 56-26(오등동)')
    expect(cleanAddr('제주시 제주대학로 102((아라일동)')).toBe('제주시 제주대학로 102(아라일동)')
  })
  it('geoAddr: 괄호·쉼표 뒤를 떼고 시·도를 붙임', () => {
    expect(geoAddr('제주시 한라대학로 38(노형동, 한라대학교)')).toBe('제주특별자치도 제주시 한라대학로 38')
    expect(geoAddr('제주시 태성로 23, 105동 지001호(일도2동)')).toBe('제주특별자치도 제주시 태성로 23')
    expect(geoAddr('서귀포시 안덕면 신화역사로304번길 98')).toBe('제주특별자치도 서귀포시 안덕면 신화역사로304번길 98')
  })
  it('build: 컬럼이 다르면 에러, 정상 행은 객체로', () => {
    expect(() => build('a,b,c\n1,2,3')).toThrow('공연장명')
    const [v] = build('연번,공연장명(개관일자),소재지,시설구분,비 고,기준일자\n1,제주도문예회관 대극장(1988-08-25),제주시 동광로 69 (일도이동),공공,종합공연,2021-11-30')
    expect(v).toEqual({
      id: 'v1', name: '제주도문예회관 대극장', open: '1988-08-25', note: '', kind: '공공', type: '종합공연',
      addr: '제주시 동광로 69 (일도이동)', geoAddr: '제주특별자치도 제주시 동광로 69', lat: null, lng: null, base: '2021-11-30',
    })
  })
})

describe('생성된 데이터 (server/data/venues.js)', () => {
  it('34건, 이름 비어 있지 않음, 깨진 글자 없음, id 중복 없음', () => {
    expect(venues).toHaveLength(34)
    expect(venues.every((v) => v.name && v.addr)).toBe(true)
    expect(JSON.stringify(venues)).not.toContain('�')
    expect(new Set(venues.map((v) => v.id)).size).toBe(34)
  })
  it('시설구분은 공공/민간, 모두 제주시·서귀포시 주소', () => {
    expect(new Set(venues.map((v) => v.kind))).toEqual(new Set(['공공', '민간']))
    expect(venues.every((v) => /^(제주시|서귀포시) /.test(v.addr))).toBe(true)
  })
})

describe('server/venues', () => {
  it('목록: 기본 항목 모양(문화시설 14, 사진 없음, 좌표는 제주 안의 숫자), 쪽 나누기', () => {
    const p1 = searchVenues({ rows: 12, page: 1 }), p3 = searchVenues({ rows: 12, page: 3 })
    expect(p1).toHaveLength(12)
    expect(p3).toHaveLength(10)                                  // 34 = 12 + 12 + 10
    expect(searchVenues({ rows: 12, page: 4 })).toEqual([])
    expect(p1[0]).toMatchObject({ id: 'v1', title: '제주도문예회관 대극장', type: '14', image: '', kindName: '공공' })
    expect(p1[0].lat).toBeCloseTo(33.5044, 3)                    // 카카오 주소 검색으로 채운 좌표
    expect(p1[0].lng).toBeCloseTo(126.5352, 3)
  })
  it('좌표: 34곳 모두 제주 범위 안, 서귀포시 공연장은 제주시 공연장보다 대체로 남쪽, 상세에도 좌표가 실림', () => {
    for (const v of venues) {
      expect(v.lat).toBeGreaterThan(33.0); expect(v.lat).toBeLessThan(33.7)
      expect(v.lng).toBeGreaterThan(126.0); expect(v.lng).toBeLessThan(127.1)
    }
    const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length
    const jeju = venues.filter((v) => v.addr.startsWith('제주시')).map((v) => v.lat)
    const seogwipo = venues.filter((v) => v.addr.startsWith('서귀포시')).map((v) => v.lat)
    expect(avg(seogwipo)).toBeLessThan(avg(jeju))
    expect(getVenueDetail({ id: 'v25' })).toMatchObject({ lat: expect.any(Number), lng: expect.any(Number) })
  })
  it('검색어는 이름·주소에 포함 여부 (대소문자 무시)', () => {
    expect(searchVenues({ keyword: '서귀포예술의전당' }).map((v) => v.title)).toEqual(['서귀포예술의전당 대극장', '서귀포예술의전당 소극장'])
    expect(searchVenues({ keyword: 'tank' }).map((v) => v.title)).toEqual(['TANK 공연장'])
    expect(searchVenues({ keyword: '애월읍' }).length).toBeGreaterThan(2)   // 주소 검색
    expect(searchVenues({ keyword: '없는공연장' })).toEqual([])
  })
  it('상세: 소재지·시설구분·개관일·자료 기준일, 없는 항목은 뺌', () => {
    const d = getVenueDetail({ id: 'v3' })
    expect(d.title).toBe('제주해변공연장')
    const labels = d.info.map((r) => r.label)
    expect(labels).toEqual(['소재지', '시설구분', '공연 형태', '개관일', '자료 기준'])
    expect(d.info.find((r) => r.label === '시설구분').value).toBe('공공 · 야외')
    expect(d.info.at(-1).value).toContain('2021-11-30')
    expect(getVenueDetail({ id: 'v10' }).info.map((r) => r.label)).not.toContain('공연 형태')   // 비고가 빈 공연장
  })
  it('상세: 없는 id 는 에러', () => {
    expect(() => getVenueDetail({ id: 'zzz' })).toThrow('찾을 수 없어요')
    expect(() => getVenueDetail({})).toThrow('찾을 수 없어요')
  })
})

describe('api/venue', () => {
  const mkRes = () => { const r = {}; r.status = (c) => { r.code = c; return r }; r.json = (b) => { r.body = b; return r }; return r }
  it('목록·상세·rows 상한·404', async () => {
    const { default: h } = await import('../api/venue.js')
    let res = mkRes(); h({ query: { keyword: '아트' } }, res)
    expect(res.code).toBe(200); expect(res.body.length).toBeGreaterThan(2)
    res = mkRes(); h({ query: { rows: '999' } }, res)
    expect(res.body).toHaveLength(34)                               // 상한 50 → 전부
    res = mkRes(); h({ query: { id: 'v1' } }, res)
    expect(res.body.title).toBe('제주도문예회관 대극장')
    res = mkRes(); h({ query: { id: 'nope' } }, res)
    expect(res.code).toBe(404)
  })
})

describe('지오코딩 스크립트 (geocode-venues)', () => {
  it('pickCoord: x=경도·y=위도, 제주 밖 결과는 건너뜀', () => {
    expect(pickCoord({ documents: [{ x: '126.5', y: '33.5' }] })).toEqual({ lat: 33.5, lng: 126.5 })
    expect(pickCoord({ documents: [{ x: '127.0', y: '37.5' }, { x: '126.6', y: '33.4' }] })).toEqual({ lat: 33.4, lng: 126.6 })
    expect(pickCoord({ documents: [] })).toBeNull()
    expect(pickCoord({})).toBeNull()
  })
  const res = (json, ok = true, status = 200) => ({ ok, status, json: async () => json, text: async () => JSON.stringify(json) })
  it('주소 검색 성공이면 한 번만 호출, 인증 헤더 포함', async () => {
    const f = vi.fn(async () => res({ documents: [{ x: '126.5', y: '33.5' }] }))
    expect(await geocode({ geoAddr: '제주특별자치도 제주시 동광로 69', name: 'x' }, 'KEY', f)).toEqual({ lat: 33.5, lng: 126.5 })
    expect(f).toHaveBeenCalledTimes(1)
    expect(f.mock.calls[0][0]).toContain('address.json')
    expect(f.mock.calls[0][1].headers.Authorization).toBe('KakaoAK KEY')
  })
  it('주소로 못 찾으면 장소 검색으로 한 번 더, 둘 다 없으면 null', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(res({ documents: [] }))
      .mockResolvedValueOnce(res({ documents: [{ x: '126.7', y: '33.3' }] }))
    expect(await geocode({ geoAddr: 'a', name: '공연장' }, 'K', f)).toEqual({ lat: 33.3, lng: 126.7 })
    expect(f.mock.calls[1][0]).toContain('keyword.json')
    const none = vi.fn(async () => res({ documents: [] }))
    expect(await geocode({ geoAddr: 'a', name: 'b' }, 'K', none)).toBeNull()
  })
  it('인증 오류 등은 에러로 올림', async () => {
    const f = vi.fn(async () => res({ msg: 'unauthorized' }, false, 401))
    await expect(geocode({ geoAddr: 'a', name: 'b' }, 'bad', f)).rejects.toThrow('401')
  })
})

describe('분류·카드 표시', () => {
  it('공연장 배지·부제목', () => {
    expect(badgeOf({ kind: 'venue', kindName: '공공' })).toBe('공연장·공공')
    expect(badgeOf({ kind: 'venue' })).toBe('공연장')
    expect(subtitleOf({ kind: 'venue', addr: '제주시 동광로 69' })).toBe('제주시 동광로 69')
  })
  it('공연장은 문화시설과 전체에만 합쳐지고, 내 주변(좌표 필요)에는 없음', () => {
    expect(sourcesFor('culture').some((s) => s.api === 'venue')).toBe(true)
    expect(sourcesFor('all').some((s) => s.api === 'venue')).toBe(true)
    for (const c of ['spot', 'festival', 'food', 'cafe', 'near']) expect(sourcesFor(c).some((s) => s.api === 'venue')).toBe(false)
  })
})
