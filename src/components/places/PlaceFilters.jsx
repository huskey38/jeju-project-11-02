import { Button } from 'react-bootstrap'
import { TAG_RULES } from '../../lib/placeTags'
import { RADII } from '../../lib/placeCategories'
import { HIDDEN_TAGS, tagsEnabled } from '../../lib/placeItems'

// 분류 아래의 필터 줄: 내 주변 반경 · 전체 목록 안내 · 음식 종류 · 테마(특징) 칩 — Places 화면에서 분리했음
//   값은 Places 가 주소(URL)에서 읽어 넘기고, 눌렀을 때의 동작(pick…)도 Places 가 넘김
export default function PlaceFilters({ cat, canNear, nearOn, radiusKm, locating, coords, origin, subs, sub, tags, onPickRadius, onFindMine, onPickSub, onPickTag, onClearTags }) {
  const subOn = (key) => sub === key
  return (
    <>
      {canNear && (
        <div className="d-flex flex-wrap align-items-center gap-2 mb-2 ps-1 small" data-testid="near-bar">
          <span className="text-muted"><i className="bi bi-crosshair me-1" />내 주변</span>
          <div className="d-flex gap-1" role="group" aria-label="내 주변 반경">
            {RADII.map((km) => (
              <Button key={km} size="sm" className="rounded-pill px-2" variant={radiusKm === km ? 'info' : 'outline-info'}
                aria-pressed={radiusKm === km} onClick={() => onPickRadius(km)}>{km}km</Button>
            ))}
          </div>
          {nearOn && (
            <>
              <span className="text-muted ms-2" data-testid="near-origin">
                <i className="bi bi-geo-alt me-1" />
                {locating ? '위치를 찾는 중...' : coords?.note ?? '내 현재 위치 기준 · 가까운 순'}
              </span>
              <Button size="sm" variant="link" className="p-0" onClick={onFindMine} disabled={locating}>{origin ? '내 위치 기준으로 보기' : '내 위치 다시 찾기'}</Button>
            </>
          )}
        </div>
      )}
      {(cat === 'food' || cat === 'cafe') && !nearOn && (
        <div className="small text-muted ps-1 mb-2" data-testid="food-link-note"><i className="bi bi-info-circle me-1" />제주 전체 {cat === 'food' ? '음식점이에요' : '카페예요'}. 오름 근처만 보려면 <strong>오름 카드를 열어 ‘근처 {cat === 'food' ? '음식점' : '카페'}’의 더 보기</strong>를 눌러 보세요.</div>
      )}
      {subs && (
        <div className="d-flex flex-wrap gap-2 mb-2 ps-1" role="group" aria-label="음식 종류">
          {subs.map((s) => (
            <Button key={s.key} size="sm" className="rounded-pill px-3" variant={subOn(s.key) ? 'info' : 'outline-info'}
              aria-pressed={subOn(s.key)} onClick={() => onPickSub(s.key)}>{s.label}</Button>
          ))}
        </div>
      )}

      {TAG_RULES[cat] && tagsEnabled(cat) && !nearOn && (
        <div className="d-flex flex-wrap align-items-center gap-2 mb-2 ps-1 small" role="group" aria-label="테마" data-testid="tag-bar">
          <span className="text-muted"><i className="bi bi-tags me-1" />{cat === 'oreum' ? '소개글 특징(관광공사 등록 오름)' : '테마'}</span>
          {TAG_RULES[cat].filter((t) => !HIDDEN_TAGS[cat]?.includes(t.key)).map((t) => (
            <Button key={t.key} size="sm" className="rounded-pill px-2" variant={tags.includes(t.key) ? 'info' : 'outline-info'}
              aria-pressed={tags.includes(t.key)} onClick={() => onPickTag(t.key)}>{t.label}</Button>
          ))}
          {tags.length > 0 && <Button size="sm" variant="link" className="p-0" onClick={onClearTags}>테마 해제</Button>}
        </div>
      )}
    </>
  )
}
