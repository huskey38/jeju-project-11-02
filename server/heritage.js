// 국가유산청 국가유산 오픈API (키 불필요, XML 응답)
import { XMLParser } from 'fast-xml-parser';
import { fetchRetry, htmlToText, https } from './text.js';

// 지정번호('0003220000000')의 앞자리 0 이 숫자 변환으로 사라지지 않도록 값을 문자열 그대로 읽음
const parser = new XMLParser({ parseTagValue: false });

const toList = (item) => (!item ? [] : Array.isArray(item) ? item : [item]);

export async function searchHeritage({ keyword = '', rows = 10, page = 1 } = {}) {
  const params = new URLSearchParams({ ccbaCtcd: '50', pageUnit: String(rows), pageIndex: String(page) }); // 50 = 제주
  if (keyword) params.set('ccbaMnm1', keyword);
  const r = await fetchRetry(`https://www.khs.go.kr/cha/SearchKindOpenapiList.do?${params}`);
  const data = parser.parse(await r.text());
  return toList(data?.result?.item).map((h) => ({
    name: h.ccbaMnm1, kind: h.ccmaName, city: h.ccsiName,
    lat: Number(h.latitude) || 0, lng: Number(h.longitude) || 0,
    kdcd: h.ccbaKdcd, asno: h.ccbaAsno, ctcd: h.ccbaCtcd, // 상세 조회용 코드
  }));
}

// 상세: 설명·사진·지정일·소재지 등
export async function getHeritageDetail({ kdcd, asno, ctcd } = {}) {
  if (!kdcd || !asno || !ctcd) throw new Error('kdcd, asno, ctcd 가 필요해요');
  const params = new URLSearchParams({ ccbaKdcd: kdcd, ccbaAsno: asno, ccbaCtcd: ctcd });
  const r = await fetchRetry(`https://www.khs.go.kr/cha/SearchKindOpenapiDt.do?${params}`);
  const data = parser.parse(await r.text());
  const h = data?.result?.item;
  if (!h) throw new Error('국가유산을 찾을 수 없어요');
  const asdt = String(h.ccbaAsdt ?? '');
  const row = (label, value) => ({ label, value: htmlToText(value) });
  return {
    name: h.ccbaMnm1, hanja: h.ccbaMnm2 || '', kind: h.ccmaName,
    lat: Number(data.result.latitude) || 0, lng: Number(data.result.longitude) || 0,
    image: https(h.imageUrl),
    content: htmlToText(h.content),
    info: [
      row('소재지', h.ccbaLcad), row('시대', h.ccceName),
      row('분류', [h.gcodeName, h.bcodeName, h.mcodeName, h.scodeName].filter(Boolean).join(' > ')),
      row('수량', h.ccbaQuan),
      { label: '지정일', value: /^\d{8}$/.test(asdt) ? `${asdt.slice(0, 4)}-${asdt.slice(4, 6)}-${asdt.slice(6, 8)}` : '' },
      row('소유', h.ccbaPoss), row('관리', h.ccbaAdmin),
    ].filter((x) => x.value),
  };
}
