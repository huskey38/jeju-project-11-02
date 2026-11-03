// 오름 '형태'(공식 오름현황의 분화구 모양) 묶음: 원본은 '말굽형(북동향)' 처럼 방향까지 들어 있어 화면에서는 큰 종류로 묶어 보여줌
export const FORM_GROUPS = [
  { key: 'cone', label: '원추형', test: (f) => /^원추/.test(f) },
  { key: 'round', label: '원형', test: (f) => /^원형/.test(f) },
  { key: 'horseshoe', label: '말굽형', test: (f) => /^말굽/.test(f) },
  { key: 'mixed', label: '복합형', test: (f) => /^복합/.test(f) },
]
// 위 네 가지가 아닌 것(예: 삼각형·화구 없음 등)
const isOther = (f) => !FORM_GROUPS.some((g) => g.test(f))
export const FORM_OTHER = { key: 'etc', label: '기타', test: isOther }
export const ALL_FORMS = [...FORM_GROUPS, FORM_OTHER]

export const formGroupOf = (form) => ALL_FORMS.find((g) => g.test(String(form ?? ''))) ?? FORM_OTHER
export const matchesForm = (form, key) => !key || (ALL_FORMS.find((g) => g.key === key)?.test(String(form ?? '')) ?? false)

// 형태별 한 줄 설명 (메인 소개 카드·형태 칩의 말풍선)
export const FORM_DESC = {
  cone: '원뿔처럼 봉우리가 뾰족하게 솟은 오름',
  round: '정상이 둥글고 부드러운 오름',
  horseshoe: '분화구 한쪽이 터져 말굽 모양인 오름',
  mixed: '봉우리·분화구가 여럿 겹친 오름',
}

// 말풍선에 소개할 대표 오름 이름(알려진 오름, 사진이 있는 곳) — 데이터에 없거나 그 형태가 아니면 그 형태에서 가장 높은 오름으로 대신함
export const REP_NAMES = { cone: '도두봉', round: '아부오름', horseshoe: '원당봉', mixed: '용눈이오름' }
export function pickRep(list = [], key) {
  const inGroup = list.filter((o) => formGroupOf(o.form).key === key)
  const wanted = inGroup.find((o) => o.name === REP_NAMES[key])
  return wanted ?? [...inGroup].sort((a, b) => (b.elev ?? 0) - (a.elev ?? 0))[0] ?? null
}
