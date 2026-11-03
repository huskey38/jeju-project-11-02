import { useMemo, useState } from 'react'
import { Button } from 'react-bootstrap'
import { isJejuCoord } from '../lib/geo'
import { oreumProgress } from '../lib/oreumProgress'
import { fmtDist, nearestUnvisited, nextTier } from '../lib/oreumStats'
import { useOreums } from '../lib/useOreums'
import { useAppStore } from '../store/useAppStore'

// [기능 3] 다음 한 걸음: 다음 등급까지 남은 오름 수 + 내 주변(없으면 제주시청 기준) 안 가 본 오름 3곳. features.js 의 nextStep
const CITY_HALL = { lat: 33.4996, lng: 126.5312 }

export default function NextStep() {
  const visits = useAppStore((s) => s.visits)
  const { list } = useOreums()
  const [near, setNear] = useState(null)        // { rows, note }
  const [busy, setBusy] = useState(false)
  const p = useMemo(() => oreumProgress(visits, list ?? []), [visits, list])
  if (!list) return null
  const next = nextTier(p.count, p.total)

  function find() {
    setBusy(true)
    const show = (c, note) => { setNear({ rows: nearestUnvisited(list, p.visitedIds, c.lat, c.lng, 3), note }); setBusy(false) }
    if (!navigator.geolocation) return show(CITY_HALL, '위치 기능을 쓸 수 없어 제주시청 기준이에요')
    navigator.geolocation.getCurrentPosition(
      ({ coords: c }) => (isJejuCoord(c.latitude, c.longitude) ? show({ lat: c.latitude, lng: c.longitude }, '') : show(CITY_HALL, '현재 위치가 제주 밖이라 제주시청 기준이에요')),
      () => show(CITY_HALL, '위치 권한이 없어 제주시청 기준이에요'),
      { timeout: 8000 },
    )
  }

  return (
    <section className="nextstep mb-4" data-testid="nextstep" aria-label="다음 한 걸음">
      <div className="nextstep-line" data-testid="nextstep-line">
        <i className="bi bi-signpost-split-fill me-2 text-success" />
        {next
          ? <>다음 등급 <strong>{next.tier.title}</strong>까지 <strong className="text-warning-emphasis">{next.needCount}곳</strong> 남았어요 <span className="text-muted small">({next.tier.min}%~ · 총 {next.needTotal}곳)</span></>
          : <>가장 높은 등급이에요. 남은 <strong>{p.remaining}곳</strong>의 빈 깃대를 채워 보세요</>}
      </div>
      <div className="d-flex flex-wrap align-items-center gap-2 mt-2">
        <Button size="sm" variant="outline-success" className="rounded-pill px-3" onClick={find} disabled={busy} data-testid="nextstep-find">
          <i className="bi bi-geo-alt me-1" />{busy ? '찾는 중...' : '내 주변 안 가 본 오름 찾기'}
        </Button>
        {near?.note && <span className="small text-muted">{near.note}</span>}
      </div>
      {near && (
        <ul className="nextstep-list" data-testid="nextstep-list">
          {near.rows.map((o) => (
            <li key={o.id}><strong>{o.name}</strong><span className="text-muted small"> · {fmtDist(o.dist)}{o.elev ? ` · 표고 ${o.elev}m` : ''}{o.form ? ` · ${o.form.replace(/\(.*\)/, '')}` : ''}</span></li>
          ))}
          {near.rows.length === 0 && <li className="text-muted">안 가 본 오름이 없어요 🎉</li>}
        </ul>
      )}
    </section>
  )
}
