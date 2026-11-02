import { useEffect, useRef } from 'react'
import { Badge, Button, Carousel, ListGroup, Modal } from 'react-bootstrap'
import PlaceMap from './PlaceMap'
import NearbyRecs from './NearbyRecs'
import { CitrusMark } from './JejuScene'
import { ErrorAlert, Loading } from './Status'
import { isJejuCoord } from '../lib/geo'

// 상세 정보 팝업 — 사진 · 이용정보 · 소개 · 지도 (관광지·국가유산 페이지가 함께 사용)
// rows: [{ label, value }]   images: [url]   homepage: 주소(선택)
// recommend: { mode: 'spot'|'food', excludeId, onPick(item) } — 있으면 아래에 "근처 추천"을 보여줌
// onBack / backLabel: 추천에서 넘어온 경우 이전 장소로 돌아가는 버튼
export default function DetailModal({ show, onHide, title, subtitle, badge, loading, error, images = [], rows = [], homepage, text, lat, lng, saved = false, onSave, recommend, onBack, backLabel }) {
  const bodyRef = useRef(null)
  // 다른 장소로 넘어가면 본문을 맨 위로
  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = 0 }, [title])
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
          ? <PlaceMap key={`${lat},${lng}`} lat={lat} lng={lng} name={title} />   /* 다른 장소로 넘어가면 지도도 새로 그림 (Leaflet 중심은 처음 한 번만 정해짐) */
          : !loading && <div className="small text-muted"><i className="bi bi-geo-alt me-1" />위치 좌표가 없어 지도를 표시할 수 없어요</div>}

        {recommend && isJejuCoord(lat, lng) && (
          <NearbyRecs key={`${recommend.mode}:${lat},${lng}`} lat={lat} lng={lng} mode={recommend.mode} excludeId={recommend.excludeId} onPick={recommend.onPick} />
        )}
      </Modal.Body>
      {onSave && (
        <Modal.Footer>
          <Button variant={saved ? 'outline-secondary' : 'outline-primary'} onClick={onSave} aria-pressed={saved} data-testid="modal-fav">
            <CitrusMark filled={saved} size={20} className="citrus-inline" />{saved ? '가볼만한 곳에서 빼기' : '가볼만한 곳에 담기'}
          </Button>
        </Modal.Footer>
      )}
    </Modal>
  )
}
