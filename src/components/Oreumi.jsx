// 오롬이 캐릭터: 동글동글한 오름 모양 얼굴 — 초록 언덕 몸통, 정상에 감귤 한 알, 볼터치와 미소 (AI 가이드의 얼굴)
export default function Oreumi({ size = 40, className = '', ...rest }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false" {...rest}>
      <defs>
        <linearGradient id="oreumi-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9bcf7f" />
          <stop offset="1" stopColor="#5f9a55" />
        </linearGradient>
      </defs>
      {/* 정상의 감귤 */}
      <circle cx="32" cy="10.8" r="6.2" fill="#f08a24" />
      <circle cx="29.6" cy="8.6" r="1.8" fill="#ffc27a" opacity=".8" />
      <path d="M32 5 q3.4 -3.2 7 -1.6 q-1.6 3.8 -7 1.6Z" fill="#6fbf4a" />
      {/* 오름 몸통(둥근 언덕) */}
      <path d="M3.5 58.5 C3.5 34 18 15.5 32 15.5 C46 15.5 60.5 34 60.5 58.5 Z" fill="url(#oreumi-body)" />
      <path d="M12 30 C17 22 24 19 30 18.6" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".35" />
      {/* 풀 무늬 */}
      <g fill="none" stroke="#4d8a4a" strokeWidth="1.3" strokeLinecap="round" opacity=".55">
        <path d="M14 54 q1 -3 2 0 M18 56 q1 -3 2 0" /><path d="M46 54 q1 -3 2 0 M42 56 q1 -3 2 0" /><path d="M30 24 q1 -2 2 0" />
      </g>
      {/* 볼터치(공통) */}
      <ellipse cx="17.5" cy="45.2" rx="3.4" ry="2.1" fill="#f6a38c" opacity=".7" />
      <ellipse cx="46.5" cy="45.2" rx="3.4" ry="2.1" fill="#f6a38c" opacity=".7" />
      {/* 평소 얼굴: 동그란 눈 + 작은 미소 */}
      <g className="oreumi-calm">
        <ellipse cx="23.5" cy="38" rx="3.1" ry="3.7" fill="#2f2a22" />
        <ellipse cx="40.5" cy="38" rx="3.1" ry="3.7" fill="#2f2a22" />
        <circle cx="24.5" cy="36.6" r="1.05" fill="#fff" />
        <circle cx="41.5" cy="36.6" r="1.05" fill="#fff" />
        <path d="M27 45 Q32 50.2 37 45" fill="none" stroke="#2f2a22" strokeWidth="1.9" strokeLinecap="round" />
      </g>
      {/* 빵긋 웃는 얼굴(마우스를 올리거나 끌 때): 눈이 ^ ^ 로 휘고 입이 활짝 열림 */}
      <g className="oreumi-happy">
        <path d="M19.8 39.6 Q23.5 33 27.2 39.6" fill="none" stroke="#2f2a22" strokeWidth="2.3" strokeLinecap="round" />
        <path d="M36.8 39.6 Q40.5 33 44.2 39.6" fill="none" stroke="#2f2a22" strokeWidth="2.3" strokeLinecap="round" />
        <path d="M24.5 43.6 Q32 56.5 39.5 43.6 Z" fill="#8a3b2e" stroke="#2f2a22" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M28.2 50.4 Q32 47.6 35.8 50.4 Q32 53.6 28.2 50.4 Z" fill="#f08a7a" />
      </g>
      {/* 땅 */}
      <path d="M2 58.8 H62" stroke="#8a6a3c" strokeWidth="2.2" strokeLinecap="round" opacity=".55" />
    </svg>
  )
}
