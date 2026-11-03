import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabase'
import { askAgent } from '../api/client'
import { isFullNickname, validateName, withTag } from '../lib/nickname'

// ── 앱 전체가 함께 쓰는 상태(store) ──────────────────────
// 여러 페이지에서 같이 쓰는 데이터는 여기에 둡니다. (한 페이지에서만 쓰면 useState)
// 사용법:  const nickname = useAppStore((s) => s.nickname)
export const useAppStore = create(
  persist(
    (set, get) => ({
      // ① 사용자 — localStorage 에 저장되어 새로고침해도 유지
      nickname: '',
      // 닉네임이 바뀌면 다른 사람의 목록이므로 가볼만한 곳·가본 곳을 비우고 다시 불러오게 함
      setNickname: (nickname) => set({ nickname: nickname.trim(), favorites: [], favLoaded: false, visits: [], visitLoaded: false }),

      // 닉네임 만들기 창: 닉네임이 없을 때 감귤·가봤어요를 누르면 열리고, 만들고 나면 눌렀던 동작(pending)을 이어서 실행
      nicknameDialog: { open: false, pending: null },
      askNickname: (pending = null) => set({ nicknameDialog: { open: true, pending } }),
      closeNicknameDialog: () => set({ nicknameDialog: { open: false, pending: null } }),
      nicknameWelcome: null,   // 닉네임을 새로 만든 직후 띄우는 '기록은 이렇게 저장돼요' 안내 { nickname } (닫기 버튼으로 닫음)
      closeNicknameWelcome: () => set({ nicknameWelcome: null }),
      // raw: "이름" (뒤에 #번호 4자리를 붙여 새로 만듦) 또는 "이름#1234" (이미 있는 닉네임으로 들어감). 반환: { nickname } 또는 { error }
      createNickname: async (raw) => {
        const text = String(raw ?? '').trim()
        let nickname = text
        if (!isFullNickname(text)) {
          const error = validateName(text)
          if (error) return { error }
          nickname = ''
          // 같은 번호가 이미 쓰이고 있으면(그 닉네임의 행이 있으면) 다른 번호로 다시 뽑음
          for (let i = 0; i < 8 && !nickname; i++) {
            const cand = withTag(text)
            if (!supabase) { nickname = cand; break }
            const [f, v] = await Promise.all(['favorites', 'visits'].map((t) => supabase.from(t).select('id').eq('nickname', cand)))
            if (!(f.data?.length || v.data?.length)) nickname = cand
          }
          if (!nickname) return { error: '번호를 정하지 못했어요. 잠시 뒤 다시 시도해 주세요' }
        }
        const pending = get().nicknameDialog.pending
        const isNew = !isFullNickname(text)
        get().setNickname(nickname)
        set({ nicknameDialog: { open: false, pending: null }, ...(isNew ? { nicknameWelcome: { nickname } } : {}) })
        if (!isNew) get().toast(`닉네임은 ${nickname} 이에요 — 다른 기기에서는 번호까지 입력하면 같은 목록이 보여요`, 'citrus')
        if (pending) await (pending.kind === 'visit' ? get().toggleVisit(pending.item) : get().toggleFavorite(pending.item))
        return { nickname }
      },

      // ② 알림(토스트) — 어느 페이지에서든 get().toast('메시지')
      toasts: [],
      toast: (message, variant = 'success') => {   // variant: success·warning·danger(부트스트랩 색) 또는 citrus(감귤색, 가볼만한 곳 담기·빼기)
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
        if (!get().nickname) return set({ favorites: [], favLoaded: true })   // 닉네임이 없으면 내 목록도 없음
        set({ favLoading: true })
        const { data, error } = await supabase
          .from('favorites').select('*')
          .eq('nickname', get().nickname)
          .order('created_at', { ascending: false })
        set({ favLoading: false })
        if (error) return get().toast(error.message, 'danger')
        set({ favorites: data, favLoaded: true })
      },
      addFavorite: async ({ source, id, title }) => {
        if (!supabase) return get().toast('Supabase 설정(.env.local)이 필요해요', 'warning')
        if (!get().nickname) return get().askNickname({ kind: 'fav', item: { source, id, title } })   // 닉네임부터 만들게 함 (예전처럼 '익명' 으로 섞어 저장하지 않음)
        const row = { nickname: get().nickname, source, item_id: String(id), title }
        const { data, error } = await supabase.from('favorites').insert(row).select().single()
        if (error) return get().toast(error.message, 'danger')
        set({ favorites: [data, ...get().favorites] })
        get().toast('담아 뒀어요', 'citrus')
      },
      // 가볼만한 곳에서 빼기: favorites 행(id 필요) 하나를 지움
      removeFavorite: async (row) => {
        if (!supabase) return get().toast('Supabase 설정(.env.local)이 필요해요', 'warning')
        const { data, error } = await supabase.from('favorites').delete().eq('id', row.id).select()
        if (error) return get().toast(error.message, 'danger')
        // RLS 에 delete 정책이 없으면 오류 없이 0건만 지워짐 → 사용자에게 원인을 알려줌
        if (!data?.length) return get().toast('담아둔 곳에서 빼지 못했어요 — Supabase favorites 테이블에 delete 정책이 필요해요', 'danger')
        set({ favorites: get().favorites.filter((f) => f.id !== row.id) })
        get().toast('담아둔 곳에서 뺐어요', 'citrus')
      },
      // 감귤 아이콘 클릭: 이미 담겨 있으면 빼고, 아니면 담음
      toggleFavorite: async (item) => {
        if (!get().nickname) return get().askNickname({ kind: 'fav', item })
        if (!get().favLoaded) await get().loadFavorites()   // 아직 못 불러왔으면 중복 저장하지 않도록 먼저 확인
        const existing = get().favorites.find((f) => f.source === item.source && f.item_id === String(item.id))
        return existing ? get().removeFavorite(existing) : get().addFavorite(item)
      },

      // ③-2 가본 곳 — Supabase visits 테이블(favorites 와 같은 모양)과 동기화. 가볼만한 곳과 따로 기록함
      visits: [],
      visitLoading: false,
      visitLoaded: false,
      lastVisit: null,   // 방금 가본 곳에 기록한 한 건 { source, item_id, title, at } — 연출(VisitEffect)이 씀
      loadVisits: async () => {
        if (!supabase) return get().toast('Supabase 설정(.env.local)이 필요해요', 'warning')
        if (!get().nickname) return set({ visits: [], visitLoaded: true })
        set({ visitLoading: true })
        const { data, error } = await supabase
          .from('visits').select('*')
          .eq('nickname', get().nickname)
          .order('created_at', { ascending: false })
        set({ visitLoading: false })
        // visits 테이블을 아직 안 만들었으면 알아볼 수 있게 안내 (README 의 SQL 로 만들기)
        if (error) return get().toast(/visits/.test(error.message) && /(schema cache|does not exist)/.test(error.message) ? '오른 오름 기능에는 Supabase visits 테이블이 필요해요 — README 의 SQL 을 실행해 주세요' : error.message, 'warning')
        set({ visits: data, visitLoaded: true })
      },
      addVisit: async ({ source, id, title }) => {
        if (!supabase) return get().toast('Supabase 설정(.env.local)이 필요해요', 'warning')
        if (!get().nickname) return get().askNickname({ kind: 'visit', item: { source, id, title } })
        const row = { nickname: get().nickname, source, item_id: String(id), title }
        const { data, error } = await supabase.from('visits').insert(row).select().single()
        if (error) return get().toast(error.message, 'danger')
        set({ visits: [data, ...get().visits], lastVisit: { source, item_id: String(id), title, at: Date.now() } })
        get().toast('오른 오름에 기록했어요')
      },
      removeVisit: async (row) => {
        if (!supabase) return get().toast('Supabase 설정(.env.local)이 필요해요', 'warning')
        const { data, error } = await supabase.from('visits').delete().eq('id', row.id).select()
        if (error) return get().toast(error.message, 'danger')
        if (!data?.length) return get().toast('오른 오름에서 빼지 못했어요 — Supabase visits 테이블에 delete 정책이 필요해요', 'danger')
        set({ visits: get().visits.filter((v) => v.id !== row.id) })
        get().toast('오른 오름에서 뺐어요')
      },
      // '가봤어요' 버튼: 이미 기록돼 있으면 빼고, 아니면 기록
      toggleVisit: async (item) => {
        if (!get().nickname) return get().askNickname({ kind: 'visit', item })
        if (!get().visitLoaded) await get().loadVisits()
        const existing = get().visits.find((v) => v.source === item.source && v.item_id === String(item.id))
        return existing ? get().removeVisit(existing) : get().addVisit(item)
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
