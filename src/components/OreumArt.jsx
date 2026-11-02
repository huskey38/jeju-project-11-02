import { formGroupOf } from '../lib/oreumForms'

// 사진이 없는 오름 카드의 기본 그림: 형태(원추형·원형·말굽형·복합형)와 표고를 반영한 언덕 실루엣
// 표고가 높을수록 언덕이 높게 그려짐 (30~95 사이로 제한)
const BASE = 130
function hillPath(group, elev) {
  const y = BASE - Math.min(95, 30 + (Number(elev) || 0) / 12)
  switch (group) {
    case 'cone': return `M0 ${BASE}L0 ${BASE - 8}Q60 ${BASE - 8} 115 ${y}Q170 ${BASE - 8} 230 ${BASE - 8}L230 ${BASE}Z`
    case 'horseshoe': return `M0 ${BASE}L0 ${BASE - 8}C40 ${BASE - 10} 50 ${y} 80 ${y}Q115 ${y + 30} 150 ${y}C180 ${y} 190 ${BASE - 10} 230 ${BASE - 8}L230 ${BASE}Z`
    case 'mixed': return `M0 ${BASE}L0 ${BASE - 8}C30 ${BASE - 10} 40 ${y + 10} 80 ${y + 10}S110 ${BASE - 30} 130 ${BASE - 30}C150 ${BASE - 30} 160 ${y - 5} 185 ${y - 5}S215 ${BASE - 10} 230 ${BASE - 8}L230 ${BASE}Z`
    default: return `M0 ${BASE}L0 ${BASE - 8}C50 ${BASE - 10} 60 ${y} 115 ${y}S180 ${BASE - 10} 230 ${BASE - 8}L230 ${BASE}Z`   // 원형·그 밖
  }
}

export default function OreumArt({ form, elev, className = '' }) {
  const path = hillPath(formGroupOf(form).key, elev)
  return (
    <svg className={className} viewBox="0 0 230 140" preserveAspectRatio="xMidYMid slice" role="img" aria-label="오름 형태 그림" data-testid="oreum-art">
      <defs>
        <linearGradient id="oreum-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#cfe8f3" /><stop offset="1" stopColor="#fdf1d8" /></linearGradient>
      </defs>
      <rect width="230" height="140" fill="url(#oreum-sky)" />
      <circle cx="190" cy="28" r="12" fill="#ffd58a" />
      <path d={path} fill="#7fae6a" />
      <path d={path} fill="#5e9453" transform="translate(0 6)" opacity=".5" />
      <rect y="128" width="230" height="12" fill="#6aa06a" />
    </svg>
  )
}
