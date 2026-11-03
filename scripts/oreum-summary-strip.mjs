// 오름요약설명의 틀 문장 걷어내기: "비고 51m의", "원형 화구를 지닌 화산체이다.", "말굽형 형태의 오름." 등
// (화면에 이미 있는 비고·형태와 겹치는 부분) — 남는 이름 유래·특징만 돌려줌. 문장 주어가 잘려 읽을 수 없게 되면 '' (넣지 않음)
const FORM = String.raw`(?:원추형|원형|말굽형|복합형|삼각형|[가-힣]{1,3}형)(?:\([^)]*\))?`
// 형태 + (형태의) + (화구를) + (지닌/가진/이룬) + 화산체|오름 — 뒤에 '으로서' 같은 말이 이어지면 틀이 아니므로 떼지 않음
const TEMPLATE = new RegExp(String.raw`^${FORM}\s*(?:형태의\s*)?(?:화구를\s*|화구가\s*|굼부리를\s*)?(?:지닌\s*|가진\s*|이룬\s*|가지고 있는\s*)?(?:화산체|화구체|오름)(?=이다|입니다|[.\s,]|$)(?:이다|입니다)?[.\s]*`)
const LEAD_WORD = /^(?:화산체|오름)(?:이다|입니다)?\s*[.]\s*/                       // "오름. ..." 처럼 앞에 홀로 남은 말
const BROKEN_START = /^(?:으로|에 |에서 |의 |들을|을 |를 |이라|이다|라고)/               // 주어가 잘려 나간 문장

export function strip(text) {
  let t = String(text ?? '').trim().replace(/^비고\s*\d+\s*m\s*(?:의|인)?[\s.,]*/, '')
  for (let i = 0; i < 3; i++) t = t.replace(TEMPLATE, '').replace(LEAD_WORD, '').trim()
  t = t.replace(/^(?:이다|입니다)[.\s]*/, '').replace(/새-끼/g, '새끼').trim()
  if (!t || BROKEN_START.test(t)) return ''
  // 원본은 쉼표를 마침표로 쓴 곳이 많아("…없고. 전망도") 문장 끝이 아닌 마침표는 쉼표로 바꿈
  const parts = t.split(/\.(?!\d)\s*/).map((x) => x.trim()).filter(Boolean)
  let out = ''
  parts.forEach((seg, i) => {
    const last = i === parts.length - 1
    out += seg + (/(?:다|요|음|임|니다)$/.test(seg) || last ? '. ' : ', ')
  })
  out = out.trim().replace(/,$/, '.').replace(/\s+/g, ' ')
  return /[.!?]$/.test(out) ? out : out + '.'
}
