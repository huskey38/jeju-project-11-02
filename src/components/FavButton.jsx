import { CitrusMark } from './JejuScene'

// 가볼만한 곳(즐겨찾기) 감귤 버튼: 담겨 있으면 주황 열매, 아니면 윤곽선. 누르면 담기/빼기 (카드 오른쪽 아래에 떠 있음)
// onClick 은 호출하는 쪽이 정함 (관광·문화: 담기↔빼기 토글, 가볼만한 곳: 빼기)
export default function FavButton({ saved = false, onClick, className = '' }) {
  const label = saved ? '담아둔 곳에서 빼기' : '담아 두기'
  return (
    <button
      type="button" className={`fav-btn${saved ? ' is-saved' : ''} ${className}`} data-testid="fav-btn"
      aria-pressed={saved} aria-label={label} title={label}
      onClick={(e) => { e.stopPropagation(); onClick?.(e) }}   /* 카드 전체 클릭(상세 열기)과 겹치지 않게 */
    >
      <CitrusMark filled={saved} size={24} />
    </button>
  )
}
