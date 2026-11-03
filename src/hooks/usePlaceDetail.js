import { useRef, useState } from 'react'
import { fetchHeritage, fetchHeritageDetail, fetchOreumById, fetchPlaceDetail, fetchRestaurantDetail, fetchVenueDetail } from '../api/client'
import { useAppStore } from '../store/useAppStore'

// 상세(정보 카드) 열기: 목록 항목을 누르면 목록 정보를 먼저 보여 주고 상세를 불러오며, 근처 추천을 타고 넘어간 길(돌아가기)을 기억 — Places 화면에서 분리했음
export function usePlaceDetail() {
  const toast = useAppStore((s) => s.toast)
  const [detail, setDetail] = useState(null)             // 열린 상세: { base(목록 항목), data?, error? }
  const [trail, setTrail] = useState([])                 // 근처 추천을 타고 넘어온 이전 장소들 (돌아가기용)
  const detailReq = useRef(0)                            // 장소를 빠르게 넘길 때 늦게 온 이전 응답을 버리기 위한 번호

  // 카드 클릭 → 목록 정보를 먼저 보여주고 상세를 불러옴
  //   fromRec: "근처 추천"에서 넘어온 것 → 지금 보던 곳을 기록에 쌓아 "돌아가기"를 가능하게 함
  //   keepTrail: 돌아가기로 연 것 → 기록을 그대로 둠 (둘 다 아니면 새로 시작하므로 기록을 비움)
  async function openDetail(it, { fromRec = false, keepTrail = false } = {}) {
    const id = ++detailReq.current
    if (fromRec && detail) setTrail((t) => [...t, detail.base])
    else if (!keepTrail) setTrail([])
    setDetail({ base: it })
    try {
      const data = it.kind === 'heritage' ? await fetchHeritageDetail(it)
        : it.kind === 'venue' ? await fetchVenueDetail(it.id)
        : it.kind === 'rest' ? await fetchRestaurantDetail(it.id)
        : it.kind === 'oreum' ? (it.tourId ? await fetchPlaceDetail(it.tourId).catch(() => ({})) : {})   // 관광공사에 등록된 오름만 사진·소개글(실패해도 공식 정보는 보임)
        : await fetchPlaceDetail(it.id)
      if (id === detailReq.current) setDetail({ base: it, data })
    } catch (err) { if (id === detailReq.current) setDetail({ base: it, error: err.message }) }
  }
  // 가볼만한 곳(저장된 행)을 눌렀을 때: 저장된 건 source·id·제목뿐이라, 종류별로 상세를 열 수 있는 항목으로 되살림
  async function openSaved(f) {
    if (f.source === 'heritage') {   // 국가유산은 상세 조회에 지정번호가 필요해서 이름으로 다시 찾음
      try {
        const list = await fetchHeritage(f.title, 1, 5)
        const h = list.find((x) => x.name === f.title) ?? list[0]
        if (!h) return toast('국가유산 정보를 찾지 못했어요', 'warning')
        return openDetail({ ...h, kind: 'heritage', key: `h-${h.asno}`, kindName: h.kind })
      } catch (err) { return toast(err.message, 'danger') }
    }
    if (f.source === 'venue') return openDetail({ id: f.item_id, title: f.title, addr: '', kind: 'venue', key: `v-${f.item_id}` })
    if (f.source === 'rest') return openDetail({ id: f.item_id, title: f.title, addr: '', kind: 'rest', key: `r-${f.item_id}` })
    if (f.source === 'oreum') {   // 공식 연번으로 저장한 오름(관광공사에 없는 곳)
      try {
        const o = await fetchOreumById(f.item_id)
        return o ? openDetail({ ...o, kind: 'oreum', key: `o-${o.id}` }) : toast('오름 정보를 찾지 못했어요', 'warning')
      } catch (err) { return toast(err.message, 'danger') }
    }
    return openDetail({ id: f.item_id, title: f.title, kind: 'tour', key: `t-${f.item_id}` })
  }
  function closeDetail() { detailReq.current++; setDetail(null); setTrail([]) }
  function goBack() {
    const prev = trail.at(-1)
    if (!prev) return
    setTrail((t) => t.slice(0, -1))
    openDetail(prev, { keepTrail: true })
  }

  return { detail, trail, openDetail, openSaved, closeDetail, goBack }
}
