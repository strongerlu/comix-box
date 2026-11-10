import assert from 'node:assert/strict'
import { test } from 'node:test'
import { nextTick } from 'vue'

import { useComposerMenus } from '../useComposerMenus'

async function withGlobals(globals: Record<string, unknown>, run: () => void) {
  const previous = Object.fromEntries(Object.keys(globals).map(key => [key, (globalThis as Record<string, unknown>)[key]]))
  Object.assign(globalThis, globals)
  try {
    run()
    await nextTick()
  } finally { Object.assign(globalThis, previous) }
}

test('composer menu anchors stay inside the viewport near the right and top edges', async () => {
  const viewport = { innerWidth: 1280, innerHeight: 800 }
  const trigger = { getBoundingClientRect: () => ({ left: 1240, top: 760 }), focus() {} }
  await withGlobals({ window: viewport, document: { getElementById: () => null } }, () => {
    const menus = useComposerMenus()
    menus.openComposerMenu(menus.permissionMenu, { currentTarget: trigger } as never, 'menu')
    assert.deepEqual(menus.permissionMenu.value, { left: 948, bottom: 48 })
    viewport.innerWidth = 220
    trigger.getBoundingClientRect = () => ({ left: 210, top: 810 })
    menus.closeComposerMenus()
    menus.openComposerMenu(menus.manjuMenu, { currentTarget: trigger } as never, 'menu')
    assert.deepEqual(menus.manjuMenu.value, { left: 12, bottom: 12 })
  })
})

test('opening an open menu closes it, and opening another closes the rest', async () => {
  const trigger = { getBoundingClientRect: () => ({ left: 10, top: 700 }), focus() {} }
  await withGlobals({ window: { innerWidth: 1280, innerHeight: 800 }, document: { getElementById: () => null } }, () => {
    const menus = useComposerMenus()
    const event = { currentTarget: trigger } as never
    menus.openComposerMenu(menus.composerSkillMenu, event, 'menu')
    menus.openComposerMenu(menus.permissionMenu, event, 'menu')
    assert.equal(menus.composerSkillMenu.value, null)
    assert.ok(menus.permissionMenu.value)
    assert.equal(menus.anyComposerMenuOpen.value, true)
    menus.openComposerMenu(menus.permissionMenu, event, 'menu')
    assert.equal(menus.permissionMenu.value, null)
    assert.equal(menus.anyComposerMenuOpen.value, false)
  })
})

test('permission tooltip stays above the bottom composer instead of outside the window', () => {
  const menus = useComposerMenus()
  const rect = { left: 1200, top: 760, bottom: 792, width: 32 }
  menus.showChipTip({ currentTarget: { getBoundingClientRect: () => rect } } as never, '权限：工作区内修改')
  assert.ok(menus.chipTip.value && menus.chipTip.value.top < rect.top)
  menus.closeComposerMenus()
  assert.equal(menus.chipTip.value, null)
})

test('composer menu keyboard navigation wraps, supports Home/End and restores focus on Escape', async () => {
  const calls: string[] = []
  const document = { activeElement: null as unknown, getElementById: () => null }
  const buttons = [0, 1, 2].map(index => ({ focus() { document.activeElement = buttons[index] } }))
  const trigger = { getBoundingClientRect: () => ({ left: 10, top: 700 }), focus() { calls.push('trigger-focus') } }
  await withGlobals({ window: { innerWidth: 1280, innerHeight: 800 }, document }, () => {
    const menus = useComposerMenus()
    menus.openComposerMenu(menus.permissionMenu, { currentTarget: trigger } as never, 'menu')
    const key = (value: string) => menus.handleComposerMenuKeydown({ key: value,
      currentTarget: { querySelectorAll: () => buttons },
      preventDefault() { calls.push('prevent') }, stopPropagation() { calls.push('stop') },
    } as never)
    key('ArrowUp')
    assert.equal(document.activeElement, buttons[2])
    key('ArrowDown')
    assert.equal(document.activeElement, buttons[0])
    key('End')
    assert.equal(document.activeElement, buttons[2])
    key('Home')
    assert.equal(document.activeElement, buttons[0])
    calls.length = 0
    key('Escape')
    assert.deepEqual(calls, ['prevent', 'stop', 'trigger-focus'])
    assert.equal(menus.permissionMenu.value, null)
    menus.openComposerMenu(menus.permissionMenu, { currentTarget: trigger } as never, 'menu')
    calls.length = 0
    key('Tab')
    assert.deepEqual(calls, [])
    assert.equal(menus.permissionMenu.value, null)
  })
})
