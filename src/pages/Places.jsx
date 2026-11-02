import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button, Col, Form, InputGroup, Row } from 'react-bootstrap'
import ItemCard from '../components/ItemCard'
import DetailModal from '../components/DetailModal'
import { CitrusMark } from '../components/JejuScene'
import OreumProgress from '../components/OreumProgress'
import { FORM_GROUPS } from '../lib/oreumForms'
import { Empty, ErrorAlert, Loading } from '../components/Status'
import { fetchHeritage, fetchHeritageDetail, fetchNearby, fetchPlaceDetail, fetchPlaces, fetchRestaurantDetail, fetchRestaurants, fetchOreum, fetchOreumById, fetchVenueDetail } from '../api/client'
import { TAG_RULES } from '../lib/placeTags'
import { CATEGORIES, DEFAULT_CAT, MENU_WORDS, NEAR_CATS, parseTags, toggleTag, RADII, advance, badgeOf, parseSub, recommendModeOf, sourcesFor, subsOf, toggleSub, subtitleOf } from '../lib/placeCategories'
import { isJejuCoord } from '../lib/geo'
import OreumArt from '../components/OreumArt'
import { formGroupOf } from '../lib/oreumForms'
import { useAppStore } from '../store/useAppStore'

const ROWS = 12   // 한 번에 가져오는 개수 (더 보기로 다음 쪽)
const CITY_HALL = { lat: 33.4996, lng: 126.5312 }   // 위치를 못 얻을 때 기준 (제주시청)
// 가볼만한 곳(저장된 행)에 붙이는 종류 배지
const SOURCE_LABEL = { tour: '관광·문화', heritage: '국가유산', venue: '공연장', rest: '일반음식점', oreum: '오름' }
const SORTS = [{ key: '', label: '이름순' }, { key: 'elev', label: '표고 높은 순' }, { key: 'elev_asc', label: '표고 낮은 순' }]   // 오름 정렬 (내 주변을 켜면 가까운 순)
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
  const canNear = NEAR_CATS.includes(cat)
  const radiusKm = canNear && RADII.includes(Number(params.get('r'))) ? Number(params.get('r')) : 0   // 0 = 내 주변을 안 씀(제주 전체)
  const nearOn = radiusKm > 0
  const tags = nearOn && cat !== 'oreum' ? [] : parseTags(cat, params.get('t'))   // 테마 태그 (오름 외에는 내 주변과 함께 쓰지 않음)
  const form = cat === 'oreum' && FORM_GROUPS.some((g) => g.key === params.get('fm')) ? params.get('fm') : ''   // 오름 형태 (원추형·원형·말굽형·복합형)
  const sort = cat === 'oreum' && ['elev', 'elev_asc'].includes(params.get('so')) ? params.get('so') : ''                                    // 오름 정렬

  const [keyword, setKeyword] = useState('')
  const listMode = cat === 'saved' || cat === 'visited'                  // 가볼만한 곳·가본 곳은 저장된 목록(스토어)을 보여줌
  const savedItems = (cat === 'visited' ? visits : favorites).filter((f) => !keyword.trim() || f.title.includes(keyword.trim()))   // 검색어가 있으면 제목으로 거름
  const [coords, setCoords] = useState(null)             // 내 주변 기준 좌표 { lat, lng, note? }
  const [locating, setLocating] = useState(false)
  const [items, setItems] = useState([])                 // ① 데이터
  const [loading, setLoading] = useState(true)           // ② 로딩
  const [error, setError] = useState('')                 // ③ 에러
  const [hasMore, setHasMore] = useState(false)
  const [moreLoading, setMoreLoading] = useState(false)
  const [detail, setDetail] = useState(null)             // 열린 상세: { base(목록 항목), data?, error? }
  const [trail, setTrail] = useState([])                 // 근처 추천을 타고 넘어온 이전 장소들 (돌아가기용)
  const detailReq = useRef(0)                            // 장소를 빠르게 넘길 때 늦게 온 이전 응답을 버리기 위한 번호
  const cursor = useRef({ i: 0, page: 1 })               // 분류의 소스 목록에서 어디까지 읽었는지
  const reqId = useRef(0)                                // 분류를 빠르게 바꿀 때 늦게 온 이전 응답을 버리기 위한 번호

  // 현재 위치 → 제주 안이면 그 좌표, 아니면(권한 거부·제주 밖·미지원) 제주시청 기준
  function locate() {
    setLocating(true)
    const fallback = (note) => { setCoords({ ...CITY_HALL, note }); setLocating(false) }
    if (!navigator.geolocation) return fallback('위치 기능을 쓸 수 없어 제주시청 기준이에요')
    navigator.geolocation.getCurrentPosition(
      ({ coords: c }) => {
        if (isJejuCoord(c.latitude, c.longitude)) { setCoords({ lat: c.latitude, lng: c.longitude }); setLocating(false) }
        else fallback('현재 위치가 제주 밖이라 제주시청 기준이에요')
      },
      () => fallback('위치 권한이 없어 제주시청 기준이에요'),
      { timeout: 8000 },
    )
  }
  useEffect(() => { if (nearOn && !coords && !locating) locate() }, [nearOn])

  // reset=true: 처음부터 다시 검색 / false: 다음 쪽을 이어 붙이기 (더 보기)
  async function load(reset, kw = keyword) {
    if (cat === 'saved' || cat === 'visited') { setLoading(false); setHasMore(false); return }   // 가볼만한 곳·가본 곳은 저장된 목록(스토어)이라 API 를 부르지 않음
    if (nearOn && !coords) return                // 위치를 얻은 뒤에 검색
    const sources = sourcesFor(cat, sub, nearOn, tags, { form, sort })
    const ctx = { keyword: kw, coords, radiusKm }
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
      setItems((prev) => (reset ? got : [...prev, ...got.filter((n) => !prev.some((p) => p.key === n.key))]))
      setHasMore(cur.i < sources.length)
    } catch (err) {
      if (id === reqId.current) setError(err.message)
    } finally {
      if (id === reqId.current) { setLoading(false); setMoreLoading(false) }
    }
  }
  // 분류·하위 선택·반경·기준 위치가 바뀌면 다시 검색 (처음 한 번 자동 검색 포함)
  useEffect(() => { load(true) }, [cat, sub, radiusKm, coords, tags.join(','), form, sort])

  // 인기 메뉴 바로가기: 누르면 그 단어로 바로 검색, 다시 누르면 해제
  function pickWord(w) {
    const next = keyword === w ? '' : w
    setKeyword(next)
    load(true, next)
  }
  function search(e) {
    e.preventDefault()                                   // 폼 제출 시 새로고침 막기
    load(true)
  }
  // 주소(?cat=&sub=&r=) 만들기: 반경(r)은 분류를 옮겨도 유지됨
  const urlOf = ({ c = cat, sb = sub, r = radiusKm, tg = tags, fm = form, so = sort }) => ({ ...(fm && c === 'oreum' && { fm }), ...(so && c === 'oreum' && { so }), ...(c !== DEFAULT_CAT && { cat: c }), ...(sb !== 'all' && { sub: sb }), ...(r > 0 && NEAR_CATS.includes(c) && { r: String(r) }), ...(tg.length > 0 && { t: tg.join(',') }) })
  const subOn = (key) => sub === key
  function pickCat(key) {
    if (Object.values(MENU_WORDS).flat().includes(keyword)) setKeyword('')   // 인기 메뉴로 넣은 검색어는 다른 분류로 가져가지 않음
    setParams(urlOf({ c: key, sb: 'all', tg: [], fm: '', so: '' }))
  }
  function pickForm(key) { setParams(urlOf({ fm: key === form ? '' : key })) }   // 켜진 형태를 다시 누르면 해제
  function pickSort(key) { setParams(urlOf({ so: key })) }
  function pickTag(key) { setParams(urlOf({ tg: toggleTag(tags, key) })) }
  function pickSub(key) { setParams(urlOf({ sb: toggleSub(cat, sub, key) })) }
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
        rows={[
          { label: '행정시', value: b.city }, { label: '표고', value: b.elev != null ? `${b.elev}m` : '' },
          { label: '비고(比高)', value: b.rel != null ? `${b.rel}m` : '' }, { label: '면적', value: b.area != null ? `${b.area.toLocaleString('ko-KR')}㎡` : '' },
          { label: '형태', value: b.form }, ...(d?.info ?? []),
        ].filter((r) => r.value)}
        homepage={d?.homepage} text={d?.overview}
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
          <Button key={c.key} className="rounded-pill px-3" variant={cat === c.key ? 'primary' : 'outline-primary'}
            aria-pressed={cat === c.key} onClick={() => pickCat(c.key)}>
            {c.key === 'saved' && <CitrusMark filled size={16} className="citrus-inline" />}
            {c.key === 'visited' && <i className="bi bi-check-circle-fill me-1" />}
            {c.label}
            {c.key === 'saved' && favorites.length > 0 && <span className="count-chip" data-testid="saved-count">{favorites.length}</span>}
            {c.key === 'visited' && visits.length > 0 && <span className="count-chip" data-testid="visited-count">{visits.length}</span>}
          </Button>
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
              <Button size="sm" variant="link" className="p-0" onClick={locate} disabled={locating}>내 위치 다시 찾기</Button>
            </>
          )}
        </div>
      )}
      {subs && (
        <div className="d-flex flex-wrap gap-2 mb-2 ps-1" role="group" aria-label="음식 종류">
          {subs.map((s) => (
            <Button key={s.key} size="sm" className="rounded-pill px-3" variant={subOn(s.key) ? 'info' : 'outline-info'}
              aria-pressed={subOn(s.key)} onClick={() => pickSub(s.key)}>{s.label}</Button>
          ))}
        </div>
      )}

      {cat === 'oreum' && (
        <div className="d-flex flex-wrap align-items-center gap-2 mb-2 ps-1 small" role="group" aria-label="오름 형태" data-testid="form-bar">
          <span className="text-muted"><i className="bi bi-hexagon me-1" />형태</span>
          {FORM_GROUPS.map((g) => (
            <Button key={g.key} size="sm" className="rounded-pill px-2" variant={form === g.key ? 'info' : 'outline-info'}
              aria-pressed={form === g.key} onClick={() => pickForm(g.key)}>{g.label}</Button>
          ))}
          {!nearOn && (
            <span className="ms-auto d-flex align-items-center gap-1" role="group" aria-label="정렬" data-testid="sort-bar">
              <span className="text-muted"><i className="bi bi-sort-down me-1" />정렬</span>
              {SORTS.map((o) => (
                <Button key={o.key} size="sm" variant="link" className={`p-0 me-1 ${sort === o.key ? 'fw-bold' : 'text-muted'}`} aria-pressed={sort === o.key} onClick={() => pickSort(o.key)}>{o.label}</Button>
              ))}
            </span>
          )}
        </div>
      )}

      {TAG_RULES[cat] && (!nearOn || cat === 'oreum') && (
        <div className="d-flex flex-wrap align-items-center gap-2 mb-2 ps-1 small" role="group" aria-label="테마" data-testid="tag-bar">
          <span className="text-muted"><i className="bi bi-tags me-1" />{cat === 'oreum' ? '소개글 특징(관광공사 등록 오름)' : '테마'}</span>
          {TAG_RULES[cat].map((t) => (
            <Button key={t.key} size="sm" className="rounded-pill px-2" variant={tags.includes(t.key) ? 'info' : 'outline-info'}
              aria-pressed={tags.includes(t.key)} onClick={() => pickTag(t.key)}>{t.label}</Button>
          ))}
          {tags.length > 0 && <Button size="sm" variant="link" className="p-0" onClick={() => setParams(urlOf({ tg: [] }))}>테마 해제</Button>}
        </div>
      )}

      {cat === 'visited' && <OreumProgress />}

      {listMode && (
        <div className="d-flex flex-wrap align-items-center gap-2 mb-2 ps-1 small" data-testid="saved-bar">
          <span className="text-muted">
            {cat === 'visited' ? `가본 곳 ${visits.length}곳 · 카드의 체크를 누르면 빠져요` : `가볼만한 곳 ${favorites.length}곳 · 카드의 감귤을 누르면 빠져요`}
          </span>
          <span className="ms-auto" data-testid="my-nickname">
            {nickname
              ? <><i className="bi bi-person-circle me-1" />{nickname}</>
              : <span className="text-muted">닉네임을 만들면 나만의 목록이 생겨요</span>}
            <Button size="sm" variant="link" className="py-0" onClick={() => askNickname()} data-testid="nickname-open">{nickname ? '바꾸기' : '닉네임 만들기'}</Button>
          </span>
        </div>
      )}

      {(!nearOn || cat === 'oreum') && (
        <Form onSubmit={search} className="mt-3 mb-4">
          <InputGroup>
            <Form.Control value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder={cat === 'saved' ? '가볼만한 곳에서 검색' : cat === 'visited' ? '가본 곳에서 검색' : cat === 'oreum' ? '오름 이름으로 검색 (예: 새별, 다랑쉬, 용눈이)' : cat === 'food' ? '가게 이름이나 음식 종류로 검색 (예: 흑돼지, 국수)' : cat === 'cafe' ? '가게 이름이나 메뉴로 검색 (예: 커피, 한라봉)' : '검색어'} />
            <Button type="submit"><i className="bi bi-search" /></Button>
          </InputGroup>
          {MENU_WORDS[cat] && (
            <div className="d-flex flex-wrap align-items-center gap-2 mt-2 ps-1 small" role="group" aria-label="인기 메뉴" data-testid="menu-words">
              <span className="text-muted">인기 메뉴</span>
              {MENU_WORDS[cat].map((w) => (
                <Button key={w} size="sm" className="rounded-pill px-2" variant={keyword === w ? 'info' : 'outline-info'}
                  aria-pressed={keyword === w} onClick={() => pickWord(w)}>{w}</Button>
              ))}
            </div>
          )}
        </Form>
      )}
      {nearOn && cat !== 'oreum' && <div className="mb-3" />}

      <ErrorAlert error={error} />

      {listMode ? (
        (cat === 'visited' ? visitLoading : favLoading) ? <Loading /> : savedItems.length === 0
          ? <Empty text={(cat === 'visited' ? visits : favorites).length ? '검색 결과가 없어요' : !nickname ? '닉네임을 만들면 나만의 목록이 생겨요' : cat === 'visited' ? '아직 가본 곳이 없어요 — 카드의 체크 버튼을 눌러 기록해 보세요' : '아직 담은 곳이 없어요 — 카드의 감귤 아이콘을 눌러 담아 보세요'} />
          : (
            <Row xs={1} sm={2} lg={3} className="g-3" data-testid={cat === 'visited' ? 'visited-list' : 'saved-list'}>
              {savedItems.map((f) => (
                <Col key={f.id}>
                  <ItemCard title={f.title} badge={SOURCE_LABEL[f.source] ?? f.source}
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
            <Row xs={1} sm={2} lg={3} className="g-3">
              {items.map((it) => (
                <Col key={it.key}>
                  <ItemCard
                    title={it.kind === 'heritage' ? it.name : it.title}
                    subtitle={subtitleOf(it)}
                    image={it.image} badge={badgeOf(it)}
                    tag={it.kind === 'oreum' && formGroupOf(it.form).key !== 'etc' ? { label: formGroupOf(it.form).label, tone: formGroupOf(it.form).key } : undefined}
                    art={it.kind === 'oreum' ? <OreumArt form={it.form} elev={it.elev} className="item-card-img w-100 d-block" /> : undefined}
                    onClick={() => openDetail(it)}
                    saved={isSaved(it)} onSave={() => toggleFavorite(favOf(it))}
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
        </>
      )}

      {modal}
    </>
  )
}
