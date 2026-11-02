import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button, Col, Form, InputGroup, Row } from 'react-bootstrap'
import PageHeader from '../components/PageHeader'
import ItemCard from '../components/ItemCard'
import DetailModal from '../components/DetailModal'
import { Empty, ErrorAlert, Loading } from '../components/Status'
import { fetchFestivals, fetchHeritage, fetchHeritageDetail, fetchNearby, fetchPlaceDetail, fetchPlaces, fetchVenueDetail, fetchVenues } from '../api/client'
import { CATEGORIES, DEFAULT_RADIUS, RADII, advance, badgeOf, festivalStatus, sourcesFor, subsOf, subtitleOf, todayKst } from '../lib/placeCategories'
import { isJejuCoord } from '../lib/geo'
import { useAppStore } from '../store/useAppStore'

const ROWS = 12   // 한 번에 가져오는 개수 (더 보기로 다음 쪽)
const CITY_HALL = { lat: 33.4996, lng: 126.5312 }   // 위치를 못 얻을 때 기준 (제주시청)
// 목록 항목 → 즐겨찾기 키 (favorites 테이블의 source·item_id 와 같은 규칙)
const favOf = (it) => it.kind === 'heritage' ? { source: 'heritage', id: it.name, title: it.name }
  : it.kind === 'venue' ? { source: 'venue', id: it.id, title: it.title }
  : { source: 'tour', id: it.id, title: it.title }
const valid = (list, v, fallback) => (list?.some((x) => x.key === v) ? v : fallback)

// 소스 하나(TourAPI·국가유산·주변·축제)의 한 쪽을 받아 화면용 항목으로 맞춤 — API 별 모양 차이는 여기서 흡수
// ctx: { keyword, coords, radiusKm, from, to }
async function fetchPage(src, ctx, page) {
  if (src.api === 'heritage') {
    const list = await fetchHeritage(ctx.keyword, page, ROWS)
    return list.map((h) => ({ ...h, kind: 'heritage', key: `h-${h.asno}`, kindName: h.kind }))
  }
  if (src.api === 'venue') {
    const list = await fetchVenues(ctx.keyword, page, ROWS)
    return list.map((v) => ({ ...v, kind: 'venue', key: `v-${v.id}` }))
  }
  let list
  if (src.api === 'near') {
    list = await fetchNearby({ ...ctx.coords, radius: ctx.radiusKm * 1000, type: src.type, lcls: src.lcls, xlcls: src.xlcls, page, rows: ROWS })
  } else if (src.api === 'festival') {
    list = await fetchFestivals({ from: ctx.from, to: ctx.to, keyword: ctx.keyword, page, rows: ROWS })
  } else {
    list = await fetchPlaces(ctx.keyword, src.type, page, ROWS, src.lcls)
  }
  return list.map((p) => ({ ...p, kind: 'tour', key: `t-${p.id}` }))
}

export default function Places() {
  const toggleFavorite = useAppStore((s) => s.toggleFavorite)   // 감귤 아이콘: 즐겨찾기 담기 ↔ 빼기
  const favorites = useAppStore((s) => s.favorites)
  const isSaved = (it) => { const f = favOf(it); return favorites.some((x) => x.source === f.source && x.item_id === String(f.id)) }
  const [params, setParams] = useSearchParams()          // 선택한 분류를 주소(?cat=&sub=&r=)에 남김 → 새로고침·링크 공유 시 유지
  const cat = valid(CATEGORIES, params.get('cat'), 'all')
  const subs = subsOf(cat)
  const sub = valid(subs, params.get('sub'), 'all')
  const radiusKm = RADII.includes(Number(params.get('r'))) ? Number(params.get('r')) : DEFAULT_RADIUS

  const [keyword, setKeyword] = useState('')
  const [from, setFrom] = useState(todayKst)             // 축제 기간 (기본: 오늘부터)
  const [to, setTo] = useState('')
  const [coords, setCoords] = useState(null)             // 내 주변 기준 좌표 { lat, lng, note? }
  const [locating, setLocating] = useState(false)
  const [items, setItems] = useState([])                 // ① 데이터
  const [loading, setLoading] = useState(true)           // ② 로딩
  const [error, setError] = useState('')                 // ③ 에러
  const [hasMore, setHasMore] = useState(false)
  const [moreLoading, setMoreLoading] = useState(false)
  const [detail, setDetail] = useState(null)             // 열린 상세: { base(목록 항목), data?, error? }
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
  useEffect(() => { if (cat === 'near' && !coords && !locating) locate() }, [cat])

  // reset=true: 처음부터 다시 검색 / false: 다음 쪽을 이어 붙이기 (더 보기)
  async function load(reset) {
    if (cat === 'near' && !coords) return                // 위치를 얻은 뒤에 검색
    const sources = sourcesFor(cat, sub)
    const ctx = { keyword, coords, radiusKm, from, to }
    const id = reset ? ++reqId.current : reqId.current
    let cur = reset ? { i: 0, page: 1 } : cursor.current
    reset ? setLoading(true) : setMoreLoading(true)
    setError('')
    try {
      let got = []
      // 한 소스가 끝나면 다음 소스로 넘어가며, 한 번에 보여줄 개수(ROWS)가 찰 때까지 읽음
      while (cur.i < sources.length && got.length < ROWS) {
        const list = await fetchPage(sources[cur.i], ctx, cur.page)
        got = [...got, ...list]
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
  // 분류·하위 선택·반경·기준 위치·축제 기간이 바뀌면 다시 검색 (처음 한 번 자동 검색 포함)
  useEffect(() => { load(true) }, [cat, sub, radiusKm, coords, from, to])

  function search(e) {
    e.preventDefault()                                   // 폼 제출 시 새로고침 막기
    load(true)
  }
  function pickCat(key) { setParams(key === 'all' ? {} : { cat: key }) }
  function pickSub(key) { setParams({ cat, ...(key !== 'all' && { sub: key }), ...(cat === 'near' && radiusKm !== DEFAULT_RADIUS && { r: String(radiusKm) }) }) }
  function pickRadius(km) { setParams({ cat, ...(sub !== 'all' && { sub }), r: String(km) }) }

  async function openDetail(it) {                        // 카드 클릭 → 목록 정보를 먼저 보여주고 상세를 불러옴
    setDetail({ base: it })
    try {
      const data = it.kind === 'heritage' ? await fetchHeritageDetail(it)
        : it.kind === 'venue' ? await fetchVenueDetail(it.id)
        : await fetchPlaceDetail(it.id)
      setDetail({ base: it, data })
    } catch (err) { setDetail({ base: it, error: err.message }) }
  }

  const modal = detail && (() => {
    const b = detail.base, d = detail.data
    const common = { show: true, onHide: () => setDetail(null), loading: !d && !detail.error, error: detail.error, badge: badgeOf(b) }
    return b.kind === 'heritage' ? (
      <DetailModal {...common}
        title={d?.name ?? b.name} subtitle={d?.hanja} badge={d ? badgeOf({ ...b, kindName: d.kind }) : common.badge}
        images={d?.image ? [d.image] : []}
        rows={d?.info ?? [{ label: '지역', value: b.city }]} text={d?.content}
        lat={d?.lat ?? b.lat} lng={d?.lng ?? b.lng}
        saved={isSaved(b)} onSave={() => toggleFavorite(favOf(b))} />
    ) : b.kind === 'venue' ? (
      <DetailModal {...common}
        title={d?.title ?? b.title} subtitle={b.addr} rows={d?.info}
        lat={d?.lat ?? b.lat} lng={d?.lng ?? b.lng}
        saved={isSaved(b)} onSave={() => toggleFavorite(favOf(b))} />
    ) : (
      <DetailModal {...common}
        title={d?.title ?? b.title} subtitle={d?.addr ?? b.addr}
        images={d?.images?.length ? d.images : b.image ? [b.image] : []}
        rows={d?.info} homepage={d?.homepage} text={d?.overview}
        lat={d?.lat ?? b.lat} lng={d?.lng ?? b.lng}
        saved={isSaved(b)} onSave={() => toggleFavorite(favOf(b))} />
    )
  })()

  return (
    <>
      <PageHeader icon="geo-alt" title="관광·문화" subtitle="한국관광공사 TourAPI · 국가유산청" />

      <div className="d-flex flex-wrap gap-2 mb-2" role="group" aria-label="분류">
        {CATEGORIES.map((c) => (
          <Button key={c.key} className="rounded-pill px-3" variant={cat === c.key ? 'primary' : 'outline-primary'}
            aria-pressed={cat === c.key} onClick={() => pickCat(c.key)}>
            {c.key === 'near' && <i className="bi bi-crosshair me-1" />}{c.label}
          </Button>
        ))}
      </div>
      {subs && (
        <div className="d-flex flex-wrap gap-2 mb-2 ps-1" role="group" aria-label={cat === 'near' ? '내 주변 유형' : '관광지 세부 분류'}>
          {subs.map((s) => (
            <Button key={s.key} size="sm" className="rounded-pill px-3" variant={sub === s.key ? 'info' : 'outline-info'}
              aria-pressed={sub === s.key} onClick={() => pickSub(s.key)}>{s.label}</Button>
          ))}
        </div>
      )}

      {cat === 'near' && (
        <div className="d-flex flex-wrap align-items-center gap-2 mb-2 ps-1 small" data-testid="near-bar">
          <span className="text-muted">반경</span>
          <div className="d-flex gap-1" role="group" aria-label="반경">
            {RADII.map((km) => (
              <Button key={km} size="sm" className="rounded-pill px-2" variant={radiusKm === km ? 'info' : 'outline-info'}
                aria-pressed={radiusKm === km} onClick={() => pickRadius(km)}>{km}km</Button>
            ))}
          </div>
          <span className="text-muted ms-2" data-testid="near-origin">
            <i className="bi bi-geo-alt me-1" />
            {locating ? '위치를 찾는 중...' : coords?.note ?? '내 현재 위치 기준'}
          </span>
          <Button size="sm" variant="link" className="p-0" onClick={locate} disabled={locating}>내 위치 다시 찾기</Button>
        </div>
      )}

      {cat === 'festival' && (
        <div className="d-flex flex-wrap align-items-center gap-2 mb-2 ps-1 small" data-testid="festival-dates">
          <span className="text-muted">기간</span>
          <Form.Control type="date" size="sm" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="시작일" style={{ width: 150 }} />
          <span className="text-muted">~</span>
          <Form.Control type="date" size="sm" value={to} min={from} onChange={(e) => setTo(e.target.value)} aria-label="종료일" style={{ width: 150 }} />
          {(to || from !== todayKst()) && (
            <Button size="sm" variant="link" className="p-0" onClick={() => { setFrom(todayKst()); setTo('') }}>오늘부터 보기</Button>
          )}
          <span className="text-muted">에 진행 중이거나 시작하는 행사</span>
        </div>
      )}

      {cat !== 'near' && (
        <Form onSubmit={search} className="mt-3 mb-4">
          <InputGroup>
            <Form.Control value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="검색어 (비우면 전체)" />
            <Button type="submit"><i className="bi bi-search" /></Button>
          </InputGroup>
        </Form>
      )}
      {cat === 'near' && <div className="mb-3" />}

      <ErrorAlert error={error} />
      {loading ? <Loading /> : items.length === 0 ? <Empty /> : (
        <Row xs={1} sm={2} lg={3} className="g-3">
          {items.map((it) => (
            <Col key={it.key}>
              <ItemCard
                title={it.kind === 'heritage' ? it.name : it.title}
                subtitle={subtitleOf(it)}
                image={it.image} badge={badgeOf(it)}
                status={festivalStatus(it.start, it.end)}
                onClick={() => openDetail(it)}
                saved={isSaved(it)} onSave={() => toggleFavorite(favOf(it))} />
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

      {modal}
    </>
  )
}
