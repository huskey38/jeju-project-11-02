import { useEffect } from 'react'
import { Col, Form, Row } from 'react-bootstrap'
import PageHeader from '../components/PageHeader'
import ItemCard from '../components/ItemCard'
import { Empty, Loading } from '../components/Status'
import { useAppStore } from '../store/useAppStore'

// 담은 곳의 종류 이름
const SOURCE_LABEL = { tour: '관광·문화', heritage: '국가유산', venue: '공연장' }

// 즐겨찾기 — store 의 favorites 를 보여줍니다. 카드의 감귤 아이콘을 누르면 즐겨찾기에서 빠집니다.
export default function My() {
  const { nickname, setNickname, favorites, favLoading, loadFavorites, removeFavorite } = useAppStore()

  useEffect(() => { loadFavorites() }, [nickname, loadFavorites])

  return (
    <>
      <PageHeader icon="star" title="내 즐겨찾기" subtitle="감귤 아이콘을 누르면 즐겨찾기에서 빠져요" />
      <Form.Control className="mb-4" style={{ maxWidth: 320 }} placeholder="닉네임"
        value={nickname} onChange={(e) => setNickname(e.target.value)} />
      {favLoading ? <Loading /> : favorites.length === 0 ? <Empty text="아직 저장한 항목이 없어요" /> : (
        <Row xs={1} sm={2} lg={3} className="g-3">
          {favorites.map((f) => (
            <Col key={f.id}>
              <ItemCard title={f.title} badge={SOURCE_LABEL[f.source] ?? f.source}
                subtitle={`${new Date(f.created_at).toLocaleString('ko-KR')}에 담음`}
                saved onSave={() => removeFavorite(f)} />
            </Col>
          ))}
        </Row>
      )}
    </>
  )
}
