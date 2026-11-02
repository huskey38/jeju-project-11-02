// 제주도내 공연장 현황 — 파일 데이터(CSV)를 server/data/venues.js 로 변환해 둔 것을 조회합니다 (API 호출 없음)
import venues from './data/venues.js';

// TourAPI 항목(문화시설 14)과 같은 모양으로 맞춰 목록에 섞어 쓸 수 있게 함. 좌표는 지오코딩 전에는 빈 값
const toItem = (v) => ({
  id: v.id, title: v.name, addr: v.addr, image: '',
  lat: v.lat ?? '', lng: v.lng ?? '', type: '14', lcls: '',
  kindName: v.kind, // 공공 / 민간
});

// 공연장명·주소에 검색어가 들어 있는 공연장을 쪽 단위로
export function searchVenues({ keyword = '', rows = 12, page = 1 } = {}) {
  const kw = String(keyword).trim().toLowerCase();
  const list = venues.filter((v) => !kw || `${v.name} ${v.addr}`.toLowerCase().includes(kw));
  return list.slice((page - 1) * rows, page * rows).map(toItem);
}

export function getVenueDetail({ id } = {}) {
  const v = venues.find((x) => x.id === id);
  if (!v) throw new Error('공연장을 찾을 수 없어요');
  const row = (label, value) => ({ label, value });
  return {
    ...toItem(v),
    info: [
      row('소재지', v.addr),
      row('시설구분', [v.kind, v.note].filter(Boolean).join(' · ')),
      v.type && row('공연 형태', v.type),
      v.open && row('개관일', v.open),
      row('자료 기준', `${v.base} 기준 (이후 변경은 반영되지 않았을 수 있어요)`),
    ].filter((r) => r && r.value),
  };
}
