import OreumMark from './OreumMark'

// '올랐어요' 버튼: 올랐으면 초록 원 + 귤 올린 오름, 아니면 윤곽선 오름. 누르면 오른 오름에 기록/빼기 (카드 오른쪽 아래, 감귤 버튼 밑)
export default function VisitButton({ visited = false, onClick }) {
  const label = visited ? '오른 오름에서 빼기' : '올랐어요'
  return (
    <button
      type="button" className={`visit-btn${visited ? ' is-visited' : ''}`} data-testid="visit-btn"
      aria-pressed={visited} aria-label={label} title={label}
      onClick={(e) => { e.stopPropagation(); onClick?.(e) }}   /* 카드 전체 클릭(상세 열기)과 겹치지 않게 */
    >
      <OreumMark filled={visited} size={20} />
    </button>
  )
}
