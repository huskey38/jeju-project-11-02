import { beforeEach, describe, expect, it, vi } from 'vitest'
import { recommendModeOf } from '../src/lib/placeCategories.js'

// loadKakao 는 모듈 안에 "이미 불러오는 중" 상태를 들고 있어서, 테스트마다 모듈을 새로 불러옴
let K
beforeEach(async () => { vi.resetModules(); K = await import('../src/lib/kakao.js') })

// 가짜 DOM: script 를 붙이면 우리가 onload/onerror 를 직접 호출해 SDK 로드 결과를 흉내
const fakeEnv = () => {
  const scripts = []
  const doc = {
    createElement: () => { const s = { remove: vi.fn() }; scripts.push(s); return s },
    head: { appendChild: vi.fn() },
  }
  const win = {}
  return { doc, win, scripts }
}

describe('hasKakaoKey', () => {
  it('값이 있으면 true, 비었거나 공백·undefined 면 false', () => {
    expect(K.hasKakaoKey('abc123')).toBe(true)
    expect(K.hasKakaoKey('')).toBe(false)
    expect(K.hasKakaoKey('   ')).toBe(false)
    expect(K.hasKakaoKey(null)).toBe(false)
  })
  it('인자를 생략하면 .env 의 VITE_KAKAO_JS_KEY 를 따름 (값 자체는 검사하지 않음)', () => {
    expect(K.hasKakaoKey()).toBe(Boolean(String(import.meta.env.VITE_KAKAO_JS_KEY ?? '').trim()))
  })
})

describe('loadKakao', () => {
  it('키가 없으면 SDK 를 붙이지 않고 거절', async () => {
    const { doc, win } = fakeEnv()
    await expect(K.loadKakao({ key: '', doc, win })).rejects.toThrow('VITE_KAKAO_JS_KEY')
    expect(doc.head.appendChild).not.toHaveBeenCalled()
  })

  it('SDK 주소에 키(인코딩)와 autoload=false 를 넣고, kakao.maps.load 가 끝나면 kakao 를 돌려줌', async () => {
    const { doc, win, scripts } = fakeEnv()
    const p = K.loadKakao({ key: ' my key&x ', doc, win })
    const s = scripts[0]
    expect(s.src).toBe('https://dapi.kakao.com/v2/maps/sdk.js?appkey=my%20key%26x&autoload=false')
    expect(s.async).toBe(true)
    expect(doc.head.appendChild).toHaveBeenCalledWith(s)
    win.kakao = { maps: { load: (cb) => cb() } }
    s.onload()
    await expect(p).resolves.toBe(win.kakao)
  })

  it('동시에 여러 번 불러도 스크립트는 한 번만 붙임', async () => {
    const { doc, win, scripts } = fakeEnv()
    const a = K.loadKakao({ key: 'k', doc, win }), b = K.loadKakao({ key: 'k', doc, win })
    expect(a).toBe(b)
    expect(scripts).toHaveLength(1)
    win.kakao = { maps: { load: (cb) => cb() } }
    scripts[0].onload()
    await a
  })

  it('이미 준비돼 있으면(window.kakao.maps.LatLng) 바로 돌려줌', async () => {
    const { doc, win } = fakeEnv()
    win.kakao = { maps: { LatLng: class {} } }
    await expect(K.loadKakao({ key: 'k', doc, win })).resolves.toBe(win.kakao)
    expect(doc.head.appendChild).not.toHaveBeenCalled()
  })

  it('스크립트 로드 실패 시 안내 에러, script 를 치우고 다시 시도할 수 있음', async () => {
    const { doc, win, scripts } = fakeEnv()
    const p = K.loadKakao({ key: 'k', doc, win })
    scripts[0].onerror()
    await expect(p).rejects.toThrow('도메인 등록')
    expect(scripts[0].remove).toHaveBeenCalled()
    const again = K.loadKakao({ key: 'k', doc, win })      // 실패한 약속을 재사용하지 않음
    expect(scripts).toHaveLength(2)
    win.kakao = { maps: { load: (cb) => cb() } }
    scripts[1].onload()
    await expect(again).resolves.toBe(win.kakao)
  })

  it('스크립트는 로드됐지만 kakao.maps 가 없으면 에러', async () => {
    const { doc, win, scripts } = fakeEnv()
    const p = K.loadKakao({ key: 'k', doc, win })
    scripts[0].onload()
    await expect(p).rejects.toThrow('준비되지 않았어요')
  })
})

describe('kakaoLinks (카카오맵 바로가기)', () => {
  it('지도·길찾기·로드뷰 URL (이름은 인코딩, 좌표는 위도,경도 순)', () => {
    const l = K.kakaoLinks({ name: '제주해녀박물관', lat: '33.5235518611', lng: '126.8634366646' })
    const n = encodeURIComponent('제주해녀박물관')
    expect(l.map).toBe(`https://map.kakao.com/link/map/${n},33.5235518611,126.8634366646`)
    expect(l.to).toBe(`https://map.kakao.com/link/to/${n},33.5235518611,126.8634366646`)
    expect(l.roadview).toBe('https://map.kakao.com/link/roadview/33.5235518611,126.8634366646')
  })
  it('이름의 쉼표·슬래시는 URL 구분자와 섞이지 않게 공백으로, 이름이 없으면 "장소"', () => {
    expect(K.kakaoLinks({ name: 'A, B/C', lat: 33.5, lng: 126.5 }).map).toBe(`https://map.kakao.com/link/map/${encodeURIComponent('A B C')},33.5,126.5`)
    expect(K.kakaoLinks({ name: '', lat: 33.5, lng: 126.5 }).to).toContain(encodeURIComponent('장소'))
    expect(K.kakaoLinks({ lat: 33.5, lng: 126.5 }).to).toContain(encodeURIComponent('장소'))
  })
  it('좌표가 없거나 숫자가 아니면 null', () => {
    expect(K.kakaoLinks()).toBeNull()
    expect(K.kakaoLinks({ name: 'x', lat: '', lng: '' })).toBeNull()
    expect(K.kakaoLinks({ name: 'x', lat: null, lng: 126 })).toBeNull()
    expect(K.kakaoLinks({ name: 'x', lat: 'abc', lng: 126 })).toBeNull()
    expect(K.kakaoLinks({ name: 'x', lat: 33.5, lng: undefined })).toBeNull()
  })
})

describe('radiusEdges (반경 원이 다 보이게 하는 끝점)', () => {
  it('동서남북 4점, 1km ≈ 위도 0.009°, 경도는 위도에 맞게 더 넓음', () => {
    const e = K.radiusEdges(33.5, 126.5, 1000)
    expect(e).toHaveLength(4)
    const [n, s, ea, w] = e
    expect(n[0] - 33.5).toBeCloseTo(0.00898, 4); expect(33.5 - s[0]).toBeCloseTo(0.00898, 4)
    expect(ea[1] - 126.5).toBeCloseTo(0.01079, 4); expect(126.5 - w[1]).toBeCloseTo(0.01079, 4)
    expect(n[1]).toBe(126.5); expect(ea[0]).toBe(33.5)
  })
})

describe('공연장 근처 추천 (좌표가 채워진 뒤)', () => {
  it('공연장은 좌표가 있을 때만 spot(근처 음식점·카페), 없으면 추천 없음', () => {
    expect(recommendModeOf({ kind: 'venue', lat: 33.5, lng: 126.5 })).toBe('spot')
    expect(recommendModeOf({ kind: 'venue', lat: '33.5', lng: '126.5' })).toBe('spot')
    expect(recommendModeOf({ kind: 'venue', lat: '', lng: '' })).toBeNull()
    expect(recommendModeOf({ kind: 'venue' })).toBeNull()
  })
})
