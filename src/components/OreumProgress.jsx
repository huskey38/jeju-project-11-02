import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { ProgressBar } from 'react-bootstrap'
import { fetchOreumAll } from '../api/client'
import { oreumProgress } from '../lib/oreumProgress'
import { useAppStore } from '../store/useAppStore'
import { Loading } from './Status'

// three.js 는 용량이 커서 '가본 곳' 탭을 열 때만 불러옴
const OreumJeju3D = lazy(() => import('./OreumJeju3D'))

// 가본 곳 탭 맨 위: 오름 등반률(가본 오름 ÷ 등록된 오름)과, 가본 오름마다 마크가 하나씩 꽂히는 3D 제주 지도
export default function OreumProgress() {
  const visits = useAppStore((s) => s.visits)
  const [oreums, setOreums] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    fetchOreumAll().then((list) => { if (alive) setOreums(list) }).catch((e) => { if (alive) setError(e.message) })
    return () => { alive = false }
  }, [])

  const p = useMemo(() => oreumProgress(visits, oreums ?? []), [visits, oreums])

  return (
    <section className="oreum-progress mb-4" data-testid="oreum-progress" aria-label="오름 등반률">
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-2 mb-2">
        <div>
          <div className="small text-muted"><i className="bi bi-flag-fill me-1 text-warning" />오름 등반률</div>
          <div className="oreum-count" data-testid="oreum-count">
            <strong>{p.count}</strong><span className="text-muted"> / {p.total || '–'}곳</span>
            <span className="oreum-percent ms-2" data-testid="oreum-percent">{p.percent}%</span>
          </div>
        </div>
        <div className="text-end">
          <span className="badge text-bg-warning" data-testid="oreum-tier">{p.tier.title}</span>
          <div className="small text-muted mt-1">{p.done ? '모든 오름에 마크를 찍었어요!' : p.tier.hint}</div>
        </div>
      </div>
      <ProgressBar now={p.percent} className="oreum-bar mb-3" aria-label="오름 등반률" />

      {error ? <div className="small text-muted">오름 목록을 불러오지 못했어요 ({error})</div> : !oreums ? <Loading text="오름 목록을 불러오는 중..." /> : (
        <>
          <div className="rounded-4 overflow-hidden border oreum-map">
            <Suspense fallback={<Loading text="3D 제주 지도를 불러오는 중..." />}>
              <OreumJeju3D oreums={oreums} visitedIds={p.visitedIds} height={420} />
            </Suspense>
          </div>
          <div className="small text-muted mt-2 d-flex flex-wrap gap-3">
            <span><span className="oreum-key oreum-key-done" />가본 오름 (깃발)</span>
            <span><span className="oreum-key oreum-key-todo" />아직 안 간 오름 {p.remaining}곳</span>
            <span className="ms-auto">마우스로 돌리고 확대해 보세요 · 마크에 올리면 이름이 보여요</span>
          </div>
        </>
      )}
    </section>
  )
}
