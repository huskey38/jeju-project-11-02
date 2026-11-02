import { Badge, Button, Carousel, ListGroup, Modal } from 'react-bootstrap'
import PlaceMap from './PlaceMap'
import { ErrorAlert, Loading } from './Status'
import { isJejuCoord } from '../lib/geo'

// 상세 정보 팝업 — 사진 · 이용정보 · 소개 · 지도 (관광지·국가유산 페이지가 함께 사용)
// rows: [{ label, value }]   images: [url]   homepage: 주소(선택)
export default function DetailModal({ show, onHide, title, subtitle, badge, loading, error, images = [], rows = [], homepage, text, lat, lng, onSave }) {
  return (
    <Modal show={show} onHide={onHide} size="lg" centered scrollable>
      <Modal.Header closeButton>
        <Modal.Title className="fs-5">
          {badge && <Badge bg="secondary" className="me-2">{badge}</Badge>}{title}
          {subtitle && <div className="small text-muted fw-normal">{subtitle}</div>}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body data-testid="detail-modal">
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
          ? <PlaceMap lat={lat} lng={lng} name={title} />
          : !loading && <div className="small text-muted"><i className="bi bi-geo-alt me-1" />위치 좌표가 없어 지도를 표시할 수 없어요</div>}
      </Modal.Body>
      {onSave && (
        <Modal.Footer>
          <Button variant="outline-primary" onClick={onSave}><i className="bi bi-star me-1" />즐겨찾기</Button>
        </Modal.Footer>
      )}
    </Modal>
  )
}
