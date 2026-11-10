import { computed, nextTick, ref, type Ref } from 'vue'

export type ComposerMenuAnchor = { left: number; bottom: number }

/**
 * 输入框底部的三个弹出菜单（权限、创作 Skill、漫剧模式）与芯片提示。
 *
 * 只管“哪个菜单开着、开在哪、焦点去哪”；选了菜单项之后做什么由组件决定。
 * 菜单使用 fixed 定位，确保不受输入区布局及祖先容器裁剪影响。
 */
export function useComposerMenus() {
  const permissionMenu = ref<ComposerMenuAnchor | null>(null)
  const composerSkillMenu = ref<ComposerMenuAnchor | null>(null)
  const manjuMenu = ref<ComposerMenuAnchor | null>(null)
  // fixed 提示不受输入区裁剪；输入工具在窗口底部，文字显示在按钮上方。
  const chipTip = ref<{ text: string; left: number; top: number } | null>(null)
  let trigger: HTMLElement | null = null

  const anyComposerMenuOpen = computed(() =>
    Boolean(permissionMenu.value || composerSkillMenu.value || manjuMenu.value))

  function hideChipTip() {
    chipTip.value = null
  }

  function showChipTip(event: Event, text: string) {
    const rect = (event.currentTarget as HTMLElement | null)?.getBoundingClientRect()
    if (!rect) return
    chipTip.value = { text, left: rect.left + rect.width / 2, top: Math.max(8, rect.top - 36) }
  }

  function closeComposerMenus(restoreFocus = false) {
    permissionMenu.value = null
    composerSkillMenu.value = null
    manjuMenu.value = null
    hideChipTip()
    if (restoreFocus) trigger?.focus()
  }

  async function focusComposerMenu(id: string) {
    await nextTick()
    const menu = document.getElementById(id)
    const selected = menu?.querySelector<HTMLButtonElement>('button[aria-checked="true"]:not(:disabled)')
    const target = selected || menu?.querySelector<HTMLButtonElement>('button:not(:disabled)')
    target?.focus()
  }

  /** 已开着就关上；否则关掉其他菜单，在触发按钮上方打开它并聚焦。 */
  function openComposerMenu(menu: Ref<ComposerMenuAnchor | null>, event: MouseEvent | KeyboardEvent, focusId: string) {
    const wasOpen = Boolean(menu.value)
    closeComposerMenus()
    if (wasOpen) return
    trigger = event.currentTarget as HTMLElement
    const rect = trigger.getBoundingClientRect()
    menu.value = {
      left: Math.max(12, Math.min(rect.left, window.innerWidth - 332)),
      bottom: Math.max(12, window.innerHeight - rect.top + 8),
    }
    void focusComposerMenu(focusId)
  }

  function handleComposerMenuKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      closeComposerMenus(true)
      return
    }
    if (event.key === 'Tab') { closeComposerMenus(); return }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    const buttons = Array.from((event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
    if (!buttons.length) return
    event.preventDefault()
    event.stopPropagation()
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
      : current < 0 ? (event.key === 'ArrowDown' ? 0 : buttons.length - 1)
      : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
    buttons[index]?.focus()
  }

  return {
    permissionMenu, composerSkillMenu, manjuMenu, chipTip, anyComposerMenuOpen,
    showChipTip, hideChipTip, closeComposerMenus, focusComposerMenu, openComposerMenu, handleComposerMenuKeydown,
  }
}
