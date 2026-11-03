import { describe, expect, it, vi } from 'vitest'
import data from '../server/data/oreum.js'
import { oreumInfo, searchOreum } from '../server/oreum.js'
import { ALL_FORMS, FORM_DESC, FORM_GROUPS, formGroupOf, matchesForm, pickRep } from '../src/lib/oreumForms.js'
import { isJejuCoord } from '../src/lib/geo.js'
import { oreumIdOf, oreumProgress } from '../src/lib/oreumProgress.js'

vi.mock('../server/tour.js', () => ({ searchNearby: vi.fn(), searchFestivals: vi.fn(), searchTour: vi.fn(), getTourDetail: vi.fn() }))
const mkRes = () => { const r = {}; r.status = (c) => { r.code = c; return r }; r.json = (b) => { r.body = b; return r }; return r }

describe('제주 오름 현황 데이터 (scripts/build-oreum.mjs 결과)', () => {
  it('공식 368곳, 모두 제주 안의 좌표, 연번은 겹치지 않음, 관광공사와 연결된 곳은 tourId 가 겹치지 않음', () => {
    expect(data.items).toHaveLength(368)
    expect(data.baseDate).toBe('2025-12-31')
    expect(data.items.every((o) => isJejuCoord(o.lat, o.lng))).toBe(true)
    expect(new Set(data.items.map((o) => o.id)).size).toBe(368)
    const tour = data.items.filter((o) => o.tourId)
    expect(tour.length).toBeGreaterThan(60)
    expect(new Set(tour.map((o) => o.tourId)).size).toBe(tour.length)
    expect(oreumInfo()).toMatchObject({ count: 368, withCoords: 368 })
  })
  it('항목: 이름·행정시·소재지·표고·형태', () => {
    const o = data.items.find((x) => x.name === '가마오름')
    expect(o).toMatchObject({ city: '제주시', elev: 140.5, form: '말굽형(북동향)' })
    expect(o.addr).toContain('청수리')
    expect(data.items.some((x) => x.elev > 1500)).toBe(true)
  })
})

describe('server/oreum — searchOreum', () => {
  it('기본은 공식 순서 그대로, 쪽·rows 로 자름', () => {
    const all = searchOreum({ rows: 400 })
    expect(all).toHaveLength(368)
    expect(all[0].id).toBe('1')
    expect(searchOreum({ rows: 5, page: 2 }).map((o) => o.id)).toEqual(all.slice(5, 10).map((o) => o.id))
    expect(all[0]).toMatchObject({ title: '가마오름', name: '가마오름', form: '말굽형(북동향)', city: '제주시' })
  })
  it('이름 검색', () => {
    const r = searchOreum({ keyword: '새별', rows: 50 })
    expect(r.length).toBeGreaterThan(0)
    expect(r.every((o) => o.name.includes('새별'))).toBe(true)
    expect(searchOreum({ keyword: '없는이름xyz' })).toEqual([])
  })
  it('형태 묶음: 묶음끼리 겹치지 않고 합이 368', () => {
    const counts = ALL_FORMS.map((g) => searchOreum({ form: g.key, rows: 400 }).length)
    expect(counts.reduce((a, b) => a + b, 0)).toBe(368)
    expect(searchOreum({ form: 'horseshoe', rows: 400 }).every((o) => o.form.startsWith('말굽'))).toBe(true)
    expect(searchOreum({ form: 'cone', rows: 400 }).every((o) => o.form.startsWith('원추'))).toBe(true)
  })
  it('표고 높은 순 정렬', () => {
    const r = searchOreum({ sort: 'elev', rows: 400 })
    const el = r.map((o) => o.elev)
    expect(el).toEqual([...el].sort((a, b) => b - a))
    expect(r[0].elev).toBeGreaterThan(1700)
  })
  it('표고 낮은 순 정렬', () => {
    const r = searchOreum({ sort: 'elev_asc', rows: 400 })
    const el = r.map((o) => o.elev)
    expect(el.slice(0, -1).every((v, i) => (v ?? Infinity) <= (el[i + 1] ?? Infinity))).toBe(true)
    expect(r[0].elev).toBeLessThan(r.at(-1).elev ?? Infinity)
  })
  it('내 위치 반경 안을 가까운 순으로 (dist), 반경 밖은 제외, 위치가 없으면 dist 없음', () => {
    const near = searchOreum({ lat: 33.4996, lng: 126.5312, radius: 8000, rows: 400 })
    expect(near.length).toBeGreaterThan(3)
    expect(near.every((o) => o.dist <= 8000)).toBe(true)
    expect(near.map((o) => o.dist)).toEqual([...near.map((o) => o.dist)].sort((a, b) => a - b))
    expect(searchOreum({ lat: 33.4996, lng: 126.5312, radius: 1 })).toEqual([])
    expect(searchOreum({ rows: 1 })[0].dist).toBeUndefined()
  })
  it('소개글 특징 태그는 관광공사에 등록된(tourId 있는) 오름에만', () => {
    const r = searchOreum({ tags: ['sunrise'], rows: 400 })
    expect(r.length).toBeGreaterThan(0)
    expect(r.every((o) => o.tourId)).toBe(true)
    expect(searchOreum({ tags: ['sunrise', 'grass', 'family'], rows: 400 }).length).toBeLessThanOrEqual(r.length)
  })
  it('id 로 한 곳, 없으면 빈 배열', () => {
    expect(searchOreum({ id: '1' })[0].name).toBe('가마오름')
    expect(searchOreum({ id: 'nope' })).toEqual([])
  })
})

describe('api/oreum', () => {
  it('쿼리를 조회로 전달하고 rows 는 400 까지, 잘못된 형태 값은 무시', async () => {
    const { default: h } = await import('../api/oreum.js')
    const res = mkRes(); await h({ query: { keyword: '새별', form: 'horseshoe', tags: 'sunrise,BAD', sort: 'elev', page: '1', rows: '9999' } }, res)
    expect(res.code).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    const all = mkRes(); await h({ query: { rows: '9999' } }, all)
    expect(all.body).toHaveLength(368)
    const bad = mkRes(); await h({ query: { form: 'x&y', rows: '3' } }, bad)
    expect(bad.body).toHaveLength(3)
    const one = mkRes(); await h({ query: { id: '2' } }, one)
    expect(one.body[0].name).toBe('가메오름')
    const asc = mkRes(); await h({ query: { sort: 'elev_asc', rows: '2' } }, asc)
    expect(asc.body[0].elev).toBeLessThanOrEqual(asc.body[1].elev)
    const near = mkRes(); await h({ query: { lat: '33.5', lng: '126.5', radius: '5000', rows: '5' } }, near)
    expect(near.body.every((o) => o.dist <= 5000)).toBe(true)
  })
})

describe('형태 묶음 (src/lib/oreumForms.js)', () => {
  it('방향이 붙은 원본 값을 큰 종류로 묶음', () => {
    expect(formGroupOf('말굽형(북동향)').key).toBe('horseshoe')
    expect(formGroupOf('원추형').key).toBe('cone')
    expect(formGroupOf('원형').key).toBe('round')
    expect(formGroupOf('복합형').key).toBe('mixed')
    expect(formGroupOf('이상한것').key).toBe('etc')
    expect(matchesForm('말굽형(서향)', 'horseshoe')).toBe(true)
    expect(matchesForm('말굽형(서향)', 'cone')).toBe(false)
    expect(matchesForm('아무거나', '')).toBe(true)
    expect(FORM_GROUPS.map((g) => g.label)).toEqual(['원추형', '원형', '말굽형', '복합형'])
  })
})

describe('등반률: 관광공사 id 로 남긴 예전 기록과 공식 연번 기록을 같은 오름으로', () => {
  const list = [{ id: '1', tourId: '1884191' }, { id: '2' }, { id: '3', tourId: '777' }]
  it('source tour(관광공사 id) · source oreum(공식 연번) 모두 센다', () => {
    expect(oreumIdOf({ source: 'tour', item_id: '1884191' }, list)).toBe('1')
    expect(oreumIdOf({ source: 'oreum', item_id: '2' }, list)).toBe('2')
    expect(oreumIdOf({ source: 'oreum', item_id: 999 }, list)).toBeNull()
    expect(oreumIdOf({ source: 'tour', item_id: '2' }, list)).toBeNull()      // 관광공사 id 가 아닌 번호는 오름이 아님
    expect(oreumIdOf({ source: 'rest', item_id: '1' }, list)).toBeNull()
    const p = oreumProgress([{ source: 'tour', item_id: '1884191' }, { source: 'oreum', item_id: '1' }, { source: 'oreum', item_id: '2' }], list)
    expect(p.count).toBe(2)                                                       // 같은 오름(1)을 두 방식으로 기록해도 한 번만
    expect([...p.visitedIds].sort()).toEqual(['1', '2'])
  })
})

describe('형태 말풍선의 대표 오름 (pickRep)', () => {
  it('네 형태 모두 설명이 있고, 대표 오름은 그 형태에 속함 (정해 둔 오름이 있으면 그 오름)', () => {
    expect(Object.keys(FORM_DESC).sort()).toEqual(FORM_GROUPS.map((g) => g.key).sort())
    const list = data.items
    expect(pickRep(list, 'cone').name).toBe('도두봉')
    expect(pickRep(list, 'round').name).toBe('아부오름')
    expect(pickRep(list, 'horseshoe').name).toBe('원당봉')
    expect(pickRep(list, 'mixed').name).toBe('용눈이오름')
    for (const g of FORM_GROUPS) expect(formGroupOf(pickRep(list, g.key).form).key).toBe(g.key)
  })
  it('정해 둔 오름이 없으면 그 형태에서 가장 높은 오름, 형태에 속한 오름이 없으면 null', () => {
    const mini = [{ name: 'A', form: '원추형', elev: 100 }, { name: 'B', form: '원추형', elev: 300 }]
    expect(pickRep(mini, 'cone').name).toBe('B')
    expect(pickRep(mini, 'round')).toBeNull()
    expect(pickRep([], 'cone')).toBeNull()
  })
})

