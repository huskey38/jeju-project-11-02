// 제주도내 공연장 현황 CSV → server/data/venues.js 변환 (일회성): node scripts/build-venues.mjs <csv 경로>
//   원본: 제주특별자치도_제주도내 공연장 현황 (공공데이터포털 15096065, 기준일 2021-11-30, 이용허락범위 제한 없음)
//   CSV 는 EUC-KR 이고 컬럼은 연번·공연장명(개관일자)·소재지·시설구분·비고·기준일자 — 좌표·전화번호가 없음
// 좌표는 scripts/geocode-venues.mjs 로 나중에 채웁니다 (카카오 키 필요).
import { readFileSync, writeFileSync } from 'node:fs'

// 따옴표(쉼표가 든 주소)를 지원하는 간단한 CSV 파서
export function parseCsv(text) {
  const rows = []; let row = [], cur = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++ } else q = false } else cur += c }
    else if (c === '"') q = true
    else if (c === ',') { row.push(cur); cur = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = '' }
    else cur += c
  }
  if (cur || row.length) { row.push(cur); rows.push(row) }
  return rows.filter((r) => r.some((x) => x.trim()))
}

// 원본의 명백한 오탈자·깨진 글자 바로잡기 (원본 파일 자체가 이렇게 되어 있음)
const NAME_FIX = [
  [/^에술극장/, '예술극장'],          // 오탈자 (제주 예술극장, 신산로 82)
  [/^노형수퍼마�?R?/, '노형수퍼마켙'], // 원본 바이트가 손상돼 한 글자가 깨져 있음
]

// '이름(개관일)', '이름(개관일) - 야외' 형태를 분리
export function splitName(raw) {
  const m = raw.trim().match(/^(.*?)\s*\((\d{4}-\d{2}-\d{2})\)\s*(?:-\s*(.+))?$/)
  let name = (m ? m[1] : raw).trim()
  for (const [re, to] of NAME_FIX) if (re.test(name)) name = name.replace(re, to)
  return { name, open: m?.[2] ?? '', note: m?.[3]?.trim() ?? '' }
}

// 표시용 주소: 오탈자 정리 (제주시오남로→제주시 오남로, '-=' → '-', '((' → '(')
export function cleanAddr(a) {
  return a.trim()
    .replace(/^(제주시|서귀포시)(?=\S)/, '$1 ')
    .replace(/-=/g, '-')
    .replace(/\(\(/g, '(')
    .replace(/\s+/g, ' ')
}
// 지오코딩용 주소: 괄호(동 이름)·쉼표 뒤(동·호수)를 떼고 시·도를 붙임
export function geoAddr(a) {
  const base = cleanAddr(a).split(/[(,]/)[0].trim()
  return `제주특별자치도 ${base}`
}

export function build(csvText) {
  const [head, ...rows] = parseCsv(csvText)
  if (!head || !head[1]?.includes('공연장명')) throw new Error('예상한 컬럼(공연장명)이 없어요 — 파일을 확인하세요')
  return rows.map((r) => {
    const { name, open, note } = splitName(r[1])
    return {
      id: `v${r[0].trim()}`, name, open, note,
      kind: r[3].trim(),              // 공공 / 민간
      type: r[4].trim(),              // 종합공연 / 상설공연 (비어 있을 수 있음)
      addr: cleanAddr(r[2]), geoAddr: geoAddr(r[2]),
      lat: null, lng: null,           // geocode-venues.mjs 가 채움
      base: r[5].trim(),              // 기준일자
    }
  })
}

// server/data/venues.js 를 (다시) 씀
export function writeVenuesFile(list) {
  const out = new URL('../server/data/venues.js', import.meta.url)
  const header = `// 제주도내 공연장 현황 (제주특별자치도, 공공데이터포털 15096065, 기준일 ${list[0]?.base ?? ''}, 이용허락범위 제한 없음)\n`
    + '// scripts/build-venues.mjs 로 생성 — lat/lng 는 scripts/geocode-venues.mjs 로 채움 (직접 고치지 마세요)\n'
  writeFileSync(out, `${header}export default ${JSON.stringify(list, null, 2)}\n`)
}

// 직접 실행했을 때만 파일을 씀 (테스트에서 import 해도 안전)
if (process.argv[1]?.endsWith('build-venues.mjs')) {
  const src = process.argv[2]
  if (!src) { console.error('사용법: node scripts/build-venues.mjs <공연장 CSV 경로>'); process.exit(1) }
  const list = build(new TextDecoder('euc-kr').decode(readFileSync(src)))
  writeVenuesFile(list)
  console.log(`${list.length}건 → server/data/venues.js`)
}
