import { Alert, Spinner } from 'react-bootstrap'

// 데이터·로딩·에러 3종 세트를 화면에 보여주는 공용 컴포넌트
// slowNote: 오래 걸리는 목록(음식점)에서 잠시 뒤 슬며시 나타나는 안내 한 줄 (빨리 끝나면 보이지 않음)
export function Loading({ text = '불러오는 중...', slowNote }) {
  return (
    <div className="text-center py-5 text-muted" role="status">
      <Spinner animation="border" size="sm" className="me-2" />{text}
      {slowNote && <div className="slow-note small mt-2" data-testid="slow-note">{slowNote}</div>}
    </div>
  )
}
export function ErrorAlert({ error }) {
  if (!error) return null
  return <Alert variant="danger"><i className="bi bi-exclamation-triangle me-2" />{String(error)}</Alert>
}
export function Empty({ text = '결과가 없어요' }) {
  return <div className="text-center py-5 text-muted"><i className="bi bi-inbox fs-2 d-block mb-2" />{text}</div>
}
