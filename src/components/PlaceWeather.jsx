import { useEffect, useState } from 'react'
import { Form, Spinner } from 'react-bootstrap'
import { fetchForecast } from '../api/client'
import { todayKst } from '../lib/placeCategories'

const addDays = (date, n) => new Date(Date.parse(date) + n * 86400000).toISOString().slice(0, 10)
const MAX_AHEAD = 10   // 중기예보가 닿는 날짜(오늘로부터 일)
const label = (date) => new Date(`${date}T00:00:00+09:00`).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short' })

const iconOf = (w) => (w.precip === '눈' ? 'cloud-snow' : w.precip ? 'cloud-rain' : /흐/.test(w.sky) ? 'clouds' : /구름/.test(w.sky) ? 'cloud-sun' : 'sun')
const SOURCE_NOTE = { short: '단기예보 · 이 장소 좌표 기준', mid: '중기예보 · 제주 전체 공통' }

function Cell({ title, w }) {
  return (
    <div className="weather-cell flex-fill" data-testid="weather-cell">
      <div className="small fw-bold mb-1">{title}</div>
      {!w ? <Spinner size="sm" />
        : w.kind === 'none' ? <div className="small text-muted">예보 범위 밖이에요 (오늘~{MAX_AHEAD}일)</div>
          : (
            <>
              <div><i className={`bi bi-${iconOf(w)} me-2`} />
                {w.tmin !== null && w.tmax !== null ? `${w.tmin}~${w.tmax}℃` : ''} {w.sky}{w.precip && !w.sky.includes(w.precip) ? ` · ${w.precip}` : ''}
                {w.pop !== null && ` · 강수 ${w.pop}%`}
              </div>
              <div className="weather-src">{SOURCE_NOTE[w.kind]}</div>
            </>
          )}
    </div>
  )
}

// 상세 팝업의 날씨: 오늘 + 방문할 날짜의 날씨. 오늘~3일 이내는 장소 좌표별 단기예보, 4~10일은 제주 전체 중기예보
// visitFrom: 축제처럼 기간이 있으면 시작일을 방문일 기본값으로 (오늘부터 10일 안일 때만)
export default function PlaceWeather({ lat, lng, visitFrom }) {
  const today = todayKst()
  const last = addDays(today, MAX_AHEAD)
  const [visit, setVisit] = useState(visitFrom && visitFrom > today && visitFrom <= last ? visitFrom : '')
  const [data, setData] = useState({})        // { 'YYYY-MM-DD': 예보 }
  const [error, setError] = useState('')
  const dates = visit && visit !== today ? [today, visit] : [today]

  useEffect(() => {
    let alive = true
    setError('')
    fetchForecast({ lat, lng, dates }).then((list) => {
      if (alive) setData(Object.fromEntries(list.map((w) => [w.date, w])))
    }).catch((e) => { if (alive) { setData({}); setError(e.message) } })
    return () => { alive = false }
  }, [lat, lng, dates.join(',')])

  return (
    <section className="weather-box mb-3" data-testid="place-weather">
      <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
        <span className="fw-bold small"><i className="bi bi-cloud-sun me-1" />날씨</span>
        <span className="small text-muted ms-auto">방문할 날짜</span>
        <Form.Control type="date" size="sm" value={visit} min={today} max={last} aria-label="방문할 날짜" style={{ width: 150 }}
          onChange={(e) => setVisit(e.target.value)} />
      </div>
      {error ? <div className="small text-muted">날씨를 불러오지 못했어요 ({error})</div> : (
        <div className="d-flex flex-wrap gap-2">
          <Cell title={`오늘 ${label(today)}`} w={data[today]} />
          {visit && visit !== today && <Cell title={`방문일 ${label(visit)}`} w={data[visit]} />}
        </div>
      )}
      {!visit && !error && <div className="weather-src mt-1">방문할 날짜를 고르면 그날 예보도 함께 보여줘요.</div>}
      <div className="weather-src mt-2" data-testid="weather-note">
        ※ 오늘~3일 이내는 장소·좌표별 단기예보, 4~10일은 제주 전체 중기예보예요 (중기예보는 장소와 상관없이 같은 값).
      </div>
    </section>
  )
}
