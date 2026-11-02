import { useEffect, useState } from 'react'
import { Card, Col, Form, Row } from 'react-bootstrap'
import { ping } from '../api/client'
import { isSupabaseReady, supabase } from '../lib/supabase'
import { useAppStore } from '../store/useAppStore'
import Places from './Places'
import { HallaScene } from '../components/JejuScene'
import OreumIntro from '../components/OreumIntro'

// 홈 = 기획 소개 + "동작 체크" 대시보드
// 동작 체크(React·Supabase·/api)는 모두 정상이라 화면에서 숨겼습니다. 다시 보려면 SHOW_CHECKS 를 true 로 바꾸세요 (숨기면 확인 호출도 하지 않음).
const SHOW_CHECKS = false
const SHOW_NICKNAME = false   // 닉네임 입력칸도 숨김 (저장된 닉네임은 가볼만한 곳의 주인 이름으로 계속 쓰임, 비어 있으면 '익명')

export default function Home() {
  const nickname = useAppStore((s) => s.nickname)
  const setNickname = useAppStore((s) => s.setNickname)
  const [db, setDb] = useState(isSupabaseReady
    ? { state: 'wait', msg: '확인 중...' }
    : { state: 'fail', msg: '.env.local 에 VITE_SUPABASE_URL / ANON_KEY 를 넣으세요' })
  const [api, setApi] = useState({ state: 'wait', msg: '확인 중...' })

  useEffect(() => {
    if (!SHOW_CHECKS) return
    // ① Supabase 연결 확인
    if (isSupabaseReady) supabase.from('favorites').select('id').limit(1).then(({ error }) =>
      setDb(error ? { state: 'fail', msg: error.message } : { state: 'ok', msg: '연결 OK' }))

    // ② 서버 함수(/api) 확인
    ping()
      .then((d) => setApi({ state: 'ok', msg: `OK · 공공데이터 키 ${d.hasDataKey ? '있음' : '없음'} · Claude 키 ${d.hasClaudeKey ? '있음' : '없음'}` }))
      .catch(() => setApi({ state: 'fail', msg: 'npm run dev 가 아니라 vercel dev 로 실행했는지 확인' }))
  }, [])

  return (
    <>
      <section className="hero rounded-4 p-4 p-md-5 mb-4">
        <HallaScene className="hero-scene" />
        <div className="hero-greet">혼저옵서예</div>
        <h1 className="fw-bold">제주 오름 길잡이</h1>
        <p className="lead">제주의 오름을 공공데이터와 AI 가이드로 쉽고 편하게 찾아가는 탐방 길잡이</p>
        <p className="hero-intent">가까운 오름, 일출·억새·가볍게 걷기 좋은 오름까지 — 오름 앞뒤로 들를 맛집·카페·날씨를 한 번에.</p>
      </section>

      <OreumIntro />

      {/* 관광·문화를 홈에서 바로 둘러봄 (분류 버튼·검색·내 주변·축제·상세·감귤 즐겨찾기 모두 이 화면에서 동작) */}
      <section className="mb-5" data-testid="home-places"><Places /></section>

      {SHOW_CHECKS && (
        <>
          <h5 className="fw-bold mb-3"><i className="bi bi-clipboard-check me-2" />동작 체크</h5>
          <Row xs={1} md={3} className="g-3">
            <Col><Check title="React · 라우터" state="ok" msg="이 화면이 보이면 OK" /></Col>
            <Col><Check title="Supabase" {...db} /></Col>
            <Col><Check title="서버 함수 /api" {...api} /></Col>
          </Row>
        </>
      )}

      {SHOW_NICKNAME && <Card className={SHOW_CHECKS ? 'mt-4' : ''}>
        <Card.Body>
          <Card.Title className="fs-6 fw-bold"><i className="bi bi-database me-2" />Store(Zustand) 확인</Card.Title>
          <Form.Control placeholder="닉네임을 입력하세요" value={nickname}
            onChange={(e) => setNickname(e.target.value)} style={{ maxWidth: 320 }} />
          <Form.Text>입력하면 오른쪽 위 메뉴에도 바로 보이고, 새로고침해도 남아 있습니다.</Form.Text>
        </Card.Body>
      </Card>}
    </>
  )
}

function Check({ title, state, msg }) {
  const icon = { ok: 'check-circle-fill text-success', fail: 'x-circle-fill text-danger', wait: 'hourglass-split text-muted' }[state]
  return (
    <Card className="h-100">
      <Card.Body>
        <div className="fw-bold mb-1"><i className={`bi bi-${icon} me-2`} />{title}</div>
        <div className="small text-muted">{msg}</div>
      </Card.Body>
    </Card>
  )
}
