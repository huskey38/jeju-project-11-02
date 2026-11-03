import { Button } from 'react-bootstrap'
import OreumMark from '../OreumMark'
import { FEATURES } from '../../lib/features'
import { SORTS } from '../../lib/placeItems'

// 오름 찾기: 검색창 아래 정렬 줄(+ 안 오른 오름만, 추천순 안내) — Places 화면에서 분리했음 (오름 찾기에서만 쓰임)
export default function OreumSortBar({ nearOn, sort, unvisited, keyword, onPickSort, onPickUnvisited }) {
  return (
    <div className="mb-4">
      <div className="d-flex flex-wrap align-items-center gap-2 mb-1 ps-1 small" data-testid="form-bar">
        {!nearOn && (
          <span className="d-flex align-items-center gap-1" role="group" aria-label="정렬" data-testid="sort-bar">
            <span className="text-muted"><i className="bi bi-sort-down me-1" />정렬</span>
            {SORTS.map((o) => (
              <Button key={o.key} size="sm" variant="link" className={`p-0 me-1 ${sort === o.key ? 'fw-bold' : 'text-muted'}`} aria-pressed={sort === o.key} onClick={() => onPickSort(o.key)}>{o.label}</Button>
            ))}
          </span>
        )}
        {FEATURES.visitedFilter && (
          <Button size="sm" className="rounded-pill px-2 ms-auto" variant={unvisited ? 'success' : 'outline-success'} aria-pressed={unvisited} onClick={onPickUnvisited} data-testid="unvisited-toggle">
            <OreumMark size={15} className="me-1" style={{ verticalAlign: '-3px' }} />안 오른 오름만
          </Button>
        )}
      </div>
      {!nearOn && sort === '' && !keyword.trim() && (
        <div className="small text-muted ps-1 mb-0" data-testid="sort-note"><i className="bi bi-stars me-1" />추천순 — 널리 알려진 <strong>대표 오름 12곳</strong>이 먼저, 이어서 사진이 있고 <strong>가볍게 오를 수 있는(400m 이하)</strong> 오름 순이에요.</div>
      )}
    </div>
  )
}
