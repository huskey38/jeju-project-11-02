// 한국관광공사 TourAPI (국문 관광정보 서비스 KorService2)
const BASE = 'https://apis.data.go.kr/B551011/KorService2';

// 이미지 주소가 http:// 로 오는데, https 로 배포하면 브라우저가 막으므로(mixed content) https 로 바꿉니다
const https = (url) => (url ? url.replace(/^http:\/\//, 'https://') : url);

export async function searchTour({ keyword = '', contentTypeId = '12', rows = 10, page = 1 } = {}) {
  const params = new URLSearchParams({
    serviceKey: process.env.DATA_GO_KR_KEY, // ★ Decoding 키
    MobileOS: 'ETC',
    MobileApp: 'JejuIP',
    _type: 'json',
    numOfRows: String(rows),
    pageNo: String(page),
    // 법정동 지역코드 50 = 제주. 옛 areaCode=39 는 데이터 일부만 잡힘 (관광지 132 vs 557건, 축제는 0 vs 27건)
    lDongRegnCd: '50',
  });
  if (contentTypeId) params.set('contentTypeId', contentTypeId);
  const op = keyword ? 'searchKeyword2' : 'areaBasedList2';
  if (keyword) params.set('keyword', keyword);

  const r = await fetch(`${BASE}/${op}?${params}`);
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); }
  catch { throw new Error('TourAPI 응답이 JSON이 아님: ' + text.slice(0, 120)); }

  const item = data?.response?.body?.items?.item;
  const list = !item ? [] : Array.isArray(item) ? item : [item];
  return list.map((p) => ({
    id: p.contentid, title: p.title, addr: p.addr1,
    image: https(p.firstimage), lng: p.mapx, lat: p.mapy, type: p.contenttypeid,
  }));
}
