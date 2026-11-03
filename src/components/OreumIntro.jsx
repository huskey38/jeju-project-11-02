import { useEffect, useState } from 'react'
import { Col, Row } from 'react-bootstrap'
import { fetchOreumAll } from '../api/client'
import { FORM_DESC, FORM_GROUPS, formGroupOf } from '../lib/oreumForms'
import FormPreview from './FormPreview'
import OreumMore from './OreumMore'
import { FEATURES } from '../lib/features'
import MyStepLine from './MyStepLine'

// 메인 화면의 오름 소개: 오름이 무엇인지, 형태 네 가지, 이 사이트로 하는 3단계 (둘러보기 버튼은 히어로로 옮김)
const STEPS = [
  ['bi-search', '1 찾기', '형태·표고순·내 주변으로 골라요'],
  ['bi-flag-fill', '2 오르고 기록', '올랐어요를 누르면 등반률과 칭호가 올라요'],
  ['bi-geo-alt', '3 지도에 귤 올리기', '3D 제주 지도에 귤이 하나씩 올라가요'],
]

export default function OreumIntro() {
  const [list, setList] = useState(null)
  useEffect(() => { fetchOreumAll().then(setList).catch(() => setList(null)) }, [])
  const counts = list && Object.fromEntries(FORM_GROUPS.map((g) => [g.key, list.filter((o) => formGroupOf(o.form).key === g.key).length]))

  return (
    <section className="oreum-intro rounded-4 p-4 mb-4" data-testid="oreum-intro">
      <h2 className="h5 fw-bold mb-2">오름이란?</h2>
      <p className="mb-3">
        오름은 제주 곳곳에 솟은 작은 화산 언덕으로, 가볍게 오르는 산책길이자 일출·억새·바람을 만나는 전망대예요.
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
      <Row xs={1} md={3} className="g-2 mb-3">
        {STEPS.map(([icon, title, desc]) => (
          <Col key={title}><div className="small"><i className={`bi ${icon} me-2 text-success`} /><strong>{title}</strong><br /><span className="text-muted">{desc}</span></div></Col>
        ))}
      </Row>
      {FEATURES.homeProgress && <div className="mb-3"><MyStepLine oreums={list} /></div>}
      <OreumMore list={list} />
    </section>
  )
}
