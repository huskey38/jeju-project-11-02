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

// 즐겨찾기 표시용 감귤 아이콘: 담겼으면(filled) 주황 열매, 아니면 윤곽선만
export function CitrusMark({ filled = false, size = 22, className = '' }) {
  const orange = '#e8892b'
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <circle cx="16" cy="18" r="11" fill={filled ? orange : 'none'} stroke={orange} strokeWidth={filled ? 0 : 2} />
      {filled && <ellipse cx="12.5" cy="14" rx="3.2" ry="2" fill="#fff" opacity=".3" transform="rotate(-30 12.5 14)" />}
      <path d="M16 7.4c0-2.8 2.2-4.6 5.4-4.6-.2 3-2.4 4.8-5.4 4.6z" fill={filled ? '#2f6b52' : 'none'} stroke="#2f6b52" strokeWidth={filled ? 0 : 1.6} strokeLinejoin="round" />
      <rect x="15.2" y="5.6" width="1.6" height="3" rx=".8" fill="#2f6b52" />
    </svg>
  )
}

// 돌하르방 캐릭터: 벙거지 모자 · 크고 둥근 눈 · 넓적한 코 · 미소 · 현무암 구멍 무늬 (홈 히어로 장식. AI 가이드의 얼굴은 Oreumi.jsx)
export function DolHareubang({ size = 40, className = '', ...rest }) {
  const stone = '#9b968e', stoneDark = '#77726b', stoneLight = '#aaa59c', ink = '#3b3733'
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false" {...rest}>
      {/* 몸통과 두 손 (한 손은 배, 한 손은 가슴) */}
      <path d="M11 64 C11 53 20 47 32 47 C44 47 53 53 53 64 Z" fill={stone} />
      <rect x="18" y="55" width="11" height="6.5" rx="3.2" fill={stoneLight} stroke={stoneDark} strokeWidth=".8" />
      <rect x="36" y="52" width="10" height="6" rx="3" fill={stoneLight} stroke={stoneDark} strokeWidth=".8" />
      {/* 귀 */}
      <ellipse cx="17.2" cy="35" rx="3.2" ry="5.4" fill={stone} stroke={stoneDark} strokeWidth=".8" />
      <ellipse cx="46.8" cy="35" rx="3.2" ry="5.4" fill={stone} stroke={stoneDark} strokeWidth=".8" />
      {/* 얼굴: 길쭉하게 */}
      <path d="M17.4 28 L46.6 28 L46.6 42.5 C46.6 49.5 40.4 52.4 32 52.4 C23.6 52.4 17.4 49.5 17.4 42.5 Z" fill={stone} />
      {/* 벙거지 모자: 둥근 지붕 + 챙 */}
      <path d="M14.5 25.5 C14.5 7.5 49.5 7.5 49.5 25.5 Z" fill="#8a857e" />
      <path d="M21 14.5 C26 10 36 9.6 42 13.6" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity=".28" />
      <ellipse cx="32" cy="25.5" rx="20.8" ry="4.8" fill={stoneDark} />
      <ellipse cx="32" cy="24.3" rx="20.8" ry="4" fill="#847f78" />
      {/* 짙은 눈썹 능선 */}
      <path d="M19.6 29.4 Q25 26.4 30 29" fill="none" stroke={stoneDark} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M34 29 Q39 26.4 44.4 29.4" fill="none" stroke={stoneDark} strokeWidth="2.2" strokeLinecap="round" />
      {/* 눈: 돌로 도드라지게 새긴 둥근 눈알 + 작은 눈동자 */}
      <circle cx="25" cy="33" r="4.6" fill="#a39e96" stroke={stoneDark} strokeWidth=".8" />
      <circle cx="39" cy="33" r="4.6" fill="#a39e96" stroke={stoneDark} strokeWidth=".8" />
      <circle cx="25.2" cy="33.6" r="2.5" fill={ink} />
      <circle cx="38.8" cy="33.6" r="2.5" fill={ink} />
      <circle cx="25.8" cy="32.6" r=".6" fill="#fff" opacity=".8" />
      <circle cx="39.4" cy="32.6" r=".6" fill="#fff" opacity=".8" />
      {/* 코: 넓적한 코볼 + 콧방울 선 */}
      <path d="M28.2 36.4 C29 34.2 35 34.2 35.8 36.4 C38.4 39.4 37.8 43.4 32 43.6 C26.2 43.4 25.6 39.4 28.2 36.4 Z" fill="#938e86" stroke="#5d5851" strokeWidth=".9" />
      <path d="M28.6 41.4 q1.2 1 2.4 0 M33 41.4 q1.2 1 2.4 0" fill="none" stroke={ink} strokeWidth="1.1" strokeLinecap="round" />
      {/* 입: 입꼬리가 살짝 올라간 미소 */}
      <path d="M26.4 47.6 Q32 50.6 37.6 47.6" fill="none" stroke={ink} strokeWidth="1.7" strokeLinecap="round" />
      {/* 현무암 구멍 무늬 */}
      <g fill="#5d5851" opacity=".4">
        <circle cx="22" cy="16.5" r=".9" /><circle cx="40.5" cy="15" r=".8" /><circle cx="33" cy="12" r=".7" /><circle cx="45" cy="20.5" r=".8" />
        <circle cx="20.4" cy="42" r=".8" /><circle cx="43.6" cy="42.5" r=".9" /><circle cx="31" cy="28" r=".6" /><circle cx="29" cy="52" r=".6" />
        <circle cx="21" cy="60" r=".8" /><circle cx="45" cy="61" r=".9" /><circle cx="14.5" cy="61" r=".7" />
      </g>
    </svg>
  )
}

// 홈 상단 풍경: 감귤빛 해 · 한라산과 오름 · 유채꽃 · 감귤나무 · 현무암 돌담 · 돌하르방 · 갈매기 · 바다 파도
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
      {/* 유채꽃: 오름 자락에 노란 점 */}
      <g fill="#f2c94c">
        {[[104,176],[116,172],[128,177],[142,170],[156,175],[170,171],[184,176],[198,172],[212,177],[226,173],[238,178],[344,178],[358,175],[372,179],[420,177],[432,180]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="2.4" />)}
      </g>
      {/* 감귤나무: 오름 위에 한 그루 */}
      <rect x="387" y="148" width="3" height="10" rx="1.2" fill="#7a5a3a" />
      <circle cx="388.5" cy="142" r="11" fill="#2f6b52" />
      <g fill="#e8892b"><circle cx="383" cy="141" r="2.4" /><circle cx="392" cy="138" r="2.4" /><circle cx="390" cy="146" r="2.4" /></g>
      {/* 현무암 돌담: 구멍 숭숭한 검은 돌을 쌓아 올린 담 */}
      <g fill="#6f6a63">
        {[0,15,30,45,60,75].map((x) => <ellipse key={`a${x}`} cx={x + 8} cy="180" rx="8.2" ry="5" />)}
        {[7,22,37,52,67].map((x) => <ellipse key={`b${x}`} cx={x + 8} cy="172" rx="8" ry="4.8" fill="#7e7870" />)}
      </g>
      <g fill="#4a4641" opacity=".55">{[6,20,34,48,62,76,14,29,44,59].map((x, i) => <circle key={x} cx={x + 6} cy={i < 6 ? 180 : 172} r=".9" />)}</g>
      {/* 갈매기 */}
      <g fill="none" stroke="#8a857e" strokeWidth="1.8" strokeLinecap="round" opacity=".7">
        <path d="M292 44 q6 -7 12 0 q6 -7 12 0" /><path d="M324 62 q5 -6 10 0 q5 -6 10 0" />
      </g>
      {/* 돌하르방: 바닷가에서 마중 */}
      <DolHareubang x={452} y={118} size={68} />
      {/* 바다 + 파도 */}
      <rect x="0" y="180" width="520" height="40" fill="#3f9bb0" opacity=".22" />
      <path d="M0 192 Q20 184 40 192 T80 192 T120 192 T160 192 T200 192 T240 192 T280 192 T320 192 T360 192 T400 192 T440 192 T480 192 T520 192"
        fill="none" stroke="#3f9bb0" strokeWidth="2.2" strokeLinecap="round" opacity=".7" />
      <path d="M0 206 Q20 198 40 206 T80 206 T120 206 T160 206 T200 206 T240 206 T280 206 T320 206 T360 206 T400 206 T440 206 T480 206 T520 206"
        fill="none" stroke="#3f9bb0" strokeWidth="2" strokeLinecap="round" opacity=".45" />
    </svg>
  )
}
