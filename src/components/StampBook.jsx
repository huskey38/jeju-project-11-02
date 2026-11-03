import { useMemo, useState } from 'react'
import { Button } from 'react-bootstrap'
import { oreumProgress } from '../lib/oreumProgress'
import { fmtDate, visitDates } from '../lib/oreumStats'
import { formGroupOf } from '../lib/oreumForms'
import { useOreums } from '../lib/useOreums'
import { useAppStore } from '../store/useAppStore'
import { FEATURES } from '../lib/features'
import { usePhotoStore } from '../store/usePhotoStore'
import OreumArt from './OreumArt'
import VisitPhoto from './VisitPhoto'

// [기능 1] 오름 도감(스탬프 북): 공식 오름을 한 칸씩 — 가본 오름은 컬러 그림 + 방문일 스탬프, 안 간 오름은 회색 윤곽. features.js 의 stampBook
const PAGE = 24
const FILTERS = [['all', '전체'], ['done', '가본 오름'], ['todo', '안 간 오름']]

export default function StampBook() {
  const visits = useAppStore((s) => s.visits)
  const { list } = useOreums()
  const photos = usePhotoStore((s) => s.photos)   // 내 인증사진 (visitPhoto 스위치)
  const [filter, setFilter] = useState('all')
  const [shown, setShown] = useState(PAGE)

  const p = useMemo(() => oreumProgress(visits, list ?? []), [visits, list])
  const dates = useMemo(() => visitDates(visits, list ?? []), [visits, list])
  const rows = useMemo(() => (list ?? []).filter((o) => filter === 'all' || (filter === 'done') === p.visitedIds.has(String(o.id))), [list, filter, p])
  if (!list) return null

  return (
    <section className="stampbook mb-4" data-testid="stampbook" aria-label="오름 도감">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
        <h2 className="h6 fw-bold mb-0"><i className="bi bi-journal-bookmark-fill me-2 text-warning" />오름 도감 <span className="text-muted fw-normal small">{p.count} / {p.total}쪽 채움</span></h2>
        <div className="d-flex gap-1" role="group" aria-label="도감 보기">
          {FILTERS.map(([k, label]) => (
            <Button key={k} size="sm" className="rounded-pill px-3" variant={filter === k ? 'success' : 'outline-success'} aria-pressed={filter === k}
              onClick={() => { setFilter(k); setShown(PAGE) }}>{label}</Button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? <div className="small text-muted py-3 text-center">{filter === 'done' ? '아직 채운 쪽이 없어요 — 가본 오름에 체크하면 이곳에 스탬프가 찍혀요' : '모든 쪽을 채웠어요!'}</div> : (
        <div className="stamp-grid">
          {rows.slice(0, shown).map((o) => {
            const done = p.visitedIds.has(String(o.id))
            const form = formGroupOf(o.form)
            return (
              <div key={o.id} className={`stamp-tile${done ? ' is-done' : ''}`} data-testid={done ? 'stamp-done' : 'stamp-todo'}>
                {FEATURES.visitPhoto && done && photos[o.id]
                  ? <img src={photos[o.id].url} alt={`${o.name} 인증사진`} className="stamp-art stamp-photo" data-testid="stamp-photo" />
                  : <OreumArt form={o.form} elev={o.elev} className="stamp-art" />}
                {FEATURES.visitPhoto && done && <VisitPhoto oreumId={o.id} compact />}
                <div className="stamp-info">
                  <div className="stamp-name">{o.name}</div>
                  <div className="stamp-meta">{form.key !== 'etc' ? form.label : '기타'}{o.elev ? ` · ${o.elev}m` : ''}</div>
                </div>
                {done
                  ? <div className="stamp-mark" aria-label="가본 오름"><span>{dates.get(String(o.id)) ? fmtDate(dates.get(String(o.id))) : '완료'}</span></div>
                  : <div className="stamp-no">No.{o.id}</div>}
              </div>
            )
          })}
        </div>
      )}
      {rows.length > shown && (
        <div className="text-center mt-3"><Button size="sm" variant="outline-secondary" className="rounded-pill px-4" onClick={() => setShown((n) => n + PAGE)}>더 보기 ({rows.length - shown}쪽 남음)</Button></div>
      )}
    </section>
  )
}
