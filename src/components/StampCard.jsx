import { Badge, Button, Modal } from 'react-bootstrap'
import { fmtDate } from '../lib/oreumStats'
import { formGroupOf } from '../lib/oreumForms'
import { FEATURES } from '../lib/features'
import { usePhotoStore } from '../store/usePhotoStore'
import OreumArt from './OreumArt'
import VisitPhoto from './VisitPhoto'

// 오름 도감 칸을 누르면 뜨는 카드: 내가 올린 인증사진을 크게 보여 주고(없으면 오름 그림), 방문일·형태·표고·소재지, 사진 바꾸기·지우기, 자세한 정보 보기
// oreum: 도감 칸의 오름 | done: 오른 오름 여부 | date: 방문일(ISO) | onDetail(oreum): 정보 카드(상세)로 이동
export default function StampCard({ oreum, done, date, onHide, onDetail }) {
  const photo = usePhotoStore((s) => (oreum ? s.photos[String(oreum.id)] : null))
  if (!oreum) return null
  const form = formGroupOf(oreum.form)
  const rows = [
    ['형태', form.key !== 'etc' ? form.label : '기타'], ['표고', oreum.elev ? `${oreum.elev}m` : ''],
    ['행정시', oreum.city], ['소재지', oreum.addr],
  ].filter(([, v]) => v)
  return (
    <Modal show onHide={onHide} centered data-testid="stamp-card">
      <Modal.Header closeButton>
        <Modal.Title className="fs-5">
          <Badge bg={done ? 'success' : 'secondary'} className="me-2">{done ? '오른 오름' : '아직 안 오른 오름'}</Badge>{oreum.name}
          {done && date && <div className="small text-muted fw-normal mt-1"><i className="bi bi-calendar-check me-1" />{fmtDate(date)}에 올랐어요</div>}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {FEATURES.visitPhoto && done && photo
          ? <img src={photo.url} alt={`${oreum.name} 내 인증사진`} className="stamp-card-photo mb-3" data-testid="stamp-card-photo" />
          : <OreumArt form={oreum.form} elev={oreum.elev} className="stamp-card-art mb-3" />}
        {FEATURES.visitPhoto && done && <VisitPhoto oreumId={oreum.id} showImage={false} />}
        {!done && <div className="small text-muted mb-3">아직 오르지 않았어요. 정보 카드에서 ‘올랐어요’를 누르면 도감에 스탬프가 찍히고, 내 인증사진도 붙일 수 있어요.</div>}
        <dl className="stamp-card-rows small mb-0">
          {rows.map(([k, v]) => (<div key={k} className="d-flex gap-3"><dt className="text-muted fw-normal flex-shrink-0">{k}</dt><dd className="mb-1">{v}</dd></div>))}
        </dl>
      </Modal.Body>
      <Modal.Footer>
        {onDetail && <Button variant="outline-success" className="rounded-pill px-3" onClick={() => onDetail(oreum)} data-testid="stamp-card-detail">자세한 정보 보기</Button>}
        <Button variant="outline-secondary" className="rounded-pill px-3" onClick={onHide}>닫기</Button>
      </Modal.Footer>
    </Modal>
  )
}
