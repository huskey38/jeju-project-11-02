// 화면에 보이는 오류 문구: 배포(PROD)에서는 서버·공공데이터의 원문 오류(예: SERVICE_KEY_IS_NOT_REGISTERED_ERROR)를 감추고
// "잠시 후 다시 시도해 주세요"로 보여 줌. 개발 중(dev)에는 원인을 알 수 있게 원문을 그대로 보여 줌. 원문은 콘솔에 남김.
export const RETRY_MESSAGE = '잠시 후 다시 시도해 주세요'

// 사용량 한도(429)는 기다리라는 안내 자체가 유용해서 서버가 준 문구를 그대로 씀
export function friendlyMessage(status, raw, { prod = import.meta.env.PROD } = {}) {
  const text = String(raw ?? '').trim()
  if (!prod) return text || RETRY_MESSAGE
  if (status === 429 && text) return text
  return RETRY_MESSAGE
}
