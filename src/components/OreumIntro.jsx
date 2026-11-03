import { useEffect, useState } from 'react'
import { Button, Col, Row } from 'react-bootstrap'
import { fetchOreumAll } from '../api/client'
import { FORM_DESC, FORM_GROUPS, formGroupOf } from '../lib/oreumForms'
import FormPreview from './FormPreview'
import OreumMore from './OreumMore'
import { FEATURES } from '../lib/features'
import MyStepLine from './MyStepLine'

// 메인 화면의 오름 소개: 오름이 무엇인지, 형태 네 가지, 이 사이트로 할 수 있는 일
const USES = [
  ['bi-search', '오름 찾기', '형태·표고순·내 주변으로 골라 보세요'],
  ['bi-flag-fill', '오른 오름 기록', '체크할 때마다 등반률이 오르고 칭호가 바뀌어요'],
  ['bi-geo-alt', '3D 제주 지도', '오른 오름마다 귤이 하나씩 올라가요'],
  ['bi-chat-dots', 'AI 가이드 오롬이', '"가장 높은 오름은?" 처럼 물어보세요'],
]

export default function OreumIntro() {
  const [list, setList] = useState(null)
  useEffect(() => { fetchOreumAll().then(setList).catch(() => setList(null)) }, [])
  const counts = list && Object.fromEntries(FORM_GROUPS.map((g) => [g.key, list.filter((o) => formGroupOf(o.form).key === g.key).length]))

  return (
    <section className="oreum-intro rounded-4 p-4 mb-4" data-testid="oreum-intro">
      <h2 className="h5 fw-bold mb-2">오름이란?</h2>
      <p className="mb-3">
        오름은 제주 곳곳에 솟아 있는 작은 화산 언덕이에요. 한라산 둘레에 흩어진 이 오름들은 가볍게 오르는 산책길이자, 제주의 바람과 억새와 일출을 만나는 전망대랍니다.
        제주특별자치도가 정리한 공식 오름은 <strong data-testid="intro-count">{list?.length ?? 368}곳</strong>이고, 모양에 따라 네 가지로 나눠요.
      </p>
      <Row xs={2} md={4} className="g-2 mb-3">
        {FORM_GROUPS.map((g) => (
          <Col key={g.key}>
            <FormPreview group={g.key}>
              <div className="h-100 p-2 rounded-3 bg-white bg-opacity-75 small form-card" tabIndex={0} data-testid={`form-card-${g.key}`}>
                <div className="fw-bold">{g.label}{counts && <span className="text-muted fw-normal"> · {counts[g.key]}곳</span>}</div>
                <div className="text-muted">{FORM_DESC[g.key]}</div>
              </div>
            </FormPreview>
          </Col>
        ))}
      </Row>
      <Row xs={1} md={2} className="g-2 mb-3">
        {USES.map(([icon, title, desc]) => (
          <Col key={title}><div className="small"><i className={`bi ${icon} me-2 text-success`} /><strong>{title}</strong> — {desc}</div></Col>
        ))}
      </Row>
      {FEATURES.homeProgress && <div className="mb-3"><MyStepLine oreums={list} /></div>}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
        <Button size="sm" variant="success" onClick={() => document.querySelector('[data-testid=home-places]')?.scrollIntoView({ behavior: 'smooth' })}>
          오름 둘러보기 <i className="bi bi-arrow-down ms-1" />
        </Button>
        <OreumMore list={list} />
      </div>
    </section>
  )
}
