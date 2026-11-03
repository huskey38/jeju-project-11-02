import { afterEach, describe, expect, it, vi } from 'vitest'
import { getTourPreview } from '../server/tour.js'
import { oreumOfSaved } from '../src/lib/useSavedPreviews.js'

vi.mock('../src/api/client.js', () => ({ fetchOreumAll: vi.fn(), fetchPlacePreview: vi.fn() }))

const oreums = [{ id: '1', name: '가마오름', tourId: '900', form: '말굽형' }, { id: '2', name: '가메오름', form: '복합형' }]

describe('oreumOfSaved — 저장된 행이 가리키는 공식 오름', () => {
  it('공식 연번(source oreum)·관광공사 id(source tour) 모두 찾고, 오름이 아니면 null', () => {
    expect(oreumOfSaved({ source: 'oreum', item_id: '2' }, oreums).name).toBe('가메오름')
    expect(oreumOfSaved({ source: 'tour', item_id: '900' }, oreums).name).toBe('가마오름')
    expect(oreumOfSaved({ source: 'tour', item_id: '123' }, oreums)).toBeNull()
    expect(oreumOfSaved({ source: 'rest', item_id: '1' }, oreums)).toBeNull()
    expect(oreumOfSaved({ source: 'oreum', item_id: '2' }, [])).toBeNull()
  })
})

describe('getTourPreview — 목록 카드용 대표 사진 한 장', () => {
  afterEach(() => vi.unstubAllGlobals())
  const stub = (item) => vi.stubGlobal('fetch', vi.fn(async () => ({ text: async () => JSON.stringify({ response: { body: { items: { item } } } }) })))

  it('detailCommon2 한 번만 부르고 제목·유형·대표 사진(https)을 돌려줌', async () => {
    process.env.DATA_GO_KR_KEY = 'k'
    stub({ contentid: '55', contenttypeid: '39', title: '가람돌솥밥', addr1: '제주시 복지로', firstimage: 'http://tong.visitkorea.or.kr/a.jpg' })
    const r = await getTourPreview({ id: '55' })
    expect(r).toEqual({ id: '55', type: '39', title: '가람돌솥밥', addr: '제주시 복지로', image: 'https://tong.visitkorea.or.kr/a.jpg' })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0][0]).toContain('detailCommon2')
  })
  it('id 가 없거나 숙박·없는 장소면 오류', async () => {
    await expect(getTourPreview({})).rejects.toThrow(/id/)
    stub({ contentid: '1', contenttypeid: '32', title: '호텔' })
    await expect(getTourPreview({ id: '1' })).rejects.toThrow(/찾을 수 없어요/)
  })
})
