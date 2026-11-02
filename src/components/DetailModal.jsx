import { useEffect, useMemo, useRef, useState } from 'react'
import { Badge, Button, Carousel, ListGroup, Modal } from 'react-bootstrap'
import PlaceMap from './PlaceMap'
import NearbyRecs from './NearbyRecs'
import PlaceWeather from './PlaceWeather'
import NearbyPoi from './NearbyPoi'
import { CitrusMark } from './JejuScene'
import { ErrorAlert, Loading } from './Status'
import { isJejuCoord } from '../lib/geo'
import { kakaoLinks } from '../lib/kakao'

// 상세 정보 팝업 — 사진 · 이용정보 · 소개 · 지도 (관광지·국가유산 페이지가 함께 사용)
// rows: [{ label, value }]   images: [url]   homepage: 주소(선택)
// visitFrom: 날씨의 방문일 기본값(축제 시작일 등)
// recommend: { mode: 'spot'|'food', excludeId, onPick(item) } — 있으면 아래에 "근처 추천"을 보여줌
// onBack / backLabel: 추천에서 넘어온 경우 이전 장소로 돌아가는 버튼
export default function DetailModal({ show, onHide, title, subtitle, badge, loading, error, images = [], rows = [], homepage, text, lat, lng, visitFrom, saved = false, onSave, visited = false, onVisit, recommend, onBack, backLabel }) {
  const bodyRef = useRef(null)
  const [pins, setPins] = useState({ markers: [], radiusKm: null })   // 근처 추천을 지도 위 핀으로 (NearbyRecs 가 채움)
  const [poiPins, setPoiPins] = useState([])                         // 주변 편의시설(편의점·주차장) 핀 (NearbyPoi 가 채움)
  const allMarkers = useMemo(() => [...pins.markers, ...poiPins], [pins.markers, poiPins])   // 지도가 불필요하게 다시 그려지지 않도록 같은 배열을 유지
  const links = kakaoLinks({ name: title, lat, lng })                  // 카카오맵 보기·길찾기·로드뷰 링크 (좌표가 있을 때)
  // 다른 장소로 넘어가면 본문을 맨 위로, 이전 장소의 핀은 치움
  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = 0 }, [title])
  useEffect(() => { setPins({ markers: [], radiusKm: null }); setPoiPins([]) }, [lat, lng])
  return (
    <Modal show={show} onHide={onHide} size="lg" centered scrollable>
      <Modal.Header closeButton>
        <Modal.Title className="fs-5">
          {onBack && (
            <Button variant="link" size="sm" className="d-block p-0 mb-1 text-start" onClick={onBack} data-testid="modal-back">
              <i className="bi bi-arrow-left me-1" />{backLabel ? `${backLabel}(으)로 돌아가기` : '이전 장소'}
            </Button>
          )}
          {badge && <Badge bg="secondary" className="me-2">{badge}</Badge>}{title}
          {subtitle && <div className="small text-muted fw-normal">{subtitle}</div>}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body data-testid="detail-modal" ref={bodyRef}>
        {/* 날씨: 제목 바로 밑 */}
        {isJejuCoord(lat, lng) && <PlaceWeather key={`${lat},${lng}`} lat={lat} lng={lng} visitFrom={visitFrom} />}

        <ErrorAlert error={error} />
        {loading && <Loading text="상세 정보를 불러오는 중..." />}

        {images.length > 0 && (
          <Carousel className="mb-3 rounded-4 overflow-hidden" interval={null} controls={images.length > 1} indicators={images.length > 1}>
            {images.map((src, i) => (
              <Carousel.Item key={src + i}>
                <img src={src} alt={`${title} ${i + 1}`} className="d-block w-100" style={{ height: 300, objectFit: 'cover' }} />
              </Carousel.Item>
            ))}
          </Carousel>
        )}

        {rows.length > 0 && (
          <ListGroup variant="flush" className="mb-3 small">
            {rows.map((r) => (
              <ListGroup.Item key={r.label} className="d-flex gap-3">
                <span className="text-muted flex-shrink-0" style={{ width: 80 }}>{r.label}</span>
                <span style={{ whiteSpace: 'pre-wrap' }}>{r.value}</span>
              </ListGroup.Item>
            ))}
            {homepage && (
              <ListGroup.Item className="d-flex gap-3">
                <span className="text-muted flex-shrink-0" style={{ width: 80 }}>홈페이지</span>
                <a href={homepage} target="_blank" rel="noreferrer noopener" className="text-break">{homepage}</a>
              </ListGroup.Item>
            )}
          </ListGroup>
        )}

        {text && <p className="mb-3" style={{ whiteSpace: 'pre-wrap' }}>{text}</p>}

        {isJejuCoord(lat, lng)
          ? (
            <>
              {/* 다른 장소로 넘어가면 지도도 새로 그림 (지도 중심은 처음 한 번만 정해지므로 좌표로 key). 근처 추천은 같은 지도에 핀·반경 원으로 함께 표시 */}
              <PlaceMap key={`${lat},${lng}`} lat={lat} lng={lng} name={title}
                markers={allMarkers} radiusM={pins.radiusKm ? pins.radiusKm * 1000 : undefined}
                onPickMarker={(m) => (m.url ? window.open(m.url, '_blank', 'noopener,noreferrer') : recommend?.onPick?.(m.item))} />
              {links && (
                <div className="map-links d-flex flex-wrap gap-2 mt-2" data-testid="map-links">
                  <a className="btn btn-sm btn-outline-primary rounded-pill" href={links.map} target="_blank" rel="noreferrer noopener"><i className="bi bi-map me-1" />카카오맵으로 보기</a>
                  <a className="btn btn-sm btn-outline-primary rounded-pill" href={links.to} target="_blank" rel="noreferrer noopener"><i className="bi bi-signpost-split me-1" />길찾기</a>
                  <a className="btn btn-sm btn-outline-primary rounded-pill" href={links.roadview} target="_blank" rel="noreferrer noopener"><i className="bi bi-binoculars me-1" />로드뷰</a>
                </div>
              )}
            </>
          )
          : !loading && <div className="small text-muted"><i className="bi bi-geo-alt me-1" />위치 좌표가 없어 지도를 표시할 수 없어요</div>}

        {isJejuCoord(lat, lng) && <NearbyPoi key={`poi:${lat},${lng}`} lat={lat} lng={lng} onData={setPoiPins} />}

        {recommend && isJejuCoord(lat, lng) && (
          <NearbyRecs key={`${recommend.mode}:${lat},${lng}`} lat={lat} lng={lng} mode={recommend.mode} excludeId={recommend.excludeId} onPick={recommend.onPick}
            onData={(markers, radiusKm) => setPins({ markers, radiusKm })} />
        )}
      </Modal.Body>
      {(onSave || onVisit) && (
        <Modal.Footer>
          {onVisit && (
            <Button variant={visited ? 'success' : 'outline-success'} onClick={onVisit} aria-pressed={visited} data-testid="modal-visit">
              <i className={`bi bi-${visited ? 'check-circle-fill' : 'check-circle'} me-1`} />{visited ? '가본 곳에서 빼기' : '가봤어요'}
            </Button>
          )}
                    {onSave && <Button variant={saved ? 'outline-secondary' : 'outline-primary'} onClick={onSave} aria-pressed={saved} data-testid="modal-fav">
            <CitrusMark filled={saved} size={20} className="citrus-inline" />{saved ? '가볼만한 곳에서 빼기' : '가볼만한 곳에 담기'}
          </Button>}
        </Modal.Footer>
      )}
    </Modal>
  )
}
