import { OverlayTrigger, Popover } from 'react-bootstrap'
import { oreumFacts } from '../lib/oreumFacts'

// 메인 '오름이란?' 블록 오른쪽 아래의 "오름에 대해 더 자세히 알고 싶어요!" — 마우스를 올리거나 포커스(터치)하면 오름 소개를 말풍선으로 보여 줌
// list: 공식 오름 목록(숫자는 여기서 계산, 없으면 숫자 없는 문장으로 대신)
const num = (n) => n.toLocaleString('ko-KR')

export default function OreumMore({ list }) {
  const f = oreumFacts(list ?? [])
  const popover = (
    <Popover id="oreum-more" className="oreum-more-pop" data-testid="oreum-more-pop">
      <Popover.Header as="h6" className="oreum-more-head"><i className="bi bi-info-circle-fill me-2 text-success" />오름, 이렇게 알고 가면 더 재밌어요</Popover.Header>
      <Popover.Body className="oreum-more-body">
        <section>
          <h3>이름의 뜻</h3>
          <p>‘오름’은 제주 말로 산을 뜻하는 <strong>‘오롬’</strong>에서 왔어요. 한라산 둘레와 바닷가까지, 오래전 화산 활동으로 생긴 작은 화산(기생화산)들이 제주 곳곳에 솟아 있어요.</p>
        </section>
        <section>
          <h3>모양은 네 가지</h3>
          <p>
            {f
              ? <>분화구 모양에 따라 {f.byForm.map((g) => `${g.label} ${num(g.count)}곳`).join(' · ')}으로 나눠요. <strong>{f.mostForm.label}</strong>이 가장 많아요.</>
              : '분화구 모양에 따라 원추형·원형·말굽형·복합형으로 나눠요.'}
          </p>
        </section>
        <section>
          <h3>얼마나 높을까요?</h3>
          <p>
            {f?.lowest && f?.highest
              ? <>표고는 {num(f.lowest.elev)}m({f.lowest.name})부터 {num(f.highest.elev)}m({f.highest.name})까지예요. 공식 {num(f.total)}곳 중 <strong>{num(f.easy)}곳({f.easyPercent}%)</strong>은 300m 이하라서 비교적 가볍게 오를 수 있어요.</>
              : '대부분 낮은 언덕이라 비교적 가볍게 오를 수 있어요.'}
          </p>
        </section>
        <section>
          <h3>어떤 점이 좋을까요?</h3>
          <p>정상에서 보는 일출·일몰, 가을 억새, 분화구와 부드러운 능선, 바다까지 이어지는 탁 트인 전망이 매력이에요.</p>
        </section>
        <section>
          <h3>오를 때 알아두세요</h3>
          <p>정해진 탐방로로만 다니고 목장·사유지·보호구역에는 들어가지 않아요. 훼손을 막으려고 탐방을 제한하거나 쉬어 가게(휴식년제) 하는 오름도 있어요. 바람이 센 날이 많으니 겉옷을 챙기세요.</p>
        </section>
        <div className="oreum-more-foot">제주특별자치도 오름현황(2025-12-31 기준) · 궁금한 건 오롬이에게 물어보세요 🍊</div>
      </Popover.Body>
    </Popover>
  )
  return (
    <OverlayTrigger placement="top-end" trigger={['hover', 'focus']} delay={{ show: 80, hide: 120 }} overlay={popover}>
      <button type="button" className="oreum-more-btn" data-testid="oreum-more">
        <i className="bi bi-chat-heart me-1" />오름에 대해 더 자세히 알고 싶어요!
      </button>
    </OverlayTrigger>
  )
}
