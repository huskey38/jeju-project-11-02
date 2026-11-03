import { Fragment, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button, Col, Form, InputGroup, Row } from 'react-bootstrap'
import ItemCard from '../components/ItemCard'
import DetailModal from '../components/DetailModal'
import { CitrusMark } from '../components/JejuScene'
import OreumProgress from '../components/OreumProgress'
import { Empty, ErrorAlert, Loading } from '../components/Status'
import { fetchHeritage, fetchHeritageDetail, fetchNearby, fetchPlaceDetail, fetchPlaces, fetchRestaurantDetail, fetchRestaurants, fetchOreum, fetchOreumById, fetchVenueDetail } from '../api/client'
import { TAG_RULES } from '../lib/placeTags'
import { CATEGORIES, DEFAULT_CAT, NEAR_CATS, parseTags, toggleTag, RADII, advance, badgeOf, parseSub, recommendModeOf, sourcesFor, subsOf, toggleSub, subtitleOf } from '../lib/placeCategories'
import { isJejuCoord } from '../lib/geo'
import OreumArt from '../components/OreumArt'
import { FEATURES } from '../lib/features'
import VisitPhoto from '../components/VisitPhoto'
import OreumMark from '../components/OreumMark'
import Pager from '../components/Pager'
import { savedKey, useSavedPreviews } from '../lib/useSavedPreviews'
import { pageCount } from '../lib/paging'
import { formGroupOf } from '../lib/oreumForms'
import { useAppStore } from '../store/useAppStore'

const ROWS = 12   // 한 번에 가져오는 개수 (더 보기로 다음 쪽)
const CITY_HALL = { lat: 33.4996, lng: 126.5312 }   // 위치를 못 얻을 때 기준 (제주시청)
// 가볼만한 곳(저장된 행)에 붙이는 종류 배지
const SOURCE_LABEL = { tour: '관광·문화', heritage: '국가유산', venue: '공연장', rest: '일반음식점', oreum: '오름' }
const SORTS = [{ key: '', label: '추천순' }, { key: 'name', label: '이름순' }, { key: 'elev', label: '표고 높은 순' }, { key: 'elev_asc', label: '표고 낮은 순' }]   // 오름 정렬 ('' = 추천순이 기본, 내 주변을 켜면 가까운 순)
// 화면에서만 뺀 테마 칩(규칙·AI 가이드의 검색 조건은 그대로): 오름의 '분화구·굼부리'
const HIDDEN_TAGS = { oreum: ['crater'] }
const serverSort = (so) => (so === '' ? 'recommend' : so === 'name' ? '' : so)   // 화면의 정렬 키 → 서버 정렬 값
// 목록 항목 → 즐겨찾기 키 (favorites 테이블의 source·item_id 와 같은 규칙)
const favOf = (it) => it.kind === 'heritage' ? { source: 'heritage', id: it.name, title: it.name }
  : it.kind === 'venue' ? { source: 'venue', id: it.id, title: it.title }
  : it.kind === 'rest' ? { source: 'rest', id: it.id, title: it.title }
  // 오름: 관광공사에 등록된 곳은 예전 기록(관광공사 id)과 같은 키를 써서 기존 가본 곳·가볼만한 곳이 그대로 이어지고, 나머지는 공식 연번
  : it.kind === 'oreum' ? (it.tourId ? { source: 'tour', id: it.tourId, title: it.title } : { source: 'oreum', id: it.id, title: it.title })
  : { source: 'tour', id: it.id, title: it.title }
const valid = (list, v, fallback) => (list?.some((x) => x.key === v) ? v : fallback)

// 소스 하나(TourAPI·일반음식점·오름 색인·주변)의 한 쪽을 받아 화면용 항목으로 맞춤 — API 별 모양 차이는 여기서 흡수
// ctx: { keyword, coords, radiusKm }
async function fetchPage(src, ctx, page) {
  if (src.api === 'rest') {
    const list = await fetchRestaurants(ctx.keyword, src.biz, page, ROWS)
    return list.map((r) => ({ ...r, kind: 'rest', key: `r-${r.id}` }))
  }
  let list
  if (src.api === 'oreum') {
    const near = src.near && ctx.coords ? { lat: ctx.coords.lat, lng: ctx.coords.lng, radius: ctx.radiusKm * 1000 } : {}   // 내 위치 반경 안을 가까운 순으로
    if (ctx.unvisited) {   // 안 가 본 오름만: 같은 조건으로 전부 받아 가본 곳을 빼고 쪽을 직접 나눔
      const all = await fetchOreum({ keyword: ctx.keyword, form: src.form, tags: src.tags, sort: src.sort, ...near, page: 1, rows: 400 })
      const todo = all.filter((o) => { const f = favOf({ ...o, kind: 'oreum' }); return !ctx.visitedKeys.has(`${f.source}:${f.id}`) })
      return todo.slice((page - 1) * ROWS, page * ROWS).map((o) => ({ ...o, kind: 'oreum', key: `o-${o.id}` }))
    }
    const list = await fetchOreum({ keyword: ctx.keyword, form: src.form, tags: src.tags, sort: src.sort, ...near, page, rows: ROWS })
    return list.map((o) => ({ ...o, kind: 'oreum', key: `o-${o.id}` }))
  }
  if (src.api === 'near') {
    list = await fetchNearby({ ...ctx.coords, radius: ctx.radiusKm * 1000, type: src.type, lcls: src.lcls, xlcls: src.xlcls, page, rows: ROWS })
  } else {
    list = await fetchPlaces(ctx.keyword, src.type, page, ROWS, src.lcls)
  }
  return list.map((p) => ({ ...p, kind: 'tour', key: `t-${p.id}` }))
}

// 오름 정보 카드의 공식 보강 정보(관내 관광지데이터): 편의시설·주차·관리기관, 그리고 소개글을 쓰는 경우의 출처 (소개글은 관광공사 소개가 없을 때만 보여 줌)
const INTRO_SOURCE = '제주특별자치도 관내 관광지데이터(2025-12-31)'
const SUMMARY_SOURCE = '제주특별자치도 제주오름요약설명(2021-11-30)'
const oreumExtraRows = (b, usesIntro) => [
  ...(b.summary ? [{ label: '이름·특징', value: b.summary }, { label: '특징 출처', value: SUMMARY_SOURCE }] : []),
  { label: '편의시설', value: b.facilities?.join(', ') },
  { label: '주차', value: b.parking ? `${b.parking}대` : '' },
  { label: '관리', value: b.org ? `${b.org}${b.tel ? ` (${b.tel})` : ''}` : '' },
  ...(usesIntro && b.intro ? [{ label: '소개 출처', value: INTRO_SOURCE }] : []),
]

export default function Places() {
  const toggleFavorite = useAppStore((s) => s.toggleFavorite)   // 감귤 아이콘: 즐겨찾기 담기 ↔ 빼기
  const favorites = useAppStore((s) => s.favorites)
  const favLoading = useAppStore((s) => s.favLoading)
  const removeFavorite = useAppStore((s) => s.removeFavorite)
  const visits = useAppStore((s) => s.visits)
  const visitLoading = useAppStore((s) => s.visitLoading)
  const toggleVisit = useAppStore((s) => s.toggleVisit)
  const removeVisit = useAppStore((s) => s.removeVisit)
  const nickname = useAppStore((s) => s.nickname)
  const askNickname = useAppStore((s) => s.askNickname)
  const toast = useAppStore((s) => s.toast)
  const isVisited = (it) => { const f = favOf(it); return visits.some((x) => x.source === f.source && x.item_id === String(f.id)) }
  const isSaved = (it) => { const f = favOf(it); return favorites.some((x) => x.source === f.source && x.item_id === String(f.id)) }
  const [params, setParams] = useSearchParams()          // 선택한 분류를 주소(?cat=&sub=&r=)에 남김 → 새로고침·링크 공유 시 유지
  const cat = valid(CATEGORIES, params.get('cat'), DEFAULT_CAT)   // 기본은 오름
  const subs = subsOf(cat)
  const sub = parseSub(cat, params.get('sub'))   // 음식점 종류(하나)
  const canNear = NEAR_CATS.includes(cat) && cat !== 'oreum'   // '내 주변' 반경은 음식점·카페에서만 (오름 찾기에서는 뺌)
  const radiusKm = canNear && RADII.includes(Number(params.get('r'))) ? Number(params.get('r')) : 0   // 0 = 내 주변을 안 씀(제주 전체)
  const nearOn = radiusKm > 0
  // 오름 상세의 '근처 음식점·카페 더 보기'로 넘어오면 내 위치 대신 그 오름을 기준으로 가까운 순 (?ol=위도&og=경도&on=이름)
  const oLat = Number(params.get('ol')), oLng = Number(params.get('og'))
  const origin = (cat === 'food' || cat === 'cafe') && nearOn && params.get('ol') && isJejuCoord(oLat, oLng) ? { lat: oLat, lng: oLng, name: (params.get('on') || '').slice(0, 30) || '선택한 곳' } : null
  const tags = nearOn ? [] : parseTags(cat, params.get('t')).filter((t) => !HIDDEN_TAGS[cat]?.includes(t))   // 테마 태그 (내 주변과는 함께 쓰지 않음)   // 테마 태그 (오름 외에는 내 주변과 함께 쓰지 않음)
  const form = ''   // 형태 필터 칩은 없앰(카드의 형태 배지·소개 박스의 형태 카드로 대신함) — 주소의 ?fm= 도 쓰지 않음
  const sort = cat === 'oreum' && ['name', 'elev', 'elev_asc'].includes(params.get('so')) ? params.get('so') : ''                                    // 오름 정렬
  const unvisited = FEATURES.visitedFilter && cat === 'oreum' && params.get('nv') === '1'                                                    // 안 가 본 오름만

  const [keyword, setKeyword] = useState('')
  const listMode = cat === 'saved' || cat === 'visited'                  // 가볼만한 곳·가본 곳은 저장된 목록(스토어)을 보여줌
  const savedRows = cat === 'visited' ? visits : favorites
  const previews = useSavedPreviews(listMode ? savedRows : [])   // 가볼만한 곳·오른 오름 카드의 사진·형태·출처
  const savedItems = savedRows.filter((f) => !keyword.trim() || f.title.includes(keyword.trim()))   // 검색어가 있으면 제목으로 거름
  const originCoords = (o) => ({ lat: o.lat, lng: o.lng, note: `${o.name} 기준 · 가까운 순`, fromOrigin: true })
  const [coords, setCoords] = useState(origin ? originCoords(origin) : null)             // 내 주변 기준 좌표 { lat, lng, note? }
  const [locating, setLocating] = useState(false)
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
  const [detail, setDetail] = useState(null)             // 열린 상세: { base(목록 항목), data?, error? }
  const [trail, setTrail] = useState([])                 // 근처 추천을 타고 넘어온 이전 장소들 (돌아가기용)
  const detailReq = useRef(0)                            // 장소를 빠르게 넘길 때 늦게 온 이전 응답을 버리기 위한 번호
  const cursor = useRef({ i: 0, page: 1 })               // 분류의 소스 목록에서 어디까지 읽었는지
  const reqId = useRef(0)                                // 분류를 빠르게 바꿀 때 늦게 온 이전 응답을 버리기 위한 번호

  // 현재 위치 → 제주 안이면 그 좌표, 아니면(권한 거부·제주 밖·미지원) 제주시청 기준
  const originRef = useRef(origin)
  originRef.current = origin
  function locate(force = false) {   // force: '내 위치 기준으로 보기'처럼 오름 기준을 일부러 벗어날 때
    setLocating(true)
    const skip = () => !force && originRef.current   // 오름 기준으로 열린 화면에서는 늦게 도착한 내 위치가 기준을 덮어쓰지 않게 함
    const fallback = (note) => { if (!skip()) setCoords({ ...CITY_HALL, note }); setLocating(false) }
    if (!navigator.geolocation) return fallback('위치 기능을 쓸 수 없어 제주시청 기준이에요')
    navigator.geolocation.getCurrentPosition(
      ({ coords: c }) => {
        if (isJejuCoord(c.latitude, c.longitude)) { if (!skip()) setCoords({ lat: c.latitude, lng: c.longitude }); setLocating(false) }
        else fallback('현재 위치가 제주 밖이라 제주시청 기준이에요')
      },
      () => fallback('위치 권한이 없어 제주시청 기준이에요'),
      { timeout: 8000 },
    )
  }
  // 오름 기준으로 들어오면 그 좌표를 쓰고, 그 기준이 사라졌는데(다른 탭으로 감) 좌표가 오름 것이면 비워서 내 위치를 다시 찾음
  useEffect(() => {
    if (origin) setCoords(originCoords(origin))
    else setCoords((c) => (c?.fromOrigin ? null : c))
  }, [origin?.lat, origin?.lng, origin?.name])
  useEffect(() => { if (nearOn && !coords && !locating && !origin) locate() }, [nearOn, !!coords])

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

  function search(e) {
    e.preventDefault()                                   // 폼 제출 시 새로고침 막기
    load(true)
  }
  // 주소(?cat=&sub=&r=) 만들기: 반경(r)은 분류를 옮겨도 유지됨
  const urlOf = ({ c = cat, sb = sub, r = radiusKm, tg = tags, fm = form, so = sort, nv = unvisited, or = origin }) => ({ ...(or && r > 0 && (c === 'food' || c === 'cafe') && { ol: String(or.lat), og: String(or.lng), on: or.name }), ...(nv && c === 'oreum' && { nv: '1' }), ...(fm && c === 'oreum' && { fm }), ...(so && c === 'oreum' && { so }), ...(c !== DEFAULT_CAT && { cat: c }), ...(sb !== 'all' && { sub: sb }), ...(r > 0 && NEAR_CATS.includes(c) && c !== 'oreum' && { r: String(r) }), ...(tg.length > 0 && { t: tg.join(',') }) })
  // 음식점·카페 등: 번호로 한 쪽만 보는 중이면 그 쪽의 카드만
  const shownItems = cat !== 'oreum' && viewPage ? items.slice(viewPage > 1 ? pageEnds[viewPage - 2] : 0, pageEnds[viewPage - 1]) : items
  const jumpTop = () => setTimeout(() => document.querySelector('[data-testid=place-list]')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  const subOn = (key) => sub === key
  function pickCat(key) {
    setParams(urlOf({ c: key, sb: 'all', tg: [], fm: '', so: '', nv: false }))
  }
  function pickSort(key) { setParams(urlOf({ so: key })) }
  function pickUnvisited() { setParams(urlOf({ nv: !unvisited })) }
  function pickTag(key) { setParams(urlOf({ tg: toggleTag(tags, key) })) }
  function pickSub(key) { setParams(urlOf({ sb: toggleSub(cat, sub, key) })) }
  // 상세의 '근처 음식점·카페 더 보기': 그 오름을 기준으로 한 음식점·카페 탭(가까운 순)으로 이동
  function goNear(kind, km, at) {
    const r = RADII.includes(km) ? km : RADII.at(-1)
    closeDetail()
    setKeyword('')
    setParams(urlOf({ c: kind, sb: 'all', tg: [], fm: '', so: '', nv: false, r, or: { lat: at.lat, lng: at.lng, name: at.name } }))
    setTimeout(() => document.querySelector('[data-testid=home-places]')?.scrollIntoView({ behavior: 'smooth' }), 120)
  }
  function findMine() { setParams(urlOf({ or: null })); locate(true) }   // 오름 기준을 벗어나 내 위치 기준으로
  function pickRadius(km) { setParams(urlOf({ r: km === radiusKm ? 0 : km })) }   // 켜진 반경을 다시 누르면 해제

  // 카드 클릭 → 목록 정보를 먼저 보여주고 상세를 불러옴
  //   fromRec: "근처 추천"에서 넘어온 것 → 지금 보던 곳을 기록에 쌓아 "돌아가기"를 가능하게 함
  //   keepTrail: 돌아가기로 연 것 → 기록을 그대로 둠 (둘 다 아니면 새로 시작하므로 기록을 비움)
  async function openDetail(it, { fromRec = false, keepTrail = false } = {}) {
    const id = ++detailReq.current
    if (fromRec && detail) setTrail((t) => [...t, detail.base])
    else if (!keepTrail) setTrail([])
    setDetail({ base: it })
    try {
      const data = it.kind === 'heritage' ? await fetchHeritageDetail(it)
        : it.kind === 'venue' ? await fetchVenueDetail(it.id)
        : it.kind === 'rest' ? await fetchRestaurantDetail(it.id)
        : it.kind === 'oreum' ? (it.tourId ? await fetchPlaceDetail(it.tourId).catch(() => ({})) : {})   // 관광공사에 등록된 오름만 사진·소개글(실패해도 공식 정보는 보임)
        : await fetchPlaceDetail(it.id)
      if (id === detailReq.current) setDetail({ base: it, data })
    } catch (err) { if (id === detailReq.current) setDetail({ base: it, error: err.message }) }
  }
  // 가볼만한 곳(저장된 행)을 눌렀을 때: 저장된 건 source·id·제목뿐이라, 종류별로 상세를 열 수 있는 항목으로 되살림
  async function openSaved(f) {
    if (f.source === 'heritage') {   // 국가유산은 상세 조회에 지정번호가 필요해서 이름으로 다시 찾음
      try {
        const list = await fetchHeritage(f.title, 1, 5)
        const h = list.find((x) => x.name === f.title) ?? list[0]
        if (!h) return toast('국가유산 정보를 찾지 못했어요', 'warning')
        return openDetail({ ...h, kind: 'heritage', key: `h-${h.asno}`, kindName: h.kind })
      } catch (err) { return toast(err.message, 'danger') }
    }
    if (f.source === 'venue') return openDetail({ id: f.item_id, title: f.title, addr: '', kind: 'venue', key: `v-${f.item_id}` })
    if (f.source === 'rest') return openDetail({ id: f.item_id, title: f.title, addr: '', kind: 'rest', key: `r-${f.item_id}` })
    if (f.source === 'oreum') {   // 공식 연번으로 저장한 오름(관광공사에 없는 곳)
      try {
        const o = await fetchOreumById(f.item_id)
        return o ? openDetail({ ...o, kind: 'oreum', key: `o-${o.id}` }) : toast('오름 정보를 찾지 못했어요', 'warning')
      } catch (err) { return toast(err.message, 'danger') }
    }
    return openDetail({ id: f.item_id, title: f.title, kind: 'tour', key: `t-${f.item_id}` })
  }
  function closeDetail() { detailReq.current++; setDetail(null); setTrail([]) }
  function goBack() {
    const prev = trail.at(-1)
    if (!prev) return
    setTrail((t) => t.slice(0, -1))
    openDetail(prev, { keepTrail: true })
  }

  const modal = detail && (() => {
    const b = detail.base, d = detail.data
    const prev = trail.at(-1)
    // 관광·문화 계열이면 근처 음식점·카페, 음식점·카페면 근처 관광지를 추천 (공연장은 좌표가 없어 없음)
    const mode = recommendModeOf(d?.type ? { ...b, type: d.type } : b)   // 가볼만한 곳에서 연 항목은 종류를 상세에서 알게 됨
    const recommend = mode && {
      mode, excludeId: b.kind === 'tour' ? b.id : undefined,
      onPick: (p) => openDetail({ ...p, kind: 'tour', key: `t-${p.id}` }, { fromRec: true }),
      onMore: mode === 'spot' && Number.isFinite(Number(d?.lat ?? b.lat)) && Number.isFinite(Number(d?.lng ?? b.lng))
        ? (kind, km) => goNear(kind, km, { lat: Number(d?.lat ?? b.lat), lng: Number(d?.lng ?? b.lng), name: d?.name ?? b.name ?? b.title ?? '' })
        : undefined,
    }
    const common = {
      show: true, onHide: closeDetail, loading: !d && !detail.error, error: detail.error, badge: badgeOf({ ...b, type: d?.type ?? b.type }),
      recommend, onBack: prev ? goBack : undefined, backLabel: prev && (prev.title ?? prev.name),
      visited: isVisited(b), onVisit: () => toggleVisit(favOf(b)),
    }
    return b.kind === 'heritage' ? (
      <DetailModal {...common}
        title={d?.name ?? b.name} subtitle={d?.hanja} badge={d ? badgeOf({ ...b, kindName: d.kind }) : common.badge}
        images={d?.image ? [d.image] : []}
        rows={d?.info ?? [{ label: '지역', value: b.city }]} text={d?.content}
        lat={d?.lat ?? b.lat} lng={d?.lng ?? b.lng}
        saved={isSaved(b)} onSave={() => toggleFavorite(favOf(b))} />
    ) : b.kind === 'oreum' ? (
      <DetailModal {...common} badge={badgeOf(b)}
        title={b.title} subtitle={b.addr}
        images={d?.images?.length ? d.images : b.image ? [b.image] : []}
        extra={FEATURES.visitPhoto && isVisited(b) ? <VisitPhoto oreumId={b.id} /> : undefined}
        imageCredit={d?.images?.length ? '한국관광공사' : b.imageCredit}   // 상세 사진은 관광공사 TourAPI
        rows={[
          { label: '행정시', value: b.city }, { label: '표고', value: b.elev != null ? `${b.elev}m` : '' },
          { label: '면적', value: b.area != null ? `${b.area.toLocaleString('ko-KR')}㎡` : '' },
          { label: '형태', value: b.form }, ...(d?.info ?? []),
          ...oreumExtraRows(b, !d?.overview),
        ].filter((r) => r.value)}
        homepage={d?.homepage} text={d?.overview || b.intro}
        lat={b.lat} lng={b.lng}
        saved={isSaved(b)} onSave={() => toggleFavorite(favOf(b))} />
    ) : b.kind === 'rest' ? (
      <DetailModal {...common} badge={badgeOf({ ...b, biz: d?.biz ?? b.biz })}
        title={d?.title ?? b.title} subtitle={d?.addr ?? b.addr} rows={d?.info}
        lat={d?.lat ?? b.lat} lng={d?.lng ?? b.lng}
        saved={isSaved(b)} onSave={() => toggleFavorite(favOf(b))} />
    ) : b.kind === 'venue' ? (
      <DetailModal {...common}
        title={d?.title ?? b.title} subtitle={d?.addr ?? b.addr} rows={d?.info}
        lat={d?.lat ?? b.lat} lng={d?.lng ?? b.lng}
        saved={isSaved(b)} onSave={() => toggleFavorite(favOf(b))} />
    ) : (
      <DetailModal {...common}
        title={d?.title ?? b.title} subtitle={d?.addr ?? b.addr}
        images={d?.images?.length ? d.images : b.image ? [b.image] : []}
        rows={d?.info} homepage={d?.homepage} text={d?.overview}
        lat={d?.lat ?? b.lat} lng={d?.lng ?? b.lng} visitFrom={b.start}
        saved={isSaved(b)} onSave={() => toggleFavorite(favOf(b))} />
    )
  })()

  return (
    <>
      <div className="d-flex flex-wrap gap-2 mb-2" role="group" aria-label="분류">
        {CATEGORIES.map((c) => (
          <Fragment key={c.key}>
          {c.key === 'saved' && <span className="tab-group-label" data-testid="tab-group-label">내 기록 ▸</span>}
          <Button className="rounded-pill px-3" variant={cat === c.key ? 'primary' : 'outline-primary'}
            aria-pressed={cat === c.key} onClick={() => pickCat(c.key)}>
            {c.key === 'saved' && <CitrusMark filled size={16} className="citrus-inline" />}
            {c.key === 'visited' && <OreumMark filled size={17} className="me-1" style={{ verticalAlign: '-3px' }} />}
            {c.label}
            {c.key === 'saved' && favorites.length > 0 && <span className="count-chip" data-testid="saved-count">{favorites.length}</span>}
            {c.key === 'visited' && visits.length > 0 && <span className="count-chip" data-testid="visited-count">{visits.length}</span>}
          </Button>
          </Fragment>
        ))}
      </div>
      {canNear && (
        <div className="d-flex flex-wrap align-items-center gap-2 mb-2 ps-1 small" data-testid="near-bar">
          <span className="text-muted"><i className="bi bi-crosshair me-1" />내 주변</span>
          <div className="d-flex gap-1" role="group" aria-label="내 주변 반경">
            {RADII.map((km) => (
              <Button key={km} size="sm" className="rounded-pill px-2" variant={radiusKm === km ? 'info' : 'outline-info'}
                aria-pressed={radiusKm === km} onClick={() => pickRadius(km)}>{km}km</Button>
            ))}
          </div>
          {nearOn && (
            <>
              <span className="text-muted ms-2" data-testid="near-origin">
                <i className="bi bi-geo-alt me-1" />
                {locating ? '위치를 찾는 중...' : coords?.note ?? '내 현재 위치 기준 · 가까운 순'}
              </span>
              <Button size="sm" variant="link" className="p-0" onClick={findMine} disabled={locating}>{origin ? '내 위치 기준으로 보기' : '내 위치 다시 찾기'}</Button>
            </>
          )}
        </div>
      )}
      {(cat === 'food' || cat === 'cafe') && !nearOn && (
        <div className="small text-muted ps-1 mb-2" data-testid="food-link-note"><i className="bi bi-info-circle me-1" />제주 전체 {cat === 'food' ? '음식점이에요' : '카페예요'}. 오름 근처만 보려면 <strong>오름 카드를 열어 ‘근처 {cat === 'food' ? '음식점' : '카페'}’의 더 보기</strong>를 눌러 보세요.</div>
      )}
      {subs && (
        <div className="d-flex flex-wrap gap-2 mb-2 ps-1" role="group" aria-label="음식 종류">
          {subs.map((s) => (
            <Button key={s.key} size="sm" className="rounded-pill px-3" variant={subOn(s.key) ? 'info' : 'outline-info'}
              aria-pressed={subOn(s.key)} onClick={() => pickSub(s.key)}>{s.label}</Button>
          ))}
        </div>
      )}

      {TAG_RULES[cat] && !nearOn && (
        <div className="d-flex flex-wrap align-items-center gap-2 mb-2 ps-1 small" role="group" aria-label="테마" data-testid="tag-bar">
          <span className="text-muted"><i className="bi bi-tags me-1" />{cat === 'oreum' ? '소개글 특징(관광공사 등록 오름)' : '테마'}</span>
          {TAG_RULES[cat].filter((t) => !HIDDEN_TAGS[cat]?.includes(t.key)).map((t) => (
            <Button key={t.key} size="sm" className="rounded-pill px-2" variant={tags.includes(t.key) ? 'info' : 'outline-info'}
              aria-pressed={tags.includes(t.key)} onClick={() => pickTag(t.key)}>{t.label}</Button>
          ))}
          {tags.length > 0 && <Button size="sm" variant="link" className="p-0" onClick={() => setParams(urlOf({ tg: [] }))}>테마 해제</Button>}
        </div>
      )}


      {listMode && (
        <div className="d-flex flex-wrap align-items-center gap-2 mb-2 ps-1 small" data-testid="saved-bar">
          <span className="text-muted">
            {cat === 'visited' ? `오른 오름 ${visits.length}곳 · 카드의 오름 버튼을 누르면 빠져요` : `담아둔 곳 ${favorites.length}곳 · 카드의 감귤을 누르면 빠져요`}
          </span>
          <span className="ms-auto" data-testid="my-nickname">
            {nickname
              ? <><i className="bi bi-person-circle me-1" />{nickname}</>
              : <span className="text-muted">닉네임을 만들면 나만의 목록이 생겨요</span>}
            <Button size="sm" variant="link" className="py-0" onClick={() => askNickname()} data-testid="nickname-open">{nickname ? '바꾸기' : '닉네임 만들기'}</Button>
          </span>
        </div>
      )}

      {/* 오른 오름: 닉네임 줄이 탭 바로 밑에 있어 담아둔 곳과 같은 자리에서 보이고 바꿀 수 있음 (등반률 카드는 그 아래) */}
      {cat === 'visited' && <OreumProgress onOpenDetail={(o) => openDetail({ ...o, kind: 'oreum', key: `o-${o.id}` })} />}

      {(!nearOn || cat === 'oreum') && (
        <Form onSubmit={search} className={`mt-3 ${cat === 'oreum' ? 'mb-2' : 'mb-4'}`}>
          <InputGroup>
            <Form.Control value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder={cat === 'saved' ? '담아둔 곳에서 검색' : cat === 'visited' ? '오른 오름에서 검색' : cat === 'oreum' ? '오름 이름으로 검색 (예: 새별, 다랑쉬, 용눈이)' : cat === 'food' ? '가게 이름이나 음식 종류로 검색 (예: 흑돼지, 국수)' : cat === 'cafe' ? '가게 이름이나 메뉴로 검색 (예: 커피, 한라봉)' : '검색어'} />
            <Button type="submit"><i className="bi bi-search" /></Button>
          </InputGroup>
        </Form>
      )}
      {cat === 'oreum' && (
        <div className="mb-4">
          <div className="d-flex flex-wrap align-items-center gap-2 mb-1 ps-1 small" data-testid="form-bar">
          {!nearOn && (
            <span className="d-flex align-items-center gap-1" role="group" aria-label="정렬" data-testid="sort-bar">
              <span className="text-muted"><i className="bi bi-sort-down me-1" />정렬</span>
              {SORTS.map((o) => (
                <Button key={o.key} size="sm" variant="link" className={`p-0 me-1 ${sort === o.key ? 'fw-bold' : 'text-muted'}`} aria-pressed={sort === o.key} onClick={() => pickSort(o.key)}>{o.label}</Button>
              ))}
            </span>
          )}
          {cat === 'oreum' && FEATURES.visitedFilter && (
            <Button size="sm" className="rounded-pill px-2 ms-auto" variant={unvisited ? 'success' : 'outline-success'} aria-pressed={unvisited} onClick={pickUnvisited} data-testid="unvisited-toggle">
              <OreumMark size={15} className="me-1" style={{ verticalAlign: '-3px' }} />안 오른 오름만
            </Button>
          )}
          </div>
      {cat === 'oreum' && !nearOn && sort === '' && !keyword.trim() && (
        <div className="small text-muted ps-1 mb-0" data-testid="sort-note"><i className="bi bi-stars me-1" />추천순 — 널리 알려진 <strong>대표 오름 12곳</strong>이 먼저, 이어서 사진이 있고 <strong>가볍게 오를 수 있는(400m 이하)</strong> 오름 순이에요.</div>
      )}
        </div>
      )}
      {nearOn && cat !== 'oreum' && <div className="mb-3" />}

      <ErrorAlert error={error} />

      {listMode ? (
        (cat === 'visited' ? visitLoading : favLoading) ? <Loading /> : savedItems.length === 0
          ? <Empty text={(cat === 'visited' ? visits : favorites).length ? '검색 결과가 없어요' : !nickname ? '닉네임을 만들면 나만의 목록이 생겨요' : cat === 'visited' ? '아직 오른 오름이 없어요 — 오름 카드의 오름 버튼(올랐어요)을 눌러 기록해 보세요 — 둘레만 걸어도 괜찮아요' : '아직 담은 곳이 없어요 — 카드의 감귤 아이콘을 눌러 담아 보세요'} />
          : (
            <Row xs={1} sm={2} lg={3} className="g-3" data-testid={cat === 'visited' ? 'visited-list' : 'saved-list'}>
              {savedItems.map((f) => (
                <Col key={f.id}>
                  <ItemCard title={f.title} badge={previews[savedKey(f)]?.kind === 'oreum' ? badgeOf({ kind: 'oreum', form: previews[savedKey(f)].form }) : (SOURCE_LABEL[f.source] ?? f.source)}
                    image={previews[savedKey(f)]?.image || undefined} credit={previews[savedKey(f)]?.credit}
                    tag={previews[savedKey(f)]?.kind === 'oreum' && formGroupOf(previews[savedKey(f)].form).key !== 'etc' ? { label: formGroupOf(previews[savedKey(f)].form).label, tone: formGroupOf(previews[savedKey(f)].form).key } : undefined}
                    art={previews[savedKey(f)]?.kind === 'oreum' && !previews[savedKey(f)].image ? <OreumArt form={previews[savedKey(f)].form} elev={previews[savedKey(f)].elev} className="item-card-img w-100 d-block" /> : undefined}
                    subtitle={`${new Date(f.created_at).toLocaleDateString('ko-KR')}에 ${cat === 'visited' ? '기록' : '담음'}`}
                    onClick={() => openSaved(f)}
                    saved={cat === 'visited' ? favorites.some((x) => x.source === f.source && x.item_id === f.item_id) : true}
                    onSave={() => (cat === 'visited' ? toggleFavorite({ source: f.source, id: f.item_id, title: f.title }) : removeFavorite(f))}
                    visited={cat === 'visited' ? true : visits.some((x) => x.source === f.source && x.item_id === f.item_id)}
                    onVisit={() => (cat === 'visited' ? removeVisit(f) : toggleVisit({ source: f.source, id: f.item_id, title: f.title }))} />
                </Col>
              ))}
            </Row>
          )
      ) : (
        <>
          {loading ? <Loading /> : items.length === 0 ? <Empty /> : (
            <Row xs={1} sm={2} lg={3} className="g-3" data-testid={cat === 'oreum' ? 'oreum-list' : 'place-list'}>
              {shownItems.map((it) => (
                <Col key={it.key}>
                  <ItemCard
                    title={it.kind === 'heritage' ? it.name : it.title}
                    subtitle={subtitleOf(it)}
                    image={it.image} badge={badgeOf(it)}
                    tag={it.kind === 'oreum' && formGroupOf(it.form).key !== 'etc' ? { label: formGroupOf(it.form).label, tone: formGroupOf(it.form).key } : undefined}
                    art={it.kind === 'oreum' ? <OreumArt form={it.form} elev={it.elev} className="item-card-img w-100 d-block" /> : undefined}
                    onClick={() => openDetail(it)}
                    saved={isSaved(it)} onSave={() => toggleFavorite(favOf(it))}
                    credit={it.kind === 'oreum' ? it.imageCredit : undefined}
                    flag={FEATURES.visitedFilter && it.kind === 'oreum' && isVisited(it)}
                    visited={isVisited(it)} onVisit={cat === 'food' || cat === 'cafe' ? undefined : () => toggleVisit(favOf(it))} />
                </Col>
              ))}
            </Row>
          )}
          {!loading && hasMore && (
            <div className="text-center mt-4">
              <Button variant="outline-primary" onClick={() => load(false)} disabled={moreLoading}>
                {moreLoading ? '불러오는 중...' : '더 보기'}
              </Button>
            </div>
          )}
          {cat !== 'oreum' && !loading && pageEnds.length > 1 && (
            <div className="mt-3" data-testid="loaded-pager">
              <Pager page={viewPage ?? pageEnds.length} pages={pageEnds.length} onPage={(n) => { setViewPage(n); jumpTop() }} disabled={moreLoading} />
              <div className="text-center small text-muted mt-1">지금까지 {pageEnds.length}쪽 · {items.length}곳을 읽었어요{hasMore ? ' — 더 보기로 다음 쪽을 불러오면 번호가 늘어나요' : ''}</div>
            </div>
          )}
          {cat === 'oreum' && !loading && total > ROWS && (
            <div className="mt-3" data-testid="oreum-pager">
              <Pager page={pageNo} pages={pageCount(total, ROWS)} onPage={(n) => loadOreum(n)} disabled={moreLoading} />
              <div className="text-center small text-muted mt-1">{pageNo} / {pageCount(total, ROWS)}쪽 · 오름 {total}곳</div>
            </div>
          )}
        </>
      )}

      {modal}
    </>
  )
}
