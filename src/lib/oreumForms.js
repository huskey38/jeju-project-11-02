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
