import { Fragment, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button, Col, Form, InputGroup, Row } from 'react-bootstrap'
import ItemCard from '../components/ItemCard'
import { CitrusMark } from '../components/JejuScene'
import OreumProgress from '../components/OreumProgress'
import { Empty, ErrorAlert, Loading } from '../components/Status'
import PlaceFilters from '../components/places/PlaceFilters'
import OreumSortBar from '../components/places/OreumSortBar'
import PlaceDetailModal from '../components/places/PlaceDetailModal'
import { usePlaceList } from '../hooks/usePlaceList'
import { usePlaceDetail } from '../hooks/usePlaceDetail'
import { CATEGORIES, DEFAULT_CAT, NEAR_CATS, parseTags, toggleTag, RADII, badgeOf, parseSub, subsOf, toggleSub, subtitleOf } from '../lib/placeCategories'
import { isJejuCoord } from '../lib/geo'
import OreumArt from '../components/OreumArt'
import { FEATURES } from '../lib/features'
import OreumMark from '../components/OreumMark'
import Pager from '../components/Pager'
import { savedKey, useSavedPreviews } from '../lib/useSavedPreviews'
import { pageCount } from '../lib/paging'
import { formGroupOf } from '../lib/oreumForms'
import { CITY_HALL, HIDDEN_TAGS, ROWS, SOURCE_LABEL, favOf, valid } from '../lib/placeItems'
import { useAppStore } from '../store/useAppStore'

// 분류별 목록 화면(오름 찾기·음식점·카페·담아둔 곳·오른 오름).
// 이 파일은 주소(URL) 해석과 화면 조립을 맡고, 나머지는 나눠 두었음:
//   목록 불러오기 → hooks/usePlaceList.js | 상세(정보 카드) 열기 → hooks/usePlaceDetail.js + components/places/PlaceDetailModal.jsx
//   필터 줄 → components/places/PlaceFilters.jsx·OreumSortBar.jsx | 순수 함수·상수 → lib/placeItems.js
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

  // 목록(불러오기·더 보기·쪽 이동)과 상세(정보 카드)는 각각 훅으로 분리
  const { items, shownItems, loading, error, hasMore, moreLoading, pageNo, total, pageEnds, viewPage, setViewPage, load, loadOreum } =
    usePlaceList({ cat, sub, nearOn, radiusKm, tags, form, sort, unvisited, coords, keyword, visits })
  const { detail, trail, openDetail, openSaved, closeDetail, goBack } = usePlaceDetail()

  function search(e) {
    e.preventDefault()                                   // 폼 제출 시 새로고침 막기
    load(true)
  }
  // 주소(?cat=&sub=&r=) 만들기: 반경(r)은 분류를 옮겨도 유지됨
  const urlOf = ({ c = cat, sb = sub, r = radiusKm, tg = tags, fm = form, so = sort, nv = unvisited, or = origin }) => ({ ...(or && r > 0 && (c === 'food' || c === 'cafe') && { ol: String(or.lat), og: String(or.lng), on: or.name }), ...(nv && c === 'oreum' && { nv: '1' }), ...(fm && c === 'oreum' && { fm }), ...(so && c === 'oreum' && { so }), ...(c !== DEFAULT_CAT && { cat: c }), ...(sb !== 'all' && { sub: sb }), ...(r > 0 && NEAR_CATS.includes(c) && c !== 'oreum' && { r: String(r) }), ...(tg.length > 0 && { t: tg.join(',') }) })
  const jumpTop = () => setTimeout(() => document.querySelector('[data-testid=place-list]')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
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
      <PlaceFilters cat={cat} canNear={canNear} nearOn={nearOn} radiusKm={radiusKm} locating={locating} coords={coords} origin={origin}
        subs={subs} sub={sub} tags={tags} onPickRadius={pickRadius} onFindMine={findMine} onPickSub={pickSub} onPickTag={pickTag}
        onClearTags={() => setParams(urlOf({ tg: [] }))} />

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
      {cat === 'oreum' && <OreumSortBar nearOn={nearOn} sort={sort} unvisited={unvisited} keyword={keyword} onPickSort={pickSort} onPickUnvisited={pickUnvisited} />}
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

      <PlaceDetailModal detail={detail} trail={trail} onClose={closeDetail} onBack={goBack}
        onPick={(item) => openDetail(item, { fromRec: true })} onMore={goNear} />
    </>
  )
}
