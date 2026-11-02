// 사용자만의 닉네임: 이름 뒤에 자동으로 #숫자 4자리를 붙여 "제주러버#4821" 처럼 만듭니다.
// 로그인이 없어서 닉네임이 곧 '내 목록의 주소'입니다. 같은 이름을 쓰는 다른 사람과 목록이 섞이지 않도록 번호를 붙이고,
// 다른 기기에서는 번호까지 포함해 그대로 입력하면 같은 목록으로 들어옵니다. (진짜 인증은 아니므로 번호를 아는 사람은 볼 수 있음)
export const NAME_MIN = 2
export const NAME_MAX = 12

// "이름#1234" 형식(번호까지 입력)인지
export const isFullNickname = (s) => /^[^#]{1,12}#\d{4}$/.test(String(s ?? '').trim())

// 이름(번호 앞부분) 검사: 문제가 있으면 안내 문구, 괜찮으면 빈 문자열
export function validateName(raw) {
  const n = String(raw ?? '').trim()
  if (n.length < NAME_MIN) return `${NAME_MIN}글자 이상 입력해 주세요`
  if (n.length > NAME_MAX) return `${NAME_MAX}글자 이하로 입력해 주세요`
  if (n.includes('#')) return '# 는 쓸 수 없어요 (뒤에 번호가 자동으로 붙어요)'
  return ''
}

// 이름 + 무작위 번호 4자리
export const withTag = (name, rand = Math.random) => `${String(name).trim()}#${String(Math.floor(rand() * 10000)).padStart(4, '0')}`
