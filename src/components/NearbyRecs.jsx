import { useEffect, useRef, useState } from 'react'
import { Button, Spinner } from 'react-bootstrap'
import { fetchNearby } from '../api/client'
import { RECOMMEND_GROUPS, RECOMMEND_RADII, fmtDist } from '../lib/placeCategories'

// 상세 모달 아래의 "근처 추천": 지금 보는 곳 좌표 주변을 가까운 순으로
//   mode 'spot' → 근처 음식점 · 카페 / mode 'food' → 근처 관광지
// onPick(item) 을 누르면 그 곳의 상세로 넘어감 (호출하는 쪽이 처리)
// onData(markers, radiusKm): 불러온 추천을 지도 핀으로 그릴 수 있게 부모에게 넘김 (카카오 지도에 핀·반경 원으로 표시)
export default function NearbyRecs({ lat, lng, mode, excludeId, onPick, onData }) {
  const groups = RECOMMEND_GROUPS[mode] ?? []
  const [radius, setRadius] = useState(RECOMMEND_RADII[0])
  const [state, setState] = useState({ loading: true, lists: {}, errors: {} })
  const dataCb = useRef(onData)
  dataCb.current = onData

  // 좌표(=보는 곳)·반경이 바뀌면 다시 불러옴. 늦게 온 이전 응답은 버림
  useEffect(() => {
    let alive = true
    setState({ loading: true, lists: {}, errors: {} })
    dataCb.current?.([], null)   // 반경을 바꾸거나 다른 곳으로 넘어가면 이전 핀을 먼저 치움
    Promise.allSettled(groups.map((g) =>
      // 자기 자신이 거리 0 으로 끼어 있을 수 있어 한 건 더 받아 걸러냄
      fetchNearby({ lat, lng, radius: radius * 1000, ...g.query, rows: g.count + 1 }),
    )).then((res) => {
      if (!alive) return
      const lists = {}, errors = {}
      res.forEach((r, i) => {
        const g = groups[i]
        if (r.status === 'fulfilled') lists[g.key] = r.value.filter((p) => String(p.id) !== String(excludeId)).slice(0, g.count)
        else errors[g.key] = r.reason?.message ?? '불러오지 못했어요'
      })
      setState({ loading: false, lists, errors })
      dataCb.current?.(groups.flatMap((g) => (lists[g.key] ?? []).map((p) => ({ id: p.id, title: p.title, lat: p.lat, lng: p.lng, group: g.key, item: p }))), radius)
    })
    return () => { alive = false }
  }, [lat, lng, radius, mode, excludeId])

  const total = groups.reduce((n, g) => n + (state.lists[g.key]?.length ?? 0), 0)
  const wider = RECOMMEND_RADII.find((r) => r > radius)

  return (
    <section className="nearby-recs mt-4" data-testid="nearby-recs" aria-label="근처 추천">
      <div className="d-flex align-items-center justify-content-between mb-2">
        <h6 className="fw-bold mb-0"><i className="bi bi-compass me-2 text-primary" />이 근처 추천 <span className="text-muted fw-normal small">· 반경 {radius}km</span></h6>
        {wider && !state.loading && (total > 0
          ? <Button variant="link" size="sm" className="p-0" onClick={() => setRadius(wider)}>{wider}km로 넓히기</Button>
          : null)}
      </div>

      {state.loading && <div className="small text-muted"><Spinner size="sm" className="me-2" />근처를 찾는 중...</div>}

      {!state.loading && groups.map((g) => (
        <div key={g.key} className="mb-3" data-testid={`recs-${g.key}`}>
          <div className="small fw-bold mb-2 text-body-secondary"><i className={`bi bi-${g.icon} me-1`} />{g.title}</div>
          {state.errors[g.key] ? <div className="small text-danger">{state.errors[g.key]}</div>
            : !state.lists[g.key]?.length ? <div className="small text-muted">반경 {radius}km 안에는 없어요
                {wider && total > 0 && <Button variant="outline-primary" size="sm" className="rounded-pill ms-2 py-0 px-2" onClick={() => setRadius(wider)}>{wider}km로 넓혀서 찾기</Button>}
              </div>
            : (
              <div className="rec-strip">
                {state.lists[g.key].map((p) => (
                  <button key={p.id} type="button" className="rec-card" onClick={() => onPick?.(p)} title={`${p.title} 상세 보기`}>
                    {p.image ? <img src={p.image} alt="" loading="lazy" /> : <span className="rec-ph"><i className="bi bi-image" /></span>}
                    <span className="rec-name">{p.title}</span>
                    <span className="rec-dist">{p.dist !== undefined ? fmtDist(p.dist) : ''}</span>
                  </button>
                ))}
              </div>
            )}
        </div>
      ))}

      {!state.loading && total === 0 && !Object.keys(state.errors).length && wider && (
        <div className="text-center py-2" data-testid="recs-widen">
          <div className="small text-muted mb-2">가까운 곳에는 없어요. 더 넓은 범위에서 찾아볼까요?</div>
          <Button variant="primary" size="sm" className="rounded-pill px-3" onClick={() => setRadius(wider)}><i className="bi bi-arrows-expand me-1" />{wider}km로 넓혀서 찾기</Button>
        </div>
      )}
    </section>
  )
}
