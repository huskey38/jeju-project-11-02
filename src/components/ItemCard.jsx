import { Badge, Card } from 'react-bootstrap'
import FavButton from './FavButton'
import VisitButton from './VisitButton'

// 관광지·유산·즐겨찾기 등 "목록의 한 칸"을 모두 이 카드 하나로 표시합니다 (재사용 컴포넌트)
// onClick 을 주면 카드 전체가 눌리고(상세 보기), 오른쪽 아래 감귤 버튼은 따로 동작합니다
// onSave 를 주면 감귤 즐겨찾기 버튼이 생기고, saved 로 담김 여부를 표시합니다. onVisit 를 주면 그 밑에 '올랐어요' 버튼(visited 로 가본 여부)이 생깁니다
// art 를 주면 사진이 없을 때 빈 이미지 대신 그 그림(예: 오름 형태 일러스트)을 보여줍니다
// tag 를 주면({ label, tone }) 사진 왼쪽 위에 색 표식이 붙습니다 (오름 형태)
// flag 를 주면 사진 오른쪽 위에 '가본 오름' 표식이 붙습니다 (features.js 의 visitedFilter)
// credit 을 주면 사진 맨 아래에 '사진 · 출처' 한 줄이 붙습니다
// status 를 주면(축제) 기간 진행률 막대와 상태 칩이 붙습니다: { pct, label, tone }
export default function ItemCard({ title, subtitle, image, badge, status, saved = false, onSave, visited = false, onVisit, onClick, art, tag, flag = false, credit }) {
  return (
    <Card className={`h-100 item-card${onClick ? ' clickable' : ''}`} onClick={onClick} role={onClick ? 'button' : undefined}>
      {onSave && <FavButton saved={saved} onClick={onSave} />}
      {onVisit && <VisitButton visited={visited} onClick={onVisit} />}
      <div className="item-card-media">
        {image
          ? <Card.Img variant="top" src={image} alt={title} className="item-card-img" loading="lazy" />
          : art ?? <div className="item-card-img placeholder-img"><i className="bi bi-image" /></div>}
        {credit && image && <span className="photo-credit" data-testid="photo-credit">사진 · {credit.replace(/\(.*\)/, '')}</span>}
        {flag && <span className="visited-flag" data-testid="visited-flag">🍊 오른 오름</span>}
        {tag && <span className={`form-tag form-tag-${tag.tone}`} data-testid="form-tag">{tag.label}</span>}
      </div>
      <Card.Body className={`d-flex flex-column${onSave || onVisit ? ' has-fav' : ''}`}>
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
