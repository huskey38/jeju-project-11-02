import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isFullNickname, validateName, withTag } from '../src/lib/nickname.js'

// 메모리 안의 가짜 Supabase: favorites·visits 두 테이블 (select / insert / delete)
let tables, nextId, allowDelete
const db = {
  from(table) {
    const rows = () => tables[table]
    const q = {
      _op: 'select', _eq: {}, _row: null,
      select() { return this },
      eq(k, v) { this._eq[k] = v; return this },
      order() { return this },
      insert(row) { this._op = 'insert'; this._row = row; return this },
      delete() { this._op = 'delete'; return this },
      single() { return this },
      then(resolve) { resolve(this._run()) },
      _run() {
        if (this._op === 'insert') {
          const row = { id: nextId++, created_at: '2026-11-02T00:00:00Z', ...this._row }
          rows().push(row)
          return { data: row, error: null }
        }
        if (this._op === 'delete') {
          if (!allowDelete) return { data: [], error: null }
          const gone = rows().filter((r) => r.id === this._eq.id)
          tables[table] = rows().filter((r) => r.id !== this._eq.id)
          return { data: gone, error: null }
        }
        return { data: rows().filter((r) => r.nickname === this._eq.nickname).sort((a, b) => b.id - a.id), error: null }
      },
    }
    return q
  },
}
vi.mock('../src/lib/supabase.js', () => ({ supabase: db, isSupabaseReady: true }))
vi.mock('../src/api/client.js', () => ({ askAgent: vi.fn() }))

const { useAppStore } = await import('../src/store/useAppStore.js')
const S = () => useAppStore.getState()
const oreum = { source: 'tour', id: 126508, title: '새별오름' }
const lastToast = () => S().toasts.at(-1)

beforeEach(() => {
  tables = { favorites: [], visits: [] }; nextId = 1; allowDelete = true
  useAppStore.setState({
    nickname: '오름러버#4821', favorites: [], favLoaded: false, visits: [], visitLoaded: false, visitLoading: false,
    toasts: [], nicknameDialog: { open: false, pending: null }, nicknameWelcome: null,
  })
})

describe('닉네임 규칙 (src/lib/nickname.js)', () => {
  it('이름 검사: 2~12글자, # 불가', () => {
    expect(validateName('오름러버')).toBe('')
    expect(validateName('가')).toContain('2글자')
    expect(validateName('가'.repeat(13))).toContain('12글자')
    expect(validateName('오름#1')).toContain('#')
    expect(validateName('  ')).toContain('2글자')
  })
  it('번호 4자리를 붙이고, 이름#번호 형식을 알아봄', () => {
    expect(withTag(' 오름러버 ', () => 0.4821)).toBe('오름러버#4821')
    expect(withTag('a', () => 0.0007)).toBe('a#0007')           // 앞자리는 0 으로 채움
    expect(withTag('a', () => 0.99999)).toBe('a#9999')
    expect(isFullNickname('오름러버#4821')).toBe(true)
    expect(isFullNickname('오름러버#482')).toBe(false)
    expect(isFullNickname('오름러버')).toBe(false)
    expect(isFullNickname('a#b#1234')).toBe(false)
  })
})

describe('닉네임 만들기 (store)', () => {
  it('이름만 쓰면 번호가 붙은 닉네임이 되고 목록은 비워져 다시 불러오게 됨', async () => {
    useAppStore.setState({ nickname: '', favorites: [{ id: 9 }], favLoaded: true })
    const r = await S().createNickname('오름러버')
    expect(r.nickname).toMatch(/^오름러버#\d{4}$/)
    expect(S().nickname).toBe(r.nickname)
    expect(S().favorites).toEqual([])
    expect(S().favLoaded).toBe(false)
    expect(S().nicknameWelcome).toEqual({ nickname: r.nickname })   // 새로 만들면 '기록은 이렇게 저장돼요' 안내 창이 뜸
  })
  it('이미 있는 닉네임(#번호 포함)으로 들어갈 때는 안내 창 대신 알림만', async () => {
    useAppStore.setState({ nickname: '', nicknameWelcome: null })
    const r = await S().createNickname('오름러버#4821')
    expect(S().nicknameWelcome).toBeNull()
    expect(lastToast().message).toContain(r.nickname)
  })
  it('잘못된 이름은 안내 문구를 돌려주고 닉네임을 바꾸지 않음', async () => {
    useAppStore.setState({ nickname: '' })
    const r = await S().createNickname('가')
    expect(r.error).toContain('2글자')
    expect(S().nickname).toBe('')
  })
  it('이름#번호 로 쓰면 새로 만들지 않고 그 닉네임으로 들어감 (다른 기기)', async () => {
    useAppStore.setState({ nickname: '' })
    const r = await S().createNickname(' 오름러버#4821 ')
    expect(r).toEqual({ nickname: '오름러버#4821' })
    expect(S().nickname).toBe('오름러버#4821')
  })
  it('이미 쓰이는 번호(그 닉네임의 행이 있음)는 피해서 다시 뽑음', async () => {
    const rnd = vi.spyOn(Math, 'random').mockReturnValueOnce(0.1111).mockReturnValueOnce(0.2222)
    tables.favorites.push({ id: 100, nickname: '오름러버#1111', source: 'tour', item_id: '1', title: 'x' })
    useAppStore.setState({ nickname: '' })
    const r = await S().createNickname('오름러버')
    expect(r.nickname).toBe('오름러버#2222')
    rnd.mockRestore()
  })
  it('닉네임 없이 눌렀던 동작(pending)은 만든 뒤 이어서 실행되고 창은 닫힘', async () => {
    useAppStore.setState({ nickname: '' })
    await S().toggleVisit(oreum)                                    // 닉네임이 없으니 창이 열림
    expect(S().nicknameDialog).toEqual({ open: true, pending: { kind: 'visit', item: oreum } })
    expect(tables.visits).toHaveLength(0)
    const r = await S().createNickname('오름러버')
    expect(S().nicknameDialog.open).toBe(false)
    expect(tables.visits).toHaveLength(1)
    expect(tables.visits[0]).toMatchObject({ nickname: r.nickname, source: 'tour', item_id: '126508' })
  })
  it('닉네임이 바뀌면 가본 곳도 비우고 다시 불러오게 표시', () => {
    useAppStore.setState({ visits: [{ id: 1 }], visitLoaded: true })
    S().setNickname('다른사람#0001')
    expect(S().visits).toEqual([])
    expect(S().visitLoaded).toBe(false)
  })
  it('창 열기·닫기', () => {
    S().askNickname()
    expect(S().nicknameDialog).toEqual({ open: true, pending: null })
    S().closeNicknameDialog()
    expect(S().nicknameDialog.open).toBe(false)
  })
})

describe('가본 곳 (visits 테이블)', () => {
  it('addVisit: 닉네임·종류·id(문자열)·제목으로 저장하고 맨 앞에 추가', async () => {
    await S().addVisit(oreum)
    expect(tables.visits[0]).toMatchObject({ nickname: '오름러버#4821', source: 'tour', item_id: '126508', title: '새별오름' })
    expect(tables.favorites).toHaveLength(0)                         // 가볼만한 곳과는 따로 기록
    expect(S().visits.map((v) => v.item_id)).toEqual(['126508'])
    expect(lastToast().message).toBe('오른 오름에 기록했어요')
  })
  it('toggleVisit: 처음엔 기록, 다시 누르면 뺌, 미로딩이면 먼저 불러와 중복 저장하지 않음', async () => {
    tables.visits.push({ id: 50, nickname: '오름러버#4821', source: 'tour', item_id: '126508', title: '새별오름', created_at: 'x' })
    await S().toggleVisit(oreum)                                      // 이미 있으니 빼는 쪽
    expect(tables.visits).toHaveLength(0)
    expect(lastToast().message).toBe('오른 오름에서 뺐어요')
    await S().toggleVisit(oreum)
    expect(tables.visits).toHaveLength(1)
    expect(S().visits).toHaveLength(1)
  })
  it('같은 id 라도 종류(source)가 다르면 다른 곳', async () => {
    await S().addVisit(oreum)
    await S().toggleVisit({ source: 'heritage', id: 126508, title: '다른 곳' })
    expect(tables.visits).toHaveLength(2)
  })
  it('내 닉네임의 것만 불러옴, 삭제 정책이 없으면 안내', async () => {
    tables.visits.push(
      { id: 1, nickname: '오름러버#4821', source: 'tour', item_id: '1', title: 'a', created_at: 'x' },
      { id: 2, nickname: '다른사람#0001', source: 'tour', item_id: '2', title: 'b', created_at: 'x' },
    )
    await S().loadVisits()
    expect(S().visits.map((v) => v.id)).toEqual([1])
    expect(S().visitLoaded).toBe(true)
    allowDelete = false
    await S().removeVisit(S().visits[0])
    expect(lastToast()).toMatchObject({ variant: 'danger' })
    expect(lastToast().message).toContain('delete 정책')
    expect(S().visits).toHaveLength(1)
  })
  it('닉네임이 없으면 조회하지 않고 빈 목록', async () => {
    useAppStore.setState({ nickname: '' })
    await S().loadVisits()
    expect(S().visits).toEqual([])
    expect(S().visitLoaded).toBe(true)
  })
})
