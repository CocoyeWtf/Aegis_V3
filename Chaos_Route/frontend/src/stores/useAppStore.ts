/* Store principal de l'application / Main application store */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AppState {
  theme: 'dark' | 'light'
  language: string
  selectedCountryId: number | null
  selectedRegionId: number | null
  sidebarCollapsed: boolean
  isFullscreen: boolean
  toggleTheme: () => void
  setLanguage: (lang: string) => void
  setSelectedCountry: (id: number | null) => void
  setSelectedRegion: (id: number | null) => void
  toggleSidebar: () => void
  toggleFullscreen: () => void
  exitFullscreen: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: 'light',
      language: 'fr',
      selectedCountryId: null,
      selectedRegionId: null,
      sidebarCollapsed: false,
      isFullscreen: false,

      toggleTheme: () =>
        set((state) => {
          const newTheme = state.theme === 'dark' ? 'light' : 'dark'
          document.documentElement.classList.toggle('light', newTheme === 'light')
          return { theme: newTheme }
        }),

      setLanguage: (lang) => set({ language: lang }),
      setSelectedCountry: (id) => set({ selectedCountryId: id, selectedRegionId: null }),
      setSelectedRegion: (id) => set({ selectedRegionId: id }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      toggleFullscreen: () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {})
        } else {
          document.exitFullscreen().catch(() => {})
        }
      },
      exitFullscreen: () => {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {})
        }
      },
    }),
    {
      name: 'chaos-route-prefs',
      partialize: (state) => ({
        theme: state.theme,
        language: state.language,
        selectedCountryId: state.selectedCountryId,
        selectedRegionId: state.selectedRegionId,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    },
  ),
)
