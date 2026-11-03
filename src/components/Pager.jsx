import { Pagination } from 'react-bootstrap'
import { pageList } from '../lib/paging'

// 목록 아래 쪽 번호: ‹ 1 2 3 … 31 › — 누르면 그 쪽으로 이동. 현재 쪽은 강조
export default function Pager({ page, pages, onPage, disabled = false }) {
  if (pages <= 1) return null
  const go = (n) => { if (!disabled && n >= 1 && n <= pages && n !== page) onPage(n) }
  return (
    <Pagination className="justify-content-center flex-wrap mb-0" size="sm" data-testid="pager" aria-label="쪽 이동">
      <Pagination.Item disabled={disabled || page <= 1} onClick={() => go(page - 1)} aria-label="이전 쪽">‹</Pagination.Item>
      {pageList(page, pages).map((n, i) => (n === '…'
        ? <Pagination.Item key={`e${i}`} disabled aria-hidden="true">…</Pagination.Item>
        : <Pagination.Item key={n} active={n === page} disabled={disabled} onClick={() => go(n)} activeLabel="(현재 쪽)">{n}</Pagination.Item>))}
      <Pagination.Item disabled={disabled || page >= pages} onClick={() => go(page + 1)} aria-label="다음 쪽">›</Pagination.Item>
    </Pagination>
  )
}
