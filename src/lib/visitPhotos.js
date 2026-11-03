import { createClient } from '@supabase/supabase-js'

// [오름 인증사진 — 1단계: 본인만 보기] 가본 오름에 내 사진 한 장을 붙임. features.js 의 visitPhoto
// 익명 로그인(기기마다 고유 번호)으로 본인만 접근하게 하며, 닉네임 기반인 즐겨찾기·가본 곳과 영향이 없도록 로그인 상태를 저장하는 곳이 다른 별도 클라이언트를 씀
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
export const photoClient = url && key ? createClient(url, key, { auth: { storageKey: 'oreum-photo-auth', persistSession: true, autoRefreshToken: true } }) : null

export const BUCKET = 'oreum-photos'
export const MAX_SIDE = 1024          // 올리기 전에 긴 변을 이 크기로 줄임
export const MAX_INPUT_BYTES = 20 * 1024 * 1024   // 원본이 너무 크면 거절
export const photoPath = (uid, oreumId) => `${uid}/${oreumId}.jpg`

// 가로·세로를 긴 변 기준 max 이하로 (이미 작으면 그대로)
export function fitSize(w, h, max = MAX_SIDE) {
  const scale = Math.min(1, max / Math.max(w, h))
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) }
}

export function checkFile(file) {
  if (!file) return '사진을 고르지 못했어요'
  if (!/^image\//.test(file.type)) return '사진 파일(JPEG·PNG·WebP)만 올릴 수 있어요'
  if (file.size > MAX_INPUT_BYTES) return '사진이 너무 커요 (20MB 이하)'
  return ''
}

// 사진을 읽어 JPEG 로 다시 그림: 크기를 줄이고, 다시 인코딩하므로 사진 속 위치(EXIF) 등 정보가 모두 사라짐
export async function toJpeg(file, max = MAX_SIDE, quality = 0.82) {
  let bitmap
  try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }) }
  catch { throw new Error('이 사진 형식은 읽을 수 없어요 (JPEG·PNG·WebP 로 올려 주세요)') }
  const { w, h } = fitSize(bitmap.width, bitmap.height, max)
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality))
  if (!blob) throw new Error('사진을 줄이지 못했어요')
  return blob
}

// 익명 로그인 세션 (없으면 만듦). 기능이 꺼져 있거나 Supabase 설정이 없으면 오류
export async function ensureUser() {
  if (!photoClient) throw new Error('Supabase 설정(.env.local)이 필요해요')
  const { data } = await photoClient.auth.getSession()
  if (data.session?.user) return data.session.user
  const { data: s, error } = await photoClient.auth.signInAnonymously()
  if (error) {
    throw new Error(/anonymous/i.test(error.code ?? error.message) ? 'Supabase 에서 익명 로그인을 켜 주세요 (Authentication → Providers → Anonymous)' : error.message)
  }
  return s.user
}

// 지금 로그인돼 있으면 그 사용자(없으면 null — 사진을 한 번도 안 올린 사람은 로그인을 만들지 않음)
export async function currentUser() {
  if (!photoClient) return null
  const { data } = await photoClient.auth.getSession()
  return data.session?.user ?? null
}

// 내 사진 목록: { [오름 id]: { path, url } } — url 은 1시간짜리 임시 주소(비공개 버킷)
export async function listMine() {
  const user = await currentUser()
  if (!user) return {}
  const { data: rows, error } = await photoClient.from('visit_photos').select('oreum_id, path, created_at')
  if (error) throw new Error(/visit_photos/.test(error.message) ? '인증사진에는 Supabase visit_photos 테이블이 필요해요 — README 의 SQL 을 실행해 주세요' : error.message)
  if (!rows.length) return {}
  const { data: signed, error: e2 } = await photoClient.storage.from(BUCKET).createSignedUrls(rows.map((r) => r.path), 3600)
  if (e2) throw new Error(e2.message)
  const urlOf = new Map(signed.map((s) => [s.path, s.signedUrl]))
  return Object.fromEntries(rows.filter((r) => urlOf.get(r.path)).map((r) => [r.oreum_id, { path: r.path, url: urlOf.get(r.path), at: r.created_at }]))
}

export async function uploadPhoto(oreumId, file) {
  const bad = checkFile(file)
  if (bad) throw new Error(bad)
  const blob = await toJpeg(file)
  const user = await ensureUser()
  const path = photoPath(user.id, oreumId)
  const up = await photoClient.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: true })
  if (up.error) throw new Error(/bucket/i.test(up.error.message) ? '인증사진 버킷이 없어요 — README 의 SQL 을 실행해 주세요' : up.error.message)
  const row = await photoClient.from('visit_photos').upsert({ oreum_id: String(oreumId), path }, { onConflict: 'user_id,oreum_id' })
  if (row.error) throw new Error(row.error.message)
  const { data, error } = await photoClient.storage.from(BUCKET).createSignedUrl(path, 3600)
  if (error) throw new Error(error.message)
  return { path, url: data.signedUrl, at: new Date().toISOString() }
}

export async function deletePhoto(oreumId) {
  const user = await ensureUser()
  const path = photoPath(user.id, oreumId)
  const { error } = await photoClient.storage.from(BUCKET).remove([path])
  if (error) throw new Error(error.message)
  const del = await photoClient.from('visit_photos').delete().eq('oreum_id', String(oreumId))
  if (del.error) throw new Error(del.error.message)
}
