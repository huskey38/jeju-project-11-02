// 오름 아이콘: 낮고 넓은 오름(옆에 작은 봉우리가 붙은 실루엣) + 정상에 감귤 한 알 — '오른 오름' 표시 (체크 ✓·깃발 대신)
//   filled=true  : 올랐어요 — 꽉 찬 오름 + 감귤색 귤과 잎 (오름 색은 글자색 currentColor)
//   filled=false : 아직 — 윤곽선 오름 + 윤곽선 귤
const HILL = 'M1.6 20.5 C3 14.5 7 9.8 11 9.8 C14 9.8 15 12.8 17.2 12.8 C19.8 12.8 21.6 16.2 22.4 20.5 Z'

export default function OreumMark({ filled = false, size = 18, className = '', ...rest }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false" {...rest}>
      <path d={HILL} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={filled ? 0 : 1.7} strokeLinejoin="round" />
      {filled ? (
        <>
          <circle cx="11" cy="6.8" r="3" fill="#f08a24" stroke="#fff" strokeWidth="1" />
          <path d="M11 3.9 q1.6 -1.4 3 -.7 q-.6 1.6 -3 .7Z" fill="#8fd06b" />
        </>
      ) : (
        <circle cx="11" cy="6.6" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      )}
    </svg>
  )
}
