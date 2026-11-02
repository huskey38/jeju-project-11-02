import { useEffect, useState } from 'react'
import { Alert, Badge, Button, Card, Col, Form, InputGroup, ListGroup, Row } from 'react-bootstrap'
import PageHeader from '../components/PageHeader'
import Jeju3D from '../components/Jeju3D'
import { Loading } from '../components/Status'
import { fetchHeritage, fetchPlaces } from '../api/client'
import { isJejuCoord } from '../lib/geo'
import { useAppStore } from '../store/useAppStore'

const SOURCE_LABEL = { tour: '관광·문화', heritage: '국가유산' }

// 3D 제주 지도: TourAPI + 국가유산청 결과를 한 지도에 핀으로 보여줍니다.
export default function Map3D() {
  const addFavorite = useAppStore((s) => s.addFavorite)
  const [keyword, setKeyword] = useState('')
  const [items, setItems] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [warnings, setWarnings] = useState([])

  async function search(e) {
    e?.preventDefault()
    setLoading(true); setWarnings([]); setSelected(null)
    // 한쪽 API가 실패해도 다른 쪽 핀은 보여주기 위해 allSettled
    const [tour, heritage] = await Promise.allSettled([fetchPlaces(keyword, '12'), fetchHeritage(keyword)])
    const next = [], warn = []
    if (tour.status === 'fulfilled') {
      next.push(...tour.value.map((p) => ({ source: 'tour', id: p.id, name: p.title, addr: p.addr, lat: p.lat, lng: p.lng })))
    } else warn.push(`관광지: ${tour.reason.message}`)
    if (heritage.status === 'fulfilled') {
      next.push(...heritage.value.map((h) => ({ source: 'heritage', id: h.name, name: h.name, addr: h.city, lat: h.lat, lng: h.lng })))
    } else warn.push(`국가유산: ${heritage.reason.message}`)
    setItems(next); setWarnings(warn); setLoading(false)
  }
  useEffect(() => { search() }, [])

  const mappable = items.filter((i) => isJejuCoord(i.lat, i.lng))

  return (
    <>
      <PageHeader icon="globe-asia-australia" title="3D 제주 지도" subtitle="마우스로 돌리고 확대하고, 핀을 눌러 자세히 보세요 (three.js)" />
      <Form onSubmit={search} className="mb-3">
        <InputGroup>
          <Form.Control value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="검색어 (비우면 전체) 예: 해녀, 오름" />
          <Button type="submit"><i className="bi bi-search" /></Button>
        </InputGroup>
      </Form>
      {warnings.map((w) => <Alert key={w} variant="warning" className="py-2 small">{w}</Alert>)}
      <Row className="g-3">
        <Col lg={8}>
          <Card className="overflow-hidden">
            <Jeju3D items={mappable} selected={selected} onSelect={setSelected} height={460} />
          </Card>
          <div className="small text-muted mt-2">
            <Badge bg="danger" className="me-1">&nbsp;</Badge>관광·문화
            <Badge bg="warning" className="ms-3 me-1">&nbsp;</Badge>국가유산
            <span className="ms-3" data-testid="pin-count">핀 {mappable.length}개</span>
          </div>
        </Col>
        <Col lg={4}>
          {selected && (
            <Card className="mb-3 border-primary" data-testid="selected-card">
              <Card.Body>
                <Badge bg="secondary" className="mb-2">{SOURCE_LABEL[selected.source]}</Badge>
                <Card.Title className="fs-6 fw-bold">{selected.name}</Card.Title>
                {selected.addr && <Card.Text className="small text-muted">{selected.addr}</Card.Text>}
                <Button size="sm" variant="outline-primary" onClick={() => addFavorite({ source: selected.source, id: selected.id, title: selected.name })}>
                  <i className="bi bi-star me-1" />즐겨찾기
                </Button>
              </Card.Body>
            </Card>
          )}
          {loading ? <Loading /> : (
            <ListGroup style={{ maxHeight: 340, overflowY: 'auto' }}>
              {mappable.length === 0 && <ListGroup.Item className="text-muted">지도에 표시할 항목이 없어요</ListGroup.Item>}
              {mappable.map((it, i) => (
                <ListGroup.Item key={i} action active={selected === it} onClick={() => setSelected(it)} className="small">
                  {it.name}
                </ListGroup.Item>
              ))}
            </ListGroup>
          )}
        </Col>
      </Row>
    </>
  )
}
