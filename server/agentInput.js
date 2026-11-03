// AI 에이전트(/api/agent)에 들어오는 값 검사 — 잘못된 형식·너무 긴 글은 Claude 에 보내기 전에 막음 (비용·오남용 방지)
export const MAX_MESSAGE = 500       // 질문 한 번의 최대 글자 수
export const MAX_HISTORY = 10        // 이전 대화는 최근 10개만 (안내서의 비용 규칙)
export const MAX_HISTORY_TEXT = 2000 // 이전 대화 한 개의 최대 글자 수(넘으면 잘라서 보냄)

// body → { ok: true, message, history } | { ok: false, error }
export function parseAgentInput(body) {
  if (!body || typeof body !== 'object') return { ok: false, error: '질문을 보내 주세요' }
  const { message, history } = body
  if (typeof message !== 'string' || !message.trim()) return { ok: false, error: '질문을 입력해 주세요' }
  const text = message.trim()
  if (text.length > MAX_MESSAGE) return { ok: false, error: `질문은 ${MAX_MESSAGE}자 이내로 입력해 주세요` }

  if (history !== undefined && history !== null && !Array.isArray(history)) return { ok: false, error: '대화 기록 형식이 올바르지 않아요' }
  const recent = (history ?? []).slice(-MAX_HISTORY)
  const clean = []
  for (const h of recent) {
    if (!h || typeof h !== 'object' || (h.role !== 'user' && h.role !== 'assistant') || typeof h.content !== 'string') {
      return { ok: false, error: '대화 기록 형식이 올바르지 않아요' }
    }
    const content = h.content.trim().slice(0, MAX_HISTORY_TEXT)
    if (content) clean.push({ role: h.role, content })   // 빈 내용은 Claude 가 거절하므로 뺌
  }
  while (clean.length && clean[0].role !== 'user') clean.shift()   // 대화는 사용자 말로 시작해야 함 (최근 10개로 자르면 답변부터 시작할 수 있음)
  return { ok: true, message: text, history: clean }
}

// 요청한 사람의 주소(IP): Vercel 은 x-forwarded-for 에 실어 줌. 알 수 없으면 null
export function clientIp(req) {
  const fwd = String(req?.headers?.['x-forwarded-for'] ?? '').split(',')[0].trim()
  return fwd || req?.socket?.remoteAddress || null
}

// 아주 단순한 호출 제한(같은 IP 가 windowMs 안에 max 번까지). 서버 함수 한 개의 메모리 안에서만 세므로 완벽하지 않은 1차 방어선
export function createLimiter({ max, windowMs, now = Date.now }) {
  const hits = new Map()
  return function check(key) {
    const t = now()
    const recent = (hits.get(key) ?? []).filter((x) => t - x < windowMs)
    if (recent.length >= max) { hits.set(key, recent); return { ok: false, retryAfterSec: Math.max(1, Math.ceil((windowMs - (t - recent[0])) / 1000)) } }
    recent.push(t); hits.set(key, recent)
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((x) => t - x < windowMs)) hits.delete(k)   // 오래된 주소는 정리
    return { ok: true }
  }
}
