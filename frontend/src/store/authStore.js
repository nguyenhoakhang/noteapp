import { create } from 'zustand'
import api from '../api/axios'
import { clearAll as clearPasswordSessions } from '../offline/sessionStore'
import { clearCache } from '../offline/noteCache'
import { clearQueue } from '../offline/syncQueue'

const useAuthStore = create((set) => ({
  user: null,
  baseURL: 'http://localhost:5173/api', // Chạy qua Proxy của Vite
  token: localStorage.getItem('token') || null,
  loading: true,

  setAuth: (user, token) => {
    localStorage.setItem('token', token)
    set({ user, token })
  },

  logout: async () => {
    try { await api.post('/logout') } catch {}
    localStorage.removeItem('token')
    // Clear all sensitive local data
    clearPasswordSessions()
    clearCache().catch(() => {})
    clearQueue().catch(() => {})
    set({ user: null, token: null })
  },

  fetchMe: async () => {
    try {
      const { data } = await api.get('/me')
      set({ user: data, loading: false })
    } catch {
      set({ user: null, token: null, loading: false })
      localStorage.removeItem('token')
    }
  },

  updateUser: (data) => set((s) => ({ user: { ...s.user, ...data } })),
}))

export default useAuthStore