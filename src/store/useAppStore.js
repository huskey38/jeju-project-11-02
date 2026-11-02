import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabase'
import { askAgent } from '../api/client'

// ── 앱 전체가 함께 쓰는 상태(store) ──────────────────────
// 여러 페이지에서 같이 쓰는 데이터는 여기에 둡니다. (한 페이지에서만 쓰면 useState)
// 사용법:  const nickname = useAppStore((s) => s.nickname)
export const useAppStore = create(
  persist(
    (set, get) => ({
      // ① 사용자 — localStorage 에 저장되어 새로고침해도 유지
      nickname: '',
      // 닉네임이 바뀌면 다른 사람의 즐겨찾기이므로 비우고 다시 불러오게 함
      setNickname: (nickname) => set({ nickname: nickname.trim(), favorites: [], favLoaded: false }),

      // ② 알림(토스트) — 어느 페이지에서든 get().toast('메시지')
      toasts: [],
      toast: (message, variant = 'success') => {
        const id = Date.now() + Math.random()
        set({ toasts: [...get().toasts, { id, message, variant }] })
        setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), 2500)
      },

      // ③ 즐겨찾기 — Supabase favorites 테이블과 동기화 (STEP 5)
      favorites: [],
      favLoading: false,
      favLoaded: false,       // 닉네임의 즐겨찾기를 한 번이라도 불러왔는지 (감귤 아이콘의 담김 표시·중복 방지에 필요)
      loadFavorites: async () => {
        if (!supabase) return get().toast('Supabase 설정(.env.local)이 필요해요', 'warning')
        set({ favLoading: true })
        const { data, error } = await supabase
          .from('favorites').select('*')
          .eq('nickname', get().nickname || '익명')
          .order('created_at', { ascending: false })
        set({ favLoading: false })
        if (error) return get().toast(error.message, 'danger')
        set({ favorites: data, favLoaded: true })
      },
      addFavorite: async ({ source, id, title }) => {
        if (!supabase) return get().toast('Supabase 설정(.env.local)이 필요해요', 'warning')
        const row = { nickname: get().nickname || '익명', source, item_id: String(id), title }
        const { data, error } = await supabase.from('favorites').insert(row).select().single()
        if (error) return get().toast(error.message, 'danger')
        set({ favorites: [data, ...get().favorites] })
        get().toast('즐겨찾기에 담았어요')
      },
      // 즐겨찾기에서 빼기: favorites 행(id 필요) 하나를 지움
      removeFavorite: async (row) => {
        if (!supabase) return get().toast('Supabase 설정(.env.local)이 필요해요', 'warning')
        const { data, error } = await supabase.from('favorites').delete().eq('id', row.id).select()
        if (error) return get().toast(error.message, 'danger')
        // RLS 에 delete 정책이 없으면 오류 없이 0건만 지워짐 → 사용자에게 원인을 알려줌
        if (!data?.length) return get().toast('즐겨찾기를 빼지 못했어요 — Supabase favorites 테이블에 delete 정책이 필요해요', 'danger')
        set({ favorites: get().favorites.filter((f) => f.id !== row.id) })
        get().toast('즐겨찾기에서 뺐어요')
      },
      // 감귤 아이콘 클릭: 이미 담겨 있으면 빼고, 아니면 담음
      toggleFavorite: async (item) => {
        if (!get().favLoaded) await get().loadFavorites()   // 아직 못 불러왔으면 중복 저장하지 않도록 먼저 확인
        const existing = get().favorites.find((f) => f.source === item.source && f.item_id === String(item.id))
        return existing ? get().removeFavorite(existing) : get().addFavorite(item)
      },

      // ④ STEP 6: 에이전트 대화 — 페이지를 옮겨도 대화가 남도록 store 에 둡니다
      messages: [],          // { role: 'user' | 'assistant', text, steps }
      chatLoading: false,
      sendMessage: async (text) => {
        const history = get().messages.map((m) => ({ role: m.role, content: m.text }))  // Claude 형식
        set({ messages: [...get().messages, { role: 'user', text }], chatLoading: true })
        try {
          const { answer, steps } = await askAgent(text, history)
          set({ messages: [...get().messages, { role: 'assistant', text: answer, steps }] })
        } catch (e) {
          get().toast(e.message, 'danger')
        } finally {
          set({ chatLoading: false })
        }
      },
    }),
    {
      name: 'jeju-ip-store',                          // localStorage 키 이름
      partialize: (s) => ({ nickname: s.nickname }),  // 저장할 항목만 고르기
    },
  ),
)
