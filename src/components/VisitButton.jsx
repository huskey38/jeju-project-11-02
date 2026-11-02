// '가봤어요' 버튼: 가봤으면 초록 체크, 아니면 윤곽선. 누르면 가본 곳에 기록/빼기 (카드 오른쪽 아래, 감귤 버튼 밑)
export default function VisitButton({ visited = false, onClick }) {
  const label = visited ? '가본 곳에서 빼기' : '가봤어요'
  return (
    <button
      type="button" className={`visit-btn${visited ? ' is-visited' : ''}`} data-testid="visit-btn"
      aria-pressed={visited} aria-label={label} title={label}
      onClick={(e) => { e.stopPropagation(); onClick?.(e) }}   /* 카드 전체 클릭(상세 열기)과 겹치지 않게 */
    >
      <i className={`bi bi-${visited ? 'check-circle-fill' : 'check-circle'}`} />
    </button>
  )
}
