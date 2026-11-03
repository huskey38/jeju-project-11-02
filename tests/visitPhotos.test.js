import { beforeEach, describe, expect, it, vi } from 'vitest'

// 브라우저 캔버스가 없는 노드 환경이라, 이미지 변환(toJpeg)은 모킹하고 올리기·목록·삭제 흐름을 확인
const calls = []
const store = { rows: [] }
const client = {
  auth: {
    getSession: vi.fn(async () => ({ data: { session: client._user ? { user: client._user } : null } })),
    signInAnonymously: vi.fn(async () => { client._user = { id: 'u-1' }; return { data: { user: client._user }, error: null } }),
  },
  storage: { from: () => ({
    upload: vi.fn(async (path, blob, opt) => { calls.push(['upload', path, opt]); return { error: null } }),
    remove: vi.fn(async (paths) => { calls.push(['remove', paths]); return { error: null } }),
    createSignedUrl: vi.fn(async (path) => ({ data: { signedUrl: 'https://x/' + path }, error: null })),
    createSignedUrls: vi.fn(async (paths) => ({ data: paths.map((p) => ({ path: p, signedUrl: 'https://x/' + p })), error: null })),
  }) },
  from: () => ({
    upsert: vi.fn(async (row, opt) => { calls.push(['upsert', row, opt]); store.rows = [{ oreum_id: row.oreum_id, path: row.path, created_at: 'now' }]; return { error: null } }),
    select: vi.fn(async () => ({ data: store.rows, error: null })),
    delete: () => ({ eq: vi.fn(async () => { calls.push(['delete']); store.rows = []; return { error: null } }) }),
  }),
}
vi.mock('@supabase/supabase-js', () => ({ createClient: () => client }))
vi.stubEnv('VITE_SUPABASE_URL', 'https://x.supabase.co')
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'k')

const mod = await import('../src/lib/visitPhotos.js')

beforeEach(() => { calls.length = 0; store.rows = []; client._user = null; client.auth.signInAnonymously.mockClear() })

describe('visitPhotos — 순수 계산', () => {
  it('fitSize: 긴 변 기준으로 줄이고, 작은 사진은 그대로', () => {
    expect(mod.fitSize(4000, 3000)).toEqual({ w: 1024, h: 768 })
    expect(mod.fitSize(3000, 4000)).toEqual({ w: 768, h: 1024 })
    expect(mod.fitSize(500, 400)).toEqual({ w: 500, h: 400 })
  })
  it('checkFile: 이미지가 아니거나 너무 크면 거절', () => {
    expect(mod.checkFile({ type: 'image/jpeg', size: 1000 })).toBe('')
    expect(mod.checkFile({ type: 'application/pdf', size: 1000 })).toMatch(/사진 파일/)
    expect(mod.checkFile({ type: 'image/png', size: 30 * 1024 * 1024 })).toMatch(/너무 커요/)
    expect(mod.checkFile(null)).toBeTruthy()
  })
  it('photoPath: 사용자 번호 폴더 아래 오름 id', () => { expect(mod.photoPath('u-1', '44')).toBe('u-1/44.jpg') })
})

describe('visitPhotos — 로그인·올리기·목록·삭제', () => {
  it('사진을 한 번도 안 올렸으면 목록을 불러와도 익명 로그인을 만들지 않음', async () => {
    expect(await mod.listMine()).toEqual({})
    expect(client.auth.signInAnonymously).not.toHaveBeenCalled()
  })
  it('올리기: 익명 로그인 → 사용자 폴더에 저장 → 표에 기록 → 임시 주소', async () => {
    const jpeg = vi.spyOn(mod, 'toJpeg')
    globalThis.createImageBitmap = vi.fn(async () => ({ width: 2000, height: 1000, close() {} }))
    globalThis.document = { createElement: () => ({ getContext: () => ({ drawImage() {} }), toBlob: (cb) => cb(new Blob(['x'])) }) }
    const r = await mod.uploadPhoto('44', { type: 'image/jpeg', size: 5000 })
    expect(client.auth.signInAnonymously).toHaveBeenCalledTimes(1)
    expect(calls[0]).toEqual(['upload', 'u-1/44.jpg', { contentType: 'image/jpeg', upsert: true }])
    expect(calls[1][0]).toBe('upsert')
    expect(calls[1][1]).toEqual({ oreum_id: '44', path: 'u-1/44.jpg' })
    expect(calls[1][2]).toEqual({ onConflict: 'user_id,oreum_id' })
    expect(r.url).toBe('https://x/u-1/44.jpg')
    jpeg.mockRestore()
  })
  it('올린 뒤에는 목록에 오름 id 로 나오고, 지우면 파일과 행이 모두 지워짐', async () => {
    globalThis.createImageBitmap = vi.fn(async () => ({ width: 100, height: 100, close() {} }))
    await mod.uploadPhoto('7', { type: 'image/png', size: 100 })
    const mine = await mod.listMine()
    expect(Object.keys(mine)).toEqual(['7'])
    expect(mine['7'].url).toContain('u-1/7.jpg')
    calls.length = 0
    await mod.deletePhoto('7')
    expect(calls.map((c) => c[0])).toEqual(['remove', 'delete'])
  })
  it('이미지가 아닌 파일은 올리기 전에 거절', async () => {
    await expect(mod.uploadPhoto('1', { type: 'text/plain', size: 10 })).rejects.toThrow(/사진 파일/)
    expect(client.auth.signInAnonymously).not.toHaveBeenCalled()
  })
})
