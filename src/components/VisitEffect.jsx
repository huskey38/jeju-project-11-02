import { useEffect, useRef, useState } from 'react'
import { oreumIdOf, oreumProgress, TIERS } from '../lib/oreumProgress'
import { useOreums } from '../lib/useOreums'
import { useAppStore } from '../store/useAppStore'
import TierEmblem from './TierEmblem'

// [기능 4] 깃발 꽂는 순간 연출: 가본 곳에 오름을 새로 기록하면 "N번째 오름 정상 도착!" 카드가 뜨고, 등급이 오르면 엠블럼과 함께 축하 효과. features.js 의 visitEffect
// 스토어의 lastVisit(기록 직후 한 번 바뀜)을 보고 움직이며, 처음 불러오기·삭제·오름 아닌 기록에는 반응하지 않음
const SHOW_MS = 4200
const PIECES = Array.from({ length: 16 }, (_, i) => i)

export default function VisitEffect() {
  const visits = useAppStore((s) => s.visits)
  const lastVisit = useAppStore((s) => s.lastVisit)
  const { list } = useOreums()
  const [fx, setFx] = useState(null)
  const prev = useRef({ count: null, visit: null })

  useEffect(() => {
    if (!list) return
    const p = oreumProgress(visits, list)
    const before = prev.current
    const isNew = lastVisit && lastVisit !== before.visit && oreumIdOf({ source: lastVisit.source, item_id: lastVisit.item_id }, list) !== null
    if (isNew && before.count !== null && p.count > before.count) {
      const level = TIERS.indexOf(p.tier), levelBefore = TIERS.indexOf(oreumProgress(visits.slice(1), list).tier)   // 새 기록은 맨 앞에 쌓이므로 그것만 뺀 등급과 비교
      setFx({ id: lastVisit.at, count: p.count, total: p.total, title: lastVisit.title, tier: p.tier, level, up: level > levelBefore })
    }
    prev.current = { count: p.count, visit: lastVisit }
  }, [visits, lastVisit, list])

  useEffect(() => {
    if (!fx) return
    const t = setTimeout(() => setFx(null), SHOW_MS)
    return () => clearTimeout(t)
  }, [fx])

  if (!fx) return null
  return (
    <div className={`visit-fx${fx.up ? ' is-up' : ''}`} role="status" aria-live="polite" data-testid="visit-fx" onClick={() => setFx(null)}>
      {fx.up && <div className="fx-confetti" aria-hidden="true">{PIECES.map((i) => <span key={i} style={{ '--i': i }} />)}</div>}
      <TierEmblem level={fx.level} size={fx.up ? 72 : 52} title={fx.tier.title} />
      <div className="fx-text">
        <div className="fx-title">🚩 {fx.count}번째 오름{fx.title ? ` · ${fx.title}` : ''} 정상 도착!</div>
        <div className="fx-sub" data-testid="visit-fx-sub">{fx.up ? <>등급 UP! <strong>{fx.tier.title}</strong></> : `${fx.total - fx.count}곳 남았어요 — 다음 걸음도 응원해요`}</div>
      </div>
    </div>
  )
}
