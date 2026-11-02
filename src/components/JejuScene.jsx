// 제주 느낌을 내는 작은 SVG 그림들 (외부 이미지 없이 직접 그린 도형)

// 감귤 로고: 주황 열매 + 초록 잎
export function CitrusIcon({ size = 26, className = '' }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="18" r="11" fill="#e8892b" />
      <circle cx="16" cy="18" r="11" fill="url(#citrus-shade)" />
      <ellipse cx="12.5" cy="14" rx="3.2" ry="2" fill="#fff" opacity=".28" transform="rotate(-30 12.5 14)" />
      <path d="M16 7.4c0-2.8 2.2-4.6 5.4-4.6-.2 3-2.4 4.8-5.4 4.6z" fill="#2f6b52" />
      <rect x="15.2" y="5.6" width="1.6" height="3" rx=".8" fill="#2f6b52" />
      <defs>
        <radialGradient id="citrus-shade" cx=".35" cy=".3" r=".9">
          <stop offset=".55" stopColor="#e8892b" stopOpacity="0" />
          <stop offset="1" stopColor="#b4600f" stopOpacity=".35" />
        </radialGradient>
      </defs>
    </svg>
  )
}

// 홈 상단 풍경: 감귤빛 해 · 한라산과 오름 실루엣 · 바다 파도
export function HallaScene({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 520 220" preserveAspectRatio="xMaxYMax meet" aria-hidden="true" focusable="false">
      {/* 해(감귤) */}
      <circle cx="398" cy="62" r="34" fill="#e8892b" opacity=".92" />
      <circle cx="398" cy="62" r="46" fill="#e8892b" opacity=".14" />
      {/* 한라산 (멀리, 넓은 순상화산) */}
      <path d="M40 176 C100 150 150 98 205 80 C222 74 238 74 255 80 C310 98 370 150 470 176 Z" fill="#c4dccb" />
      {/* 백록담 능선 */}
      <path d="M205 80 C222 74 238 74 255 80 C246 84 214 84 205 80 Z" fill="#a9cdb6" />
      {/* 오름 (가깝게, 봉긋한 언덕) */}
      <path d="M0 184 C34 150 82 150 120 184 Z" fill="#8dbf9e" />
      <path d="M96 184 C140 138 206 138 248 184 Z" fill="#6fae88" />
      <path d="M330 184 C362 156 410 156 446 184 Z" fill="#8dbf9e" />
      {/* 바다 + 파도 */}
      <rect x="0" y="180" width="520" height="40" fill="#3f9bb0" opacity=".22" />
      <path d="M0 192 Q20 184 40 192 T80 192 T120 192 T160 192 T200 192 T240 192 T280 192 T320 192 T360 192 T400 192 T440 192 T480 192 T520 192"
        fill="none" stroke="#3f9bb0" strokeWidth="2.2" strokeLinecap="round" opacity=".7" />
      <path d="M0 206 Q20 198 40 206 T80 206 T120 206 T160 206 T200 206 T240 206 T280 206 T320 206 T360 206 T400 206 T440 206 T480 206 T520 206"
        fill="none" stroke="#3f9bb0" strokeWidth="2" strokeLinecap="round" opacity=".45" />
    </svg>
  )
}
