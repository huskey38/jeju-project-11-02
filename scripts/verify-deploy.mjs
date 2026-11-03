// 배포 사이트 검증(평가용 증거 만들기): 공공데이터 API 실제 응답 · 비밀 키 노출 여부 · (선택) AI 에이전트 '지어내지 않음' 테스트
//   node scripts/verify-deploy.mjs                 → API 응답·키 노출만 확인 (비용 없음)
//   node scripts/verify-deploy.mjs --agent         → 에이전트에 질문 1건(없는 오름)을 더 보냄 (Claude 호출 1회 — 수업 예산을 쓰므로 필요할 때만)
//   node scripts/verify-deploy.mjs https://내주소.vercel.app --agent
// 결과는 화면과 docs/verification/deploy-check.md 에 남음. 키 '값'은 출력·저장하지 않고 이름과 포함 여부만 적음.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const args = process.argv.slice(2)
const BASE = (args.find((a) => a.startsWith('http')) ?? 'https://jeju-project-11-02.vercel.app').replace(/\/$/, '')
const WITH_AGENT = args.includes('--agent')
const OUT = 'docs/verification/deploy-check.md'
const kst = new Date(Date.now() + 9 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 16) + ' (KST)'

const q = encodeURIComponent
const CHECKS = [
  ['키 유무 확인', '/api/hello', (j) => `공공데이터 키 ${j.hasDataKey ? '있음' : '없음'} · Claude 키 ${j.hasClaudeKey ? '있음' : '없음'}`, (j) => j.ok && j.hasDataKey && j.hasClaudeKey],
  ['제주 오름 현황(공식 368곳, 파일)', '/api/oreum?sort=recommend&rows=3', (j) => `${j.length}건 · 첫 항목 ${j[0]?.name}`, (j) => Array.isArray(j) && j.length > 0],
  ['한국관광공사 TourAPI — 검색', `/api/tour?keyword=${q('오름')}&type=12&page=1&rows=3`, (j) => `${j.length}건 · 첫 항목 ${j[0]?.title}`, (j) => Array.isArray(j) && j.length > 0],
  ['한국관광공사 TourAPI — 근처(위치 기반)', '/api/tour?mode=near&lat=33.3663&lng=126.3576&radius=10000&type=39&xlcls=FD05&page=1&rows=3', (j) => `${j.length}건 · 첫 항목 ${j[0]?.title}`, (j) => Array.isArray(j) && j.length > 0],
  ['기상청 단기예보', `/api/weather?place=${q('제주시')}`, (j) => `${j.length}건 · ${j[0]?.time} ${j[0]?.temp}℃ ${j[0]?.sky}`, (j) => Array.isArray(j) && j.length > 0],
  ['국가유산청', `/api/heritage?keyword=${q('해녀')}`, (j) => `${j.length}건 · 첫 항목 ${j[0]?.name}`, (j) => Array.isArray(j) && j.length > 0],
  ['행정안전부 일반음식점(odcloud)', `/api/restaurant?keyword=${q('흑돼지')}&rows=3`, (j) => `${j.length}건 · 첫 항목 ${j[0]?.title}`, (j) => Array.isArray(j) && j.length > 0],
  ['공연장(파일 데이터)', '/api/venue?rows=3', (j) => `${j.length}건 · 첫 항목 ${j[0]?.title}`, (j) => Array.isArray(j) && j.length > 0],
  ['카카오 주변 편의시설', '/api/poi?lat=33.3663&lng=126.3576&cat=PK6&radius=2000', (j) => `${j.length}건 · 첫 항목 ${j[0]?.title}`, (j) => Array.isArray(j) && j.length > 0],
]

const rows = []
for (const [name, path, show, ok] of CHECKS) {
  const t = Date.now()
  try {
    const r = await fetch(BASE + path)
    const j = await r.json()
    rows.push({ name, status: r.status, ms: Date.now() - t, pass: r.ok && ok(j), note: r.ok ? show(j) : String(j.error ?? r.statusText) })
  } catch (e) { rows.push({ name, status: 0, ms: Date.now() - t, pass: false, note: e.message }) }
}

// ── 비밀 키 노출 점검: 배포된 HTML·JS 전체에 .env 의 값이 들어 있는지 (이름만 보고함)
function readEnv() {
  if (!existsSync('.env')) return null
  return Object.fromEntries(readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => l && !l.startsWith('#') && l.includes('=')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')] }))
}
const env = readEnv()
const html = await (await fetch(BASE + '/')).text()
const seen = new Set(), queue = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)].map((m) => m[1])
let bundle = html
while (queue.length) {
  const u = queue.shift()
  if (seen.has(u)) continue
  seen.add(u)
  const t = await (await fetch(BASE + u)).text()
  bundle += t
  for (const m of t.matchAll(/["'`]((?:\.\/|\/assets\/)[^"'`]+\.js)["'`]/g)) { const p = m[1].startsWith('./') ? '/assets/' + m[1].slice(2) : m[1]; if (!seen.has(p)) queue.push(p) }
}
const SERVER_ONLY = ['DATA_GO_KR_KEY', 'ANTHROPIC_API_KEY', 'KAKAO_REST_KEY', 'VISITJEJU_API_KEY']
const leak = []
if (env) for (const k of SERVER_ONLY) { const v = env[k]; if (v) leak.push({ name: k, exposed: bundle.includes(v) }) }
const antPattern = /sk-ant-[A-Za-z0-9_-]{10,}/.test(bundle)
const pub = (env && env.VITE_SUPABASE_ANON_KEY) ? bundle.includes(env.VITE_SUPABASE_ANON_KEY) : null

// ── (선택) 에이전트: 없는 오름을 물었을 때 지어내지 않는지
let agent = null
if (WITH_AGENT) {
  const message = '마법의별오름이라는 오름이 있다던데 어떤 곳인지 소개해줘'
  const t = Date.now()
  try {
    const r = await fetch(BASE + '/api/agent', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message, history: [] }) })
    const j = await r.json()
    const steps = (j.steps ?? []).map((s) => `${s.tool}(${JSON.stringify(s.args)}) → ${s.count}건`)
    const honest = /(없|찾지 못|확인되지|등록되지|나오지)/.test(j.answer ?? '')
    agent = { message, status: r.status, ms: Date.now() - t, steps, answer: String(j.answer ?? j.error ?? ''), calledTool: steps.length > 0, honest }
  } catch (e) { agent = { message, status: 0, ms: Date.now() - t, steps: [], answer: e.message, calledTool: false, honest: false } }
}

// ── 출력·저장
const mark = (b) => (b ? '✅' : '❌')
const md = []
md.push(`# 배포 사이트 검증 결과`, '', `- 대상: ${BASE}`, `- 확인 시각: ${kst}`, `- 만든 방법: \`node scripts/verify-deploy.mjs${WITH_AGENT ? ' --agent' : ''}\` (키 값은 저장하지 않음)`, '')
md.push('## 1. 공공데이터 API — 배포본의 실제 응답', '', '| 결과 | 항목 | 상태 | 시간 | 내용 |', '|---|---|---|---|---|')
for (const r of rows) md.push(`| ${mark(r.pass)} | ${r.name} | ${r.status} | ${r.ms}ms | ${String(r.note).replace(/\|/g, '/').slice(0, 80)} |`)
md.push('', '## 2. 비밀 키 노출 점검 (배포된 HTML·JS ' + seen.size + '개 파일 전체 검사)', '')
if (env) {
  md.push('| 결과 | 키 | 배포본(브라우저)에 값이 들어 있는가 |', '|---|---|---|')
  for (const l of leak) md.push(`| ${mark(!l.exposed)} | \`${l.name}\` (서버 전용) | ${l.exposed ? '**노출됨**' : '없음'} |`)
  md.push(`| ${mark(!antPattern)} | Claude 키 형태(\`sk-ant-…\`) | ${antPattern ? '**발견**' : '없음'} |`)
  md.push('', `- \`VITE_\` 로 시작하는 키(Supabase anon·카카오 JS)는 브라우저용이라 번들에 있는 것이 정상입니다(Supabase anon 키 포함 여부: ${pub === null ? '확인 안 함' : pub ? '포함' : '없음'}). 접근은 Supabase 정책(RLS)과 카카오 도메인 등록으로 제한합니다.`)
} else md.push('`.env` 가 없어 값 비교는 건너뜀 (`sk-ant-` 형태 검사만: ' + (antPattern ? '발견' : '없음') + ')')
if (agent) {
  md.push('', '## 3. AI 에이전트 — 없는 오름을 물어도 지어내지 않는가', '', `- 질문: “${agent.message}”`, `- 응답 시간: ${agent.ms}ms (상태 ${agent.status})`, `- ${mark(agent.calledTool)} 도구로 먼저 확인함: ${agent.steps.length ? agent.steps.map((s) => '`' + s + '`').join(', ') : '호출 없음'}`, `- ${mark(agent.honest)} 없다고 답함(없음·찾지 못함 등의 표현)`, '', '> ' + agent.answer.replace(/\n+/g, ' ').slice(0, 400))
}
const allPass = rows.every((r) => r.pass) && (!env || (leak.every((l) => !l.exposed) && !antPattern)) && (!agent || (agent.calledTool && agent.honest))
md.push('', `**종합: ${allPass ? '모두 통과 ✅' : '확인이 필요한 항목이 있음 ❌'}**`)
mkdirSync('docs/verification', { recursive: true })
writeFileSync(OUT, md.join('\n') + '\n')
console.log(md.join('\n'))
console.log(`\n저장: ${OUT}`)
process.exitCode = allPass ? 0 : 1
