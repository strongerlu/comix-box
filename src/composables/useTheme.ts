/**
 * composables/useTheme.ts — 主题切换
 * 3 个主题：暖昼 / 曜石 / 极光
 */
import { ref, watch } from 'vue'
import { isTauriRuntime } from '@/utils/tauriEnv'

type Theme = 'light' | 'dark' | 'aurora'

/** 主题全集：切换按钮按此顺序循环，新增主题只需加在这里 + design-tokens.css 的 token 块 */
const THEME_KEYS: Theme[] = ['light', 'dark', 'aurora']

function normalizeTheme(value: string | null): Theme {
  const v = String(value || '').toLowerCase()
  if ((THEME_KEYS as string[]).includes(v)) return v as Theme
  if (v === 'dracula') return 'dark'
  return 'light'
}

function initialTheme(): Theme {
  if (!isTauriRuntime() && localStorage.getItem('jcMemoryThemeInitialized') !== '1') {
    localStorage.setItem('jcMemoryThemeInitialized', '1')
    return 'light'
  }
  return normalizeTheme(localStorage.getItem('jcTheme'))
}

const theme = ref<Theme>(initialTheme())

function apply(t: Theme) {
  const root = document.documentElement
  if (t === 'light') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', t)
  try { localStorage.setItem('jcTheme', t) } catch {}
}

apply(theme.value)
watch(theme, apply)

window.addEventListener('storage', (event) => {
  if (event?.key === 'jcTheme') {
    theme.value = normalizeTheme(event.newValue)
  }
})

export function useTheme() {
  function toggle() {
    const i = THEME_KEYS.indexOf(theme.value)
    theme.value = THEME_KEYS[(i + 1) % THEME_KEYS.length]
  }

  function setTheme(t: Theme) { theme.value = t }

  const themeIcon = ref('')
  watch(theme, (t) => {
    // 图标/文案描述的是「下一个」主题，不是当前主题
    const iconMap: Record<string, string> = {
      light: 'dark_mode', dark: 'flare', aurora: 'light_mode',
    }
    themeIcon.value = iconMap[t] || 'dark_mode'
  }, { immediate: true })

  const themeLabel = ref('')
  watch(theme, (t) => {
    const labelMap: Record<string, string> = {
      light: '切换曜石模式', dark: '切换极光模式', aurora: '切换暖昼模式',
    }
    themeLabel.value = labelMap[t] || '切换曜石模式'
  }, { immediate: true })

  return { theme, toggle, setTheme, themeIcon, themeLabel }
}
