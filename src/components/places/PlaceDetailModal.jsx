import DetailModal from '../DetailModal'
import VisitPhoto from '../VisitPhoto'
import { FEATURES } from '../../lib/features'
import { badgeOf, recommendModeOf } from '../../lib/placeCategories'
import { favOf, oreumExtraRows } from '../../lib/placeItems'
import { useAppStore } from '../../store/useAppStore'

// 정보 카드(상세 모달): 항목 종류(국가유산·오름·음식점·공연장·관광지)마다 알맞은 DetailModal 을 만들어 줌 — Places 화면에서 분리했음
//   detail: { base, data?, error? } | trail: 돌아가기 기록 | onClose·onBack | onPick(항목): 근처 추천 항목 열기 | onMore(종류, 반경km, 기준): 음식점·카페 더 보기
export default function PlaceDetailModal({ detail, trail, onClose, onBack, onPick, onMore }) {
  const visits = useAppStore((s) => s.visits)
  const favorites = useAppStore((s) => s.favorites)
  const toggleVisit = useAppStore((s) => s.toggleVisit)
  const toggleFavorite = useAppStore((s) => s.toggleFavorite)
  const isVisited = (it) => { const f = favOf(it); return visits.some((x) => x.source === f.source && x.item_id === String(f.id)) }
  const isSaved = (it) => { const f = favOf(it); return favorites.some((x) => x.source === f.source && x.item_id === String(f.id)) }
  if (!detail) return null
  const b = detail.base, d = detail.data
  const prev = trail.at(-1)
  // 관광·문화 계열이면 근처 음식점·카페, 음식점·카페면 근처 관광지를 추천 (공연장은 좌표가 없어 없음)
  const mode = recommendModeOf(d?.type ? { ...b, type: d.type } : b)   // 가볼만한 곳에서 연 항목은 종류를 상세에서 알게 됨
  const recommend = mode && {
    mode, excludeId: b.kind === 'tour' ? b.id : undefined,
    onPick: (p) => onPick({ ...p, kind: 'tour', key: `t-${p.id}` }),
    onMore: mode === 'spot' && Number.isFinite(Number(d?.lat ?? b.lat)) && Number.isFinite(Number(d?.lng ?? b.lng))
      ? (kind, km) => onMore(kind, km, { lat: Number(d?.lat ?? b.lat), lng: Number(d?.lng ?? b.lng), name: d?.name ?? b.name ?? b.title ?? '' })
      : undefined,
  }
  const common = {
    show: true, onHide: onClose, loading: !d && !detail.error, error: detail.error, badge: badgeOf({ ...b, type: d?.type ?? b.type }),
    recommend, onBack: prev ? onBack : undefined, backLabel: prev && (prev.title ?? prev.name),
    visited: isVisited(b), onVisit: () => toggleVisit(favOf(b)),
  }
  return b.kind === 'heritage' ? (
    <DetailModal {...common}
      title={d?.name ?? b.name} subtitle={d?.hanja} badge={d ? badgeOf({ ...b, kindName: d.kind }) : common.badge}
      images={d?.image ? [d.image] : []}
      rows={d?.info ?? [{ label: '지역', value: b.city }]} text={d?.content}
      lat={d?.lat ?? b.lat} lng={d?.lng ?? b.lng}
      saved={isSaved(b)} onSave={() => toggleFavorite(favOf(b))} />
  ) : b.kind === 'oreum' ? (
    <DetailModal {...common} badge={badgeOf(b)}
      title={b.title} subtitle={b.addr}
      images={d?.images?.length ? d.images : b.image ? [b.image] : []}
      extra={FEATURES.visitPhoto && isVisited(b) ? <VisitPhoto oreumId={b.id} /> : undefined}
      imageCredit={d?.images?.length ? '한국관광공사' : b.imageCredit}   // 상세 사진은 관광공사 TourAPI
      rows={[
        { label: '행정시', value: b.city }, { label: '표고', value: b.elev != null ? `${b.elev}m` : '' },
        { label: '면적', value: b.area != null ? `${b.area.toLocaleString('ko-KR')}㎡` : '' },
        { label: '형태', value: b.form }, ...(d?.info ?? []),
        ...oreumExtraRows(b, !d?.overview),
      ].filter((r) => r.value)}
      homepage={d?.homepage} text={d?.overview || b.intro}
      lat={b.lat} lng={b.lng}
      saved={isSaved(b)} onSave={() => toggleFavorite(favOf(b))} />
  ) : b.kind === 'rest' ? (
    <DetailModal {...common} badge={badgeOf({ ...b, biz: d?.biz ?? b.biz })}
      title={d?.title ?? b.title} subtitle={d?.addr ?? b.addr} rows={d?.info}
      lat={d?.lat ?? b.lat} lng={d?.lng ?? b.lng}
      saved={isSaved(b)} onSave={() => toggleFavorite(favOf(b))} />
  ) : b.kind === 'venue' ? (
    <DetailModal {...common}
      title={d?.title ?? b.title} subtitle={d?.addr ?? b.addr} rows={d?.info}
      lat={d?.lat ?? b.lat} lng={d?.lng ?? b.lng}
      saved={isSaved(b)} onSave={() => toggleFavorite(favOf(b))} />
  ) : (
    <DetailModal {...common}
      title={d?.title ?? b.title} subtitle={d?.addr ?? b.addr}
      images={d?.images?.length ? d.images : b.image ? [b.image] : []}
      rows={d?.info} homepage={d?.homepage} text={d?.overview}
      lat={d?.lat ?? b.lat} lng={d?.lng ?? b.lng} visitFrom={b.start}
      saved={isSaved(b)} onSave={() => toggleFavorite(favOf(b))} />
  )
}
