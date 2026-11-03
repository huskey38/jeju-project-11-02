// 공공데이터 응답의 HTML 조각을 화면용 텍스트로 정리하는 함수들 (화면에서 HTML 로 렌더링하지 않음 → XSS 방지)

// <br>·문단 끝은 줄바꿈으로, 나머지 태그는 제거, 기본 엔티티 복원
export function htmlToText(html = '') {
  return String(html ?? '')
    .replace(/<(br|\/p|\/div|\/li)\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// '<a href="https://...">https://...</a>' 같은 홈페이지 필드에서 주소만 꺼냄 (http/https 만 허용)
export function extractUrl(html = '') {
  const s = String(html ?? '');
  const m = s.match(/href\s*=\s*["']([^"']+)["']/i)?.[1] ?? s.replace(/<[^>]*>/g, '').trim();
  if (/^https?:\/\//i.test(m)) return m;
  if (/^www\./i.test(m)) return `https://${m}`;
  return '';
}

// 20260404 → 2026-04-04
export const fmtDate = (s) => (/^\d{8}$/.test(String(s ?? '')) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : '');

// '2026-11-02' 또는 '20261102' → '20261102' (형식이 아니면 '')
export const ymd = (s) => {
  const m = String(s ?? '').match(/^(\d{4})-?(\d{2})-?(\d{2})$/);
  return m ? m[1] + m[2] + m[3] : '';
};

// 오늘 날짜(한국 시간) 'YYYYMMDD'
export const todayKst = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10).replaceAll('-', '');

export const https =(url) => (url ? String(url).replace(/^http:\/\//, 'https://') : '');

// fetch 가 네트워크 오류(fetch failed 등 일시적 끊김)로 던지면 한 번 더 시도. 서버가 준 오류 응답(4xx·5xx)은 그대로 돌려줌
export async function fetchRetry(url, options) {
  try { return await fetch(url, options) }
  catch { await new Promise((r) => setTimeout(r, 300)); return fetch(url, options) }
}
