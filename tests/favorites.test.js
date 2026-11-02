import { beforeEach, describe, expect, it, vi } from 'vitest'

// 메모리 안의 가짜 Supabase: favorites 테이블 하나만 흉내 (select / insert / delete)
let rows, nextId, allowDelete, failNext
const db = {
  from(table) {
    expect(table).toBe('favorites')
    const q = {
      _op: 'select', _eq: {}, _row: null,
      select() { if (this._op === 'insert' || this._op === 'delete') this._returning = true; return this },
      eq(k, v) { this._eq[k] = v; return this },
      order() { return this },
      insert(row) { this._op = 'insert'; this._row = row; return this },
      delete() { this._op = 'delete'; return this },
      single() { this._single = true; return this },
      then(resolve) { resolve(this._run()) },
      _run() {
        if (failNext) { const message = failNext; failNext = null; return { data: null, error: { message } } }
        if (this._op === 'insert') {
          const row = { id: nextId++, created_at: '2026-11-02T00:00:00Z', ...this._row }
          rows.push(row)
          return { data: row, error: null }
        }
        if (this._op === 'delete') {
          if (!allowDelete) return { data: [], error: null }          // RLS 에 delete 정책이 없을 때: 오류 없이 0건
          const gone = rows.filter((r) => r.id === this._eq.id)
          rows = rows.filter((r) => r.id !== this._eq.id)
          return { data: gone, error: null }
        }
        return { data: rows.filter((r) => r.nickname === this._eq.nickname).sort((a, b) => b.id - a.id), error: null }
      },
    }
    return q
  },
}
vi.mock('../src/lib/supabase.js', () => ({ supabase: db, isSupabaseReady: true }))
vi.mock('../src/api/client.js', () => ({ askAgent: vi.fn() }))

const { useAppStore } = await import('../src/store/useAppStore.js')
const S = () => useAppStore.getState()
const tour = { source: 'tour', id: 130857, title: '제주해녀박물관' }
const lastToast = () => S().toasts.at(-1)

beforeEach(() => {
  rows = []; nextId = 1; allowDelete = true; failNext = null
  useAppStore.setState({ nickname: '테스터', favorites: [], favLoaded: false, favLoading: false, toasts: [] })
})

describe('즐겨찾기 담기·빼기', () => {
  it('addFavorite: 행을 저장하고 맨 앞에 추가 (item_id 는 문자열)', async () => {
    await S().addFavorite(tour)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ nickname: '테스터', source: 'tour', item_id: '130857', title: '제주해녀박물관' })
    expect(S().favorites.map((f) => f.item_id)).toEqual(['130857'])
    expect(lastToast().message).toBe('가볼만한 곳에 담았어요')
  })

  it('removeFavorite: 지우고 목록에서 빼고 알림', async () => {
    await S().addFavorite(tour)
    await S().removeFavorite(S().favorites[0])
    expect(rows).toHaveLength(0)
    expect(S().favorites).toEqual([])
    expect(lastToast()).toMatchObject({ message: '가볼만한 곳에서 뺐어요', variant: 'success' })
  })

  it('removeFavorite: delete 권한(RLS 정책)이 없어 0건 지워지면 원인을 알리고 목록은 그대로', async () => {
    await S().addFavorite(tour)
    allowDelete = false
    await S().removeFavorite(S().favorites[0])
    expect(rows).toHaveLength(1)
    expect(S().favorites).toHaveLength(1)
    expect(lastToast()).toMatchObject({ variant: 'danger' })
    expect(lastToast().message).toContain('delete 정책')
  })

  it('DB 오류는 알림으로 보이고 목록을 바꾸지 않음', async () => {
    failNext = '연결 실패'
    await S().addFavorite(tour)
    expect(S().favorites).toEqual([])
    expect(lastToast()).toMatchObject({ message: '연결 실패', variant: 'danger' })
  })
})

describe('toggleFavorite (감귤 아이콘)', () => {
  it('처음 누르면 담고, 다시 누르면 뺌', async () => {
    await S().toggleFavorite(tour)
    expect(S().favorites).toHaveLength(1)
    await S().toggleFavorite(tour)
    expect(S().favorites).toHaveLength(0)
    expect(rows).toHaveLength(0)
  })

  it('종류(source)와 id 가 모두 같아야 같은 항목: 다른 종류·다른 id 는 따로 담김', async () => {
    await S().toggleFavorite(tour)
    await S().toggleFavorite({ source: 'heritage', id: '130857', title: '같은 숫자지만 국가유산' })
    await S().toggleFavorite({ source: 'tour', id: 1, title: '다른 장소' })
    expect(S().favorites).toHaveLength(3)
    await S().toggleFavorite(tour)                                  // 첫 항목만 빠짐
    expect(S().favorites.map((f) => `${f.source}:${f.item_id}`).sort()).toEqual(['heritage:130857', 'tour:1'])
  })

  it('id 가 숫자든 문자열이든 같은 항목으로 취급', async () => {
    await S().toggleFavorite({ source: 'tour', id: 7, title: 'a' })
    await S().toggleFavorite({ source: 'tour', id: '7', title: 'a' })
    expect(S().favorites).toHaveLength(0)
  })

  it('아직 불러오지 않았으면 먼저 불러온 뒤 판단 (이미 저장된 항목을 중복 저장하지 않음)', async () => {
    rows.push({ id: 99, nickname: '테스터', source: 'tour', item_id: '130857', title: '제주해녀박물관', created_at: 'x' })
    expect(S().favLoaded).toBe(false)
    await S().toggleFavorite(tour)                                  // 담기가 아니라 빼기가 되어야 함
    expect(rows).toHaveLength(0)
    expect(S().favLoaded).toBe(true)
  })
})

describe('불러오기·닉네임', () => {
  it('loadFavorites: 이 닉네임의 것만 최신순으로, favLoaded 표시', async () => {
    rows.push({ id: 1, nickname: '테스터', source: 'tour', item_id: '1', title: 'a', created_at: 'x' },
      { id: 2, nickname: '다른사람', source: 'tour', item_id: '2', title: 'b', created_at: 'x' },
      { id: 3, nickname: '테스터', source: 'venue', item_id: 'v1', title: 'c', created_at: 'x' })
    await S().loadFavorites()
    expect(S().favorites.map((f) => f.id)).toEqual([3, 1])
    expect(S().favLoaded).toBe(true)
  })

  it('닉네임이 바뀌면 즐겨찾기를 비우고 다시 불러오도록 표시를 되돌림 (공백은 다듬음)', async () => {
    await S().addFavorite(tour)
    S().setNickname('  새닉네임 ')
    expect(S().nickname).toBe('새닉네임')
    expect(S().favorites).toEqual([])
    expect(S().favLoaded).toBe(false)
    await S().addFavorite(tour)                                     // 새 닉네임으로 저장됨
    expect(rows.at(-1).nickname).toBe('새닉네임')
  })

  it('닉네임이 없으면 "익명" 으로 저장·조회', async () => {
    useAppStore.setState({ nickname: '' })
    await S().addFavorite(tour)
    expect(rows[0].nickname).toBe('익명')
    await S().loadFavorites()
    expect(S().favorites).toHaveLength(1)
  })
})
