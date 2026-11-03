import { useEffect, useRef, useState } from 'react'
import { fetchOreum } from '../api/client'
import { advance, sourcesFor } from '../lib/placeCategories'
import { pageCount } from '../lib/paging'
import { ROWS, favOf, fetchPage, serverSort } from '../lib/placeItems'

// 목록(오름·음식점·카페): 분류·조건이 바뀌면 다시 불러오고, 더 보기·쪽 이동을 처리 — Places 화면에서 분리했음
//   입력: cat·sub·nearOn·radiusKm·tags·form·sort·unvisited·coords(내 주변 기준)·keyword·visits
//   출력: 목록 상태(items·loading·error·hasMore·moreLoading·pageNo·total·pageEnds·viewPage)와 load(검색·더 보기)·loadOreum(쪽 이동)
export function usePlaceList({ cat, sub, nearOn, radiusKm, tags, form, sort, unvisited, coords, keyword, visits }) {
  const [items, setItems] = useState([])                 // ① 데이터
  const [loading, setLoading] = useState(true)           // ② 로딩
  const [error, setError] = useState('')                 // ③ 에러
  const [hasMore, setHasMore] = useState(false)
  const [moreLoading, setMoreLoading] = useState(false)
  const [pageNo, setPageNo] = useState(1)                 // 오름 탭: 지금 보는(마지막으로 읽은) 쪽
  const [total, setTotal] = useState(0)                   // 오름 탭: 조건에 맞는 오름 전체 수 (쪽 번호용)
  const [pageEnds, setPageEnds] = useState([])         // 음식점·카페 등: 쪽마다 '여기까지 읽음' 누적 개수 — 지금까지 읽은 쪽만 번호로 보여 줌
  const [viewPage, setViewPage] = useState(null)          // 음식점·카페 등: 번호를 눌러 한 쪽만 보는 중이면 그 쪽, null 이면 읽은 것 전부
  const itemsRef = useRef([])                              // 쪽 경계 계산용으로 최신 목록을 들고 있음
  const oreumAll = useRef({ key: '', list: [] })          // 오름 탭: 같은 조건이면 한 번 받은 전체 목록을 재사용 (쪽 이동이 즉시)
  const cursor = useRef({ i: 0, page: 1 })               // 분류의 소스 목록에서 어디까지 읽었는지
  const reqId = useRef(0)                                // 분류를 빠르게 바꿀 때 늦게 온 이전 응답을 버리기 위한 번호

  // 오름 탭: 조건에 맞는 오름을 한 번에 받아(최대 400) 쪽으로 나눔 → 1·2·3… 쪽 번호로 바로 이동하거나, 더 보기로 다음 쪽을 이어 붙임
  //   p: 보여 줄 쪽, append: 더 보기(이어 붙이기) 여부
  async function loadOreum(p, { append = false, kw = keyword } = {}) {
    const src = sourcesFor(cat, sub, nearOn, tags, { form, sort: serverSort(sort) })[0]
    const key = JSON.stringify([kw, form, tags, sort, nearOn ? [coords?.lat, coords?.lng, radiusKm] : 0])
    const id = append ? reqId.current : ++reqId.current
    append ? setMoreLoading(true) : setLoading(true)
    setError('')
    try {
      if (oreumAll.current.key !== key) {
        const near = src.near && coords ? { lat: coords.lat, lng: coords.lng, radius: radiusKm * 1000 } : {}
        const all = await fetchOreum({ keyword: kw, form: src.form, tags: src.tags, sort: src.sort, ...near, page: 1, rows: 400 })
        if (id !== reqId.current) return
        oreumAll.current = { key, list: all }
      }
      const visitedKeys = new Set(visits.map((v) => `${v.source}:${v.item_id}`))
      const list = unvisited ? oreumAll.current.list.filter((o) => { const f = favOf({ ...o, kind: 'oreum' }); return !visitedKeys.has(`${f.source}:${f.id}`) }) : oreumAll.current.list
      const pages = pageCount(list.length, ROWS)
      const page = Math.min(Math.max(1, p), pages)
      const got = list.slice((page - 1) * ROWS, page * ROWS).map((o) => ({ ...o, kind: 'oreum', key: `o-${o.id}` }))
      setItems((prev) => (append ? [...prev, ...got.filter((n) => !prev.some((x) => x.key === n.key))] : got))
      setPageNo(page); setTotal(list.length); setHasMore(page < pages); setPageEnds([]); setViewPage(null)
      if (!append && p > 1) document.querySelector('[data-testid=oreum-list]')?.scrollIntoView({ behavior: 'smooth', block: 'start' })   // 쪽을 옮기면 목록 맨 위로
    } catch (err) {
      if (id === reqId.current) setError(err.message)
    } finally {
      if (id === reqId.current) { setLoading(false); setMoreLoading(false) }
    }
  }

  // reset=true: 처음부터 다시 검색 / false: 다음 쪽을 이어 붙이기 (더 보기)
  async function load(reset, kw = keyword) {
    if (cat === 'saved' || cat === 'visited') { setLoading(false); setHasMore(false); return }   // 가볼만한 곳·가본 곳은 저장된 목록(스토어)이라 API 를 부르지 않음
    if (nearOn && !coords) return                // 위치를 얻은 뒤에 검색
    if (cat === 'oreum') return loadOreum(reset ? 1 : pageNo + 1, { append: !reset, kw })
    const sources = sourcesFor(cat, sub, nearOn, tags, { form, sort: serverSort(sort) })
    const ctx = { keyword: kw, coords, radiusKm, unvisited, visitedKeys: new Set(visits.map((v) => `${v.source}:${v.item_id}`)) }
    const id = reset ? ++reqId.current : reqId.current
    let cur = reset ? { i: 0, page: 1 } : cursor.current
    reset ? setLoading(true) : setMoreLoading(true)
    setError('')
    try {
      let got = []
      // 한 소스가 끝나면 다음 소스로 넘어가며, 한 번에 보여줄 개수(ROWS)가 찰 때까지 읽음
      while (cur.i < sources.length && got.length < ROWS) {
        const list = await fetchPage(sources[cur.i], ctx, cur.page)
        got = [...got, ...list.filter((x) => !x.dup)]   // 관광공사 음식점과 같은 가게(일반음식점 쪽 중복)는 뺌. 쪽 계산(advance)은 거르기 전 개수로
        cur = advance(cur, list.length, ROWS)
      }
      if (id !== reqId.current) return
      cursor.current = cur
      const base = reset ? [] : itemsRef.current
      const next = [...base, ...got.filter((n) => !base.some((p) => p.key === n.key))]
      itemsRef.current = next
      setItems(next)
      setPageEnds((prev) => (reset ? [next.length] : [...prev, next.length]))
      setViewPage(null)
      setHasMore(cur.i < sources.length)
    } catch (err) {
      if (id === reqId.current) setError(err.message)
    } finally {
      if (id === reqId.current) { setLoading(false); setMoreLoading(false) }
    }
  }

  // 분류·하위 선택·반경·기준 위치가 바뀌면 다시 검색 (처음 한 번 자동 검색 포함)
  useEffect(() => { load(true) }, [cat, sub, radiusKm, coords, tags.join(','), form, sort, unvisited])

  // 음식점·카페 등: 번호로 한 쪽만 보는 중이면 그 쪽의 카드만
  const shownItems = cat !== 'oreum' && viewPage ? items.slice(viewPage > 1 ? pageEnds[viewPage - 2] : 0, pageEnds[viewPage - 1]) : items

  return { items, shownItems, loading, error, hasMore, moreLoading, pageNo, total, pageEnds, viewPage, setViewPage, load, loadOreum }
}
