import { useMemo } from 'react'
import { ProgressBar } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { oreumProgress } from '../lib/oreumProgress'
import { useAppStore } from '../store/useAppStore'

// [기능 6] 메인 소개의 '내 걸음' 한 줄: 닉네임이 있으면 내 진행(N / 전체 · 등급), 없으면 첫 걸음 안내. features.js 의 homeProgress
// oreums: 소개 블록이 이미 불러온 오름 목록 (null 이면 아직 로딩 중)
export default function MyStepLine({ oreums }) {
  const nickname = useAppStore((s) => s.nickname)
  const visits = useAppStore((s) => s.visits)
  const p = useMemo(() => oreumProgress(visits, oreums ?? []), [visits, oreums])
  if (!oreums) return null
  return (
    <div className="mystep" data-testid="mystep">
      {nickname && p.count > 0 ? (
        <>
          <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
            <span className="fw-bold">내 걸음 <span data-testid="mystep-count">{p.count} / {p.total}곳</span></span>
            <span className="badge tier-badge" data-testid="mystep-tier" style={{ '--tier-bg': '#fde7c9', '--tier-fg': '#9a5208' }}>{p.tier.title}</span>
            <Link to="/places?cat=visited" className="small ms-auto">가본 곳 보기 →</Link>
          </div>
          <ProgressBar now={p.percent} className="oreum-bar" aria-label="내 걸음" />
        </>
      ) : (
        <div className="small"><i className="bi bi-signpost-2 me-1" />아직 첫 걸음 전이에요 — 가고 싶은 오름의 <strong>체크 버튼</strong>을 눌러 첫 깃발을 꽂아 보세요 <span className="text-muted">(처음엔 닉네임을 만들어요)</span></div>
      )}
    </div>
  )
}
