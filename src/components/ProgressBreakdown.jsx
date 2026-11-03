import { useMemo } from 'react'
import { ProgressBar } from 'react-bootstrap'
import { oreumProgress } from '../lib/oreumProgress'
import { byForm } from '../lib/oreumStats'
import { regionProgress } from '../lib/oreumRegions'
import { useOreums } from '../lib/useOreums'
import { useAppStore } from '../store/useAppStore'

// [기능 2] 형태별·지역별 진행률: 칸마다 채워 가는 막대. features.js 의 progressBreakdown
const TONE = { cone: 'form-tone-cone', round: 'form-tone-round', horseshoe: 'form-tone-horseshoe', mixed: 'form-tone-mixed', etc: 'form-tone-etc' }

function Bars({ title, rows, testid }) {
  return (
    <div className="breakdown-col" data-testid={testid}>
      <div className="breakdown-title">{title}</div>
      {rows.map((r) => (
        <div key={r.key} className="breakdown-row">
          <div className="d-flex justify-content-between small"><span>{r.label}</span><span className="text-muted"><strong className="text-body">{r.count}</strong> / {r.total}곳 · {r.percent}%</span></div>
          <ProgressBar now={r.percent} className={`breakdown-bar ${TONE[r.key] ?? 'form-tone-city'}`} aria-label={`${r.label} 진행률`} />
        </div>
      ))}
    </div>
  )
}

export default function ProgressBreakdown() {
  const visits = useAppStore((s) => s.visits)
  const { list } = useOreums()
  const p = useMemo(() => oreumProgress(visits, list ?? []), [visits, list])
  if (!list) return null
  return (
    <section className="breakdown mb-4" data-testid="progress-breakdown" aria-label="형태·지역별 진행률">
      <Bars title="형태별" rows={byForm(list, p.visitedIds)} testid="breakdown-form" />
      <Bars title="지역별 (3D 지도의 지역 이름표)" rows={regionProgress(list, p.visitedIds).map((r) => ({ ...r, label: `${r.area} · ${r.label}` }))} testid="breakdown-city" />
    </section>
  )
}
