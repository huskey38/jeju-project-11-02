import { create } from 'zustand'
import { deletePhoto, listMine, uploadPhoto } from '../lib/visitPhotos'
import { useAppStore } from './useAppStore'

// 오름 인증사진(본인만 보기) 상태 — 도감 칸과 정보 카드가 함께 씀. features.js 의 visitPhoto
const toast = (m, v) => useAppStore.getState().toast(m, v)

export const usePhotoStore = create((set, get) => ({
  photos: {},          // { [오름 id]: { path, url, at } }
  loaded: false,
  busy: {},            // { [오름 id]: true } 올리는·지우는 중
  // 이미 로그인한 기기에서만 목록을 불러옴 (사진을 안 올린 사람에게는 익명 로그인을 만들지 않음)
  load: async () => {
    if (get().loaded) return
    set({ loaded: true })
    try { set({ photos: await listMine() }) } catch (e) { set({ loaded: false }); toast(e.message, 'warning') }
  },
  upload: async (oreumId, file) => {
    const id = String(oreumId)
    set({ busy: { ...get().busy, [id]: true } })
    try {
      const photo = await uploadPhoto(id, file)
      set({ photos: { ...get().photos, [id]: photo } })
      toast('인증사진을 올렸어요 — 나만 볼 수 있어요', 'citrus')
    } catch (e) { toast(e.message, 'warning') }
    finally { const b = { ...get().busy }; delete b[id]; set({ busy: b }) }
  },
  remove: async (oreumId) => {
    const id = String(oreumId)
    set({ busy: { ...get().busy, [id]: true } })
    try {
      await deletePhoto(id)
      const p = { ...get().photos }; delete p[id]; set({ photos: p })
      toast('인증사진을 지웠어요', 'citrus')
    } catch (e) { toast(e.message, 'warning') }
    finally { const b = { ...get().busy }; delete b[id]; set({ busy: b }) }
  },
}))
