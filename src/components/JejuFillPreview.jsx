import { useMemo } from 'react'
import { atmosphereAt } from '../lib/oreumAtmosphere'
import { PREVIEW, previewDots } from '../lib/oreumPreview'

// 홈의 '이렇게 채워져요': 3D 제주 지도가 시작(0%)에서 다 채웠을 때(귤이 모두 올라가고 하늘이 노을빛)까지 어떻게 달라지는지 보여 주는 작은 예시 (가벼운 SVG, 3D 를 부르지 않음)
function Panel({ dots, filled, label, count }) {
  const a = atmosphereAt(filled ? 60 : 0)
  const gid = filled ? 'fill-bg-done' : 'fill-bg-start'
  return (
    <figure className="fill-panel mb-0" data-testid={filled ? 'fill-done' : 'fill-start'}>
      <svg viewBox={`0 0 ${PREVIEW.w} ${PREVIEW.h}`} role="img" aria-label={`${label} ${count}`}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={a.seaShallow} /><stop offset="1" stopColor={a.seaDeep} />
          </linearGradient>
        </defs>
        <rect width={PREVIEW.w} height={PREVIEW.h} fill={`url(#${gid})`} />
        <circle cx={PREVIEW.w - 16} cy="15" r="9" fill={a.skyHorizon} opacity=".85" />   {/* 하늘빛 해(시작은 흐릿한 새벽, 채우면 노을) */}
        <g fill={filled ? '#b6dc92' : '#b9c6bd'} opacity=".95">{dots.map((d) => <circle key={`l${d.id}`} cx={d.x} cy={d.y} r="5.6" />)}</g>   {/* 점들이 겹쳐 섬 모양이 됨 */}
        {filled
          ? <g fill="#e8892b" stroke="#fff6e0" strokeWidth=".35">{dots.map((d) => <circle key={d.id} cx={d.x} cy={d.y} r="1.55" />)}</g>
          : <g fill="none" stroke="#6c8a93" strokeWidth=".6" opacity=".9">{dots.map((d) => <circle key={d.id} cx={d.x} cy={d.y} r="1.3" />)}</g>}
      </svg>
      <figcaption><strong>{label}</strong><span className="text-muted"> · {count}</span></figcaption>
    </figure>
  )
}

export default function JejuFillPreview({ list }) {
  const dots = useMemo(() => previewDots(list ?? []), [list])
  if (!dots.length) return null
  const total = dots.length
  return (
    <div className="fill-preview mt-3" data-testid="fill-preview">
      <div className="small fw-bold mb-2"><i className="bi bi-geo-alt-fill me-1 text-success" />3D 지도는 이렇게 채워져요</div>
      <div className="fill-row">
        <Panel dots={dots} label="처음" count={`0 / ${total}곳 · 흐린 새벽`} />
        <span className="fill-arrow" aria-hidden="true"><i className="bi bi-arrow-right" /></span>
        <Panel dots={dots} filled label="다 오르면" count={`${total} / ${total}곳 · 노을빛 황금`} />
      </div>
      <div className="small text-muted mt-2">올랐어요를 누를 때마다 귤이 한 알씩 올라가고, 등반률이 오를수록 하늘과 바다가 맑아져요.</div>
    </div>
  )
}
