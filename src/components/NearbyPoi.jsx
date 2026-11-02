import { useEffect, useRef, useState } from 'react'
import { Button, Spinner } from 'react-bootstrap'
import { fetchPoi } from '../api/client'
import { fmtDist } from '../lib/placeCategories'

// 카카오 코드 → 화면 (편의점 CS2 · 주차장 PK6 · 주유소 OL7)
const CATS = [
  { code: 'CS2', label: '편의점', icon: 'shop', color: '#3f9bb0' },
  { code: 'PK6', label: '주차장', icon: 'p-square', color: '#6b6f9a' },
  { code: 'OL7', label: '주유소', icon: 'fuel-pump', color: '#c8553d' },
]
const RADII_M = [500, 1000]

// 정보 카드의 "주변 편의시설": 칩을 누르면 이 곳 좌표 주변의 편의점·주차장·주유소를 가까운 순으로 (카카오 장소 검색)
// onData(markers): 같은 지도에 핀으로 그리도록 부모에게 넘김 (칩을 끄면 빈 배열)
export default function NearbyPoi({ lat, lng, onData }) {
  const [cat, setCat] = useState(null)
  const [radius, setRadius] = useState(RADII_M[0])
  const [state, setState] = useState({ loading: false, list: [], error: '' })
  const dataCb = useRef(onData)
  dataCb.current = onData

  useEffect(() => {
    if (!cat) { setState({ loading: false, list: [], error: '' }); dataCb.current?.([]); return }
    let alive = true
    setState({ loading: true, list: [], error: '' })
    dataCb.current?.([])
    fetchPoi({ lat, lng, cat, radius }).then((list) => {
      if (!alive) return
      setState({ loading: false, list, error: '' })
      dataCb.current?.(list.map((p) => ({ id: `poi-${p.id}`, title: p.title, lat: p.lat, lng: p.lng, group: p.public ? 'PK6P' : cat, url: p.url })))   // 공영주차장은 초록 핀
    }).catch((e) => { if (alive) setState({ loading: false, list: [], error: e.message }) })
    return () => { alive = false }
  }, [cat, radius, lat, lng])
  useEffect(() => () => dataCb.current?.([]), [])   // 정보 카드를 닫거나 다른 곳으로 넘어가면 핀을 치움

  const cur = CATS.find((c) => c.code === cat)
  return (
    <section className="nearby-poi mt-3" data-testid="nearby-poi" aria-label="주변 편의시설">
      <div className="d-flex flex-wrap align-items-center gap-2 small">
        <span className="fw-bold"><i className="bi bi-pin-map me-1 text-primary" />주변 편의시설</span>
        {CATS.map((c) => (
          <Button key={c.code} size="sm" className="rounded-pill px-2" variant={cat === c.code ? 'info' : 'outline-info'}
            aria-pressed={cat === c.code} onClick={() => setCat(cat === c.code ? null : c.code)}>
            <i className={`bi bi-${c.icon} me-1`} />{c.label}
          </Button>
        ))}
        {cat && RADII_M.map((m) => (
          <Button key={m} size="sm" variant="link" className={`p-0 ${radius === m ? 'fw-bold' : 'text-muted'}`} onClick={() => setRadius(m)}>
            {m >= 1000 ? `${m / 1000}km` : `${m}m`}
          </Button>
        ))}
      </div>
      {cat && (
        <div className="mt-2">
          {state.loading && <div className="small text-muted"><Spinner size="sm" className="me-2" />찾는 중...</div>}
          {state.error && <div className="small text-muted">불러오지 못했어요 ({state.error})</div>}
          {!state.loading && !state.error && state.list.length === 0 && (
            <div className="small text-muted">{radius >= 1000 ? '1km' : `${radius}m`} 안에 {cur.label}이 없어요{radius < 1000 ? ' — 1km 로 넓혀 보세요' : ''}</div>
          )}
          {cat === 'PK6' && state.list.length > 0 && <div className="small text-muted mb-1">공영주차장을 먼저 보여줘요 (이름·분류에 '공영'이 든 곳)</div>}
          {state.list.length > 0 && (
            <ul className="list-unstyled mb-0 small poi-list">
              {state.list.map((p) => (
                <li key={p.id} className="d-flex align-items-baseline gap-2 py-1 border-bottom">
                  <span className="poi-dot" style={{ background: cur.color }} />
                  <span className="flex-grow-1">
                    {p.public && <span className="badge text-bg-success me-1">공영</span>}<strong>{p.title}</strong>
                    <span className="text-muted"> · {fmtDist(p.dist)}</span>
                    <div className="text-muted">{p.addr}{p.tel ? ` · ${p.tel}` : ''}</div>
                  </span>
                  {p.url && <a href={p.url} target="_blank" rel="noreferrer noopener" className="flex-shrink-0">카카오맵</a>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
