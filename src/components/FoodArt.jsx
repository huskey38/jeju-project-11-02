// 사진이 없는 음식점·카페 카드의 기본 그림: 업태(한식·횟집·식육·분식·일식·중식·양식·치킨·카페)에 맞는 간단한 그림
// 일반음식점 공공데이터에는 사진이 없어서, 회색 빈 칸 대신 음식 그림을 보여 줌 (오름 카드의 OreumArt 와 같은 방식)

// 업태 이름(행정안전부 '업태구분명') → 그림 종류
export function foodKindOf(biz = '') {
  const b = String(biz)
  if (b === 'cafe') return 'cafe'
  if (/한식/.test(b)) return 'bowl'
  if (/횟집|회/.test(b)) return 'fish'
  if (/식육|숯불|구이/.test(b)) return 'grill'
  if (/분식/.test(b)) return 'snack'
  if (/일식|초밥/.test(b)) return 'sushi'
  if (/중국|중식/.test(b)) return 'noodle'
  if (/통닭|치킨/.test(b)) return 'chicken'
  return 'plate'   // 경양식·기타
}

const BROWN = '#7a5a3a', CREAM = '#fff8e8'

const ICONS = {
  plate: (
    <>
      <ellipse cx="115" cy="92" rx="62" ry="17" fill="#fff" stroke="#e6d5ae" strokeWidth="2" />
      <ellipse cx="115" cy="90" rx="40" ry="10" fill="#fbe9c6" />
      <path d="M44 52v34M40 52v14q0 6 4 6t4-6V52M44 72v14" stroke={BROWN} strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M186 52q-8 10-8 26h8V52zM186 78v10" stroke={BROWN} strokeWidth="3" fill={BROWN} strokeLinecap="round" />
    </>
  ),
  bowl: (
    <>
      <path d="M62 78q4 34 53 34t53-34z" fill="#fff" stroke="#e6d5ae" strokeWidth="2" />
      <path d="M72 78q4-26 43-26t43 26z" fill={CREAM} />
      <path d="M96 56q19-20 38 0" fill="#fff" stroke="#e6d5ae" strokeWidth="2" />
      <path d="M150 40l30 30M158 36l30 30" stroke={BROWN} strokeWidth="3" strokeLinecap="round" />
    </>
  ),
  noodle: (
    <>
      <path d="M62 74q4 36 53 36t53-36z" fill="#d9561e" />
      <path d="M72 74q8-20 18-4t18-4 18 4 18-4 14 8z" fill="#f6d890" stroke="#e0b860" strokeWidth="2" />
      <path d="M92 48q-6-8 0-14M115 46q-6-8 0-14M138 48q-6-8 0-14" stroke="#cdbb94" strokeWidth="3" fill="none" strokeLinecap="round" />
    </>
  ),
  snack: (
    <>
      <path d="M64 76q4 34 51 34t51-34z" fill="#e8892b" />
      <g fill="#fff8e8" stroke="#e6d5ae" strokeWidth="2">
        <rect x="78" y="58" width="22" height="22" rx="8" transform="rotate(-14 89 69)" />
        <rect x="104" y="52" width="22" height="22" rx="8" transform="rotate(8 115 63)" />
        <rect x="130" y="58" width="22" height="22" rx="8" transform="rotate(16 141 69)" />
      </g>
    </>
  ),
  sushi: (
    <>
      <rect x="62" y="78" width="46" height="24" rx="12" fill={CREAM} stroke="#e6d5ae" strokeWidth="2" />
      <path d="M58 76q26-18 54 0q-4 14-27 14T58 76z" fill="#f08a6c" />
      <rect x="122" y="78" width="46" height="24" rx="12" fill={CREAM} stroke="#e6d5ae" strokeWidth="2" />
      <path d="M118 76q26-18 54 0q-4 14-27 14T118 76z" fill="#f6b04a" />
    </>
  ),
  fish: (
    <>
      <path d="M72 70q34-34 78 0q-44 34-78 0z" fill="#5aa5b8" />
      <path d="M150 70l32-22v44z" fill="#4a93a6" />
      <circle cx="94" cy="64" r="4" fill="#fff" /><circle cx="94" cy="64" r="2" fill="#2a200a" />
      <path d="M108 58q6 12 0 24M122 56q6 14 0 28" stroke="#fff" strokeWidth="2" fill="none" opacity=".6" />
      <path d="M40 104q18-8 36 0t36 0 36 0 36 0" stroke="#3f9bb0" strokeWidth="3" fill="none" strokeLinecap="round" opacity=".5" />
    </>
  ),
  grill: (
    <>
      <path d="M62 78h106M62 90h106M62 102h106" stroke={BROWN} strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="94" cy="72" rx="22" ry="9" fill="#c4553b" /><ellipse cx="94" cy="70" rx="16" ry="5" fill="#d9705a" />
      <ellipse cx="138" cy="72" rx="22" ry="9" fill="#c4553b" /><ellipse cx="138" cy="70" rx="16" ry="5" fill="#d9705a" />
      <path d="M92 118q-10-12 0-22q2 8 8 4q-2 10-8 18zM118 120q-12-14 0-26q3 10 10 5q-1 12-10 21zM142 118q-10-12 0-22q2 8 8 4q-2 10-8 18z" fill="#e8892b" />
    </>
  ),
  chicken: (
    <>
      <ellipse cx="108" cy="66" rx="30" ry="24" fill="#c98a3a" transform="rotate(-20 108 66)" />
      <ellipse cx="104" cy="60" rx="18" ry="11" fill="#dba45a" transform="rotate(-20 104 60)" />
      <path d="M132 86l24 18" stroke="#fff8e8" strokeWidth="9" strokeLinecap="round" />
      <circle cx="160" cy="108" r="6" fill="#fff8e8" /><circle cx="152" cy="112" r="6" fill="#fff8e8" />
    </>
  ),
  cafe: (
    <>
      <path d="M78 66h66v14q0 28-33 28t-33-28z" fill="#fff" stroke="#e6d5ae" strokeWidth="2" />
      <path d="M144 72h10q10 0 10 10t-10 10h-12" stroke="#e6d5ae" strokeWidth="5" fill="none" />
      <path d="M82 70h58v6H82z" fill="#7a4a2a" />
      <ellipse cx="111" cy="112" rx="50" ry="7" fill="#e6d5ae" opacity=".7" />
      <path d="M96 54q-6-8 0-14M114 52q-6-8 0-14M132 54q-6-8 0-14" stroke="#cdbb94" strokeWidth="3" fill="none" strokeLinecap="round" />
    </>
  ),
}

export default function FoodArt({ biz, kind, className = '' }) {
  const k = kind ?? foodKindOf(biz)
  return (
    <svg className={className} viewBox="0 0 230 140" preserveAspectRatio="xMidYMid slice" role="img" aria-label="음식 그림" data-testid="food-art" data-kind={k}>
      <defs>
        <linearGradient id="food-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fdf1d8" /><stop offset="1" stopColor="#f6e2c0" /></linearGradient>
      </defs>
      <rect width="230" height="140" fill="url(#food-bg)" />
      <circle cx="196" cy="26" r="12" fill="#ffd58a" opacity=".7" />
      {ICONS[k] ?? ICONS.plate}
    </svg>
  )
}
