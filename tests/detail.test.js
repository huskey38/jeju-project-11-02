import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { extractUrl, fmtDate, htmlToText, https } from '../server/text.js'
import { getTourDetail } from '../server/tour.js'
import { getHeritageDetail, searchHeritage } from '../server/heritage.js'

// 호출 주소(operation)별로 다른 응답을 돌려주는 fetch 모의
const mockByOp = (map) => vi.fn(async (url) => {
  const key = Object.keys(map).find((k) => String(url).includes(k))
  return { text: async () => (typeof map[key] === 'string' ? map[key] : JSON.stringify(map[key])) }
})
const ok = (item) => ({ response: { header: { resultCode: '0000' }, body: { items: item === undefined ? '' : { item } } } })

beforeEach(() => { process.env.DATA_GO_KR_KEY = 'k' })
afterEach(() => vi.unstubAllGlobals())

describe('server/text', () => {
  it('htmlToText: <br> 은 줄바꿈, 태그·스크립트 제거, 엔티티 복원', () => {
    expect(htmlToText('a<br>b<br/>c')).toBe('a\nb\nc')
    expect(htmlToText('<p>x</p><script>alert(1)</script>')).not.toContain('<')
    expect(htmlToText('a&nbsp;b &amp; &lt;')).toBe('a b & <')
    expect(htmlToText(undefined)).toBe('')
  })
  it('extractUrl: 앵커·맨 주소에서 http(s) 주소만 추출, 위험한 주소는 거부', () => {
    expect(extractUrl('<a href="https://x.com/a"target="_blank">https://x.com/a</a>')).toBe('https://x.com/a')
    expect(extractUrl('http://www.jeju.go.kr/haenyeo/')).toBe('http://www.jeju.go.kr/haenyeo/')
    expect(extractUrl('www.delmoondo.com')).toBe('https://www.delmoondo.com')
    expect(extractUrl('<a href="javascript:alert(1)">x</a>')).toBe('')
    expect(extractUrl('')).toBe('')
  })
  it('fmtDate / https', () => {
    expect(fmtDate('20260404')).toBe('2026-04-04')
    expect(fmtDate('')).toBe('')
    expect(https('http://a/b.jpg')).toBe('https://a/b.jpg')
    expect(https('')).toBe('')
  })
})

describe('getTourDetail', () => {
  const common = { contentid: '130857', contenttypeid: '14', title: '제주해녀박물관', tel: '', homepage: '<a href="http://www.jeju.go.kr/haenyeo/">x</a>', firstimage: 'http://t/1.jpg', addr1: '제주 구좌읍', addr2: '', mapx: '126.86', mapy: '33.52', overview: '소개<br>글' }
  it('공통 + 유형별 이용정보 + 사진을 합쳐 정리 (문화시설)', async () => {
    const f = mockByOp({
      detailCommon2: ok([common]),
      detailIntro2: ok([{ usefee: '1,100원', usetimeculture: '09:00~18:00', restdateculture: '월요일', infocenterculture: '064-782-9898', parkingfee: '무료' }]),
      detailImage2: ok([{ originimgurl: 'http://t/1.jpg' }, { originimgurl: 'http://t/2.jpg' }]),
    })
    vi.stubGlobal('fetch', f)
    const d = await getTourDetail({ id: '130857' })
    expect(d).toMatchObject({ id: '130857', type: '14', title: '제주해녀박물관', homepage: 'http://www.jeju.go.kr/haenyeo/', lat: '33.52', lng: '126.86', overview: '소개\n글' })
    expect(d.images).toEqual(['https://t/1.jpg', 'https://t/2.jpg']) // https 변환 + 중복 제거
    expect(d.info.map((r) => r.label)).toEqual(['이용요금', '이용시간', '휴관일', '문의', '주차요금'])
    expect(f.mock.calls.map((c) => c[0]).find((u) => u.includes('detailIntro2'))).toContain('contentTypeId=14')
  })
  it('축제는 기간·전화를 앞에 넣음', async () => {
    vi.stubGlobal('fetch', mockByOp({
      detailCommon2: ok([{ ...common, contenttypeid: '15', tel: '064-1' }]),
      detailIntro2: ok([{ eventstartdate: '20260404', eventenddate: '20260405', playtime: '11:00', eventplace: '골체오름' }]),
      detailImage2: ok(undefined),
    }))
    const d = await getTourDetail({ id: '1' })
    expect(d.info.slice(0, 3)).toEqual([{ label: '전화', value: '064-1' }, { label: '기간', value: '2026-04-04 ~ 2026-04-05' }, { label: '장소', value: '골체오름' }])
  })
  it('소개·사진 호출이 실패해도 기본 정보는 반환', async () => {
    const f = vi.fn(async (url) => {
      if (String(url).includes('detailCommon2')) return { text: async () => JSON.stringify(ok([common])) }
      return { text: async () => '<error>x</error>' }
    })
    vi.stubGlobal('fetch', f)
    const d = await getTourDetail({ id: '1' })
    expect(d.title).toBe('제주해녀박물관')
    expect(d.info).toEqual([])
    expect(d.images).toEqual(['https://t/1.jpg'])
  })
  it('id 없음 / 장소 없음 → 에러', async () => {
    await expect(getTourDetail({})).rejects.toThrow('id')
    vi.stubGlobal('fetch', mockByOp({ detailCommon2: ok(undefined) }))
    await expect(getTourDetail({ id: '9' })).rejects.toThrow('찾을 수 없어요')
  })
})

describe('heritage 상세', () => {
  const list = '<result><item><ccbaMnm1>제주 관덕정</ccbaMnm1><ccmaName>보물</ccmaName><ccsiName>제주시</ccsiName><ccbaKdcd>12</ccbaKdcd><ccbaCtcd>50</ccbaCtcd><ccbaAsno>0003220000000</ccbaAsno><latitude>33.51</latitude><longitude>126.52</longitude></item></result>'
  const detail = '<result><latitude>33.51</latitude><longitude>126.52</longitude><item><ccbaMnm1>제주 관덕정</ccbaMnm1><ccbaMnm2>濟州 觀德亭</ccbaMnm2><ccmaName>보물</ccmaName><gcodeName>유적건조물</gcodeName><ccbaQuan>1동</ccbaQuan><ccbaAsdt>19630121</ccbaAsdt><ccbaLcad> 제주 제주시 관덕로 19 </ccbaLcad><ccceName>조선시대 후기</ccceName><imageUrl>http://www.khs.go.kr/a.jpg</imageUrl><content>설명&lt;br&gt;끝</content></item></result>'
  it('목록에 상세용 코드가 포함되고 지정번호 앞자리 0 이 유지됨', async () => {
    vi.stubGlobal('fetch', mockByOp({ SearchKindOpenapiList: list }))
    const [h] = await searchHeritage({ keyword: '관덕정' })
    expect(h).toMatchObject({ name: '제주 관덕정', lat: 33.51, lng: 126.52, kdcd: '12', ctcd: '50', asno: '0003220000000' })
  })
  it('상세: 설명·사진(https)·지정일·소재지', async () => {
    const f = mockByOp({ SearchKindOpenapiDt: detail })
    vi.stubGlobal('fetch', f)
    const d = await getHeritageDetail({ kdcd: '12', asno: '0003220000000', ctcd: '50' })
    expect(f.mock.calls[0][0]).toContain('ccbaAsno=0003220000000')
    expect(d).toMatchObject({ name: '제주 관덕정', hanja: '濟州 觀德亭', kind: '보물', image: 'https://www.khs.go.kr/a.jpg', content: '설명\n끝', lat: 33.51 })
    expect(d.info).toEqual(expect.arrayContaining([{ label: '지정일', value: '1963-01-21' }, { label: '소재지', value: '제주 제주시 관덕로 19' }]))
  })
  it('코드 누락 / 결과 없음 → 에러', async () => {
    await expect(getHeritageDetail({ asno: '1' })).rejects.toThrow('필요')
    vi.stubGlobal('fetch', mockByOp({ SearchKindOpenapiDt: '<result></result>' }))
    await expect(getHeritageDetail({ kdcd: '1', asno: '1', ctcd: '50' })).rejects.toThrow('찾을 수 없어요')
  })
})
