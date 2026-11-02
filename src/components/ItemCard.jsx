import { Badge, Card } from 'react-bootstrap'
import FavButton from './FavButton'

// 관광지·유산·즐겨찾기 등 "목록의 한 칸"을 모두 이 카드 하나로 표시합니다 (재사용 컴포넌트)
// onClick 을 주면 카드 전체가 눌리고(상세 보기), 이미지 오른쪽 위 감귤 버튼은 따로 동작합니다
// onSave 를 주면 감귤 즐겨찾기 버튼이 생기고, saved 로 담김 여부를 표시합니다
// status 를 주면(축제) 기간 진행률 막대와 상태 칩이 붙습니다: { pct, label, tone }
export default function ItemCard({ title, subtitle, image, badge, status, saved = false, onSave, onClick }) {
  return (
    <Card className={`h-100 item-card${onClick ? ' clickable' : ''}`} onClick={onClick} role={onClick ? 'button' : undefined}>
      {onSave && <FavButton saved={saved} onClick={onSave} />}
      {image
        ? <Card.Img variant="top" src={image} alt={title} className="item-card-img" />
        : <div className="item-card-img placeholder-img"><i className="bi bi-image" /></div>}
      <Card.Body className="d-flex flex-column">
        {badge && <Badge bg="secondary" className="align-self-start mb-2">{badge}</Badge>}
        <Card.Title className="item-card-title">{title}</Card.Title>
        {subtitle && <Card.Text className="item-card-sub">{subtitle}</Card.Text>}
        {status && (
          <div className={`festival-status tone-${status.tone} mt-auto`} data-testid="festival-status">
            <div className="pill-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={status.pct} aria-label="행사 기간 진행률">
              <div className="pill-fill" style={{ width: `${status.pct}%` }} />
              <span className="pill-text">{status.pct}%</span>
            </div>
            <span className="status-chip"><i className="bi bi-check2 me-1" />{status.label}</span>
          </div>
        )}
      </Card.Body>
    </Card>
  )
}
