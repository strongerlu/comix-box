import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const source = path => readFileSync(path, 'utf8')

test('account actions remove referral and check-in while retaining model key and billing actions', () => {
  for (const path of ['src/components/auth/JcCloudLoginBox.vue', 'jc-cloud-login-component/JcCloudLoginBox.vue']) {
    assert.equal(/邀请赚米|白嫖签到|group_add|event_available/.test(source(path)), false, path)
  }
  const login = source('src/components/auth/JcCloudLoginBox.vue')
  for (const text of ['充值', '使用日志', '管理密钥', '一键抄配置', '模型调用 Key']) assert.ok(login.includes(text), text)
  assert.equal(/gatewayCheckin|gatewayAffiliate|affCode|aff_code/.test(source('src/services/newApiClient.ts')), false)
  assert.equal(/buildInviteUrl/.test(source('src/utils/userCenter.ts')), false)
})

test('the application has no update entry, auto-check, install command or updater dependency', () => {
  for (const path of ['src/components/memory/DesktopUpdateSettings.vue', 'src/services/desktopUpdater.ts',
    'src/services/desktopUpdatePreparation.ts', 'src-tauri/src/commands/desktop_update.rs']) {
    assert.equal(existsSync(path), false, path)
  }
  for (const path of ['src/App.vue', 'src/components/memory/MemorySettings.vue',
    'src/components/memory/MemoryWorkbench.vue', 'src-tauri/src/lib.rs', 'src-tauri/permissions/app-commands.json']) {
    assert.equal(/desktopUpdater|desktopUpdateStatus|DesktopUpdateSettings|desktop_update|updater-relaunch/.test(source(path)), false, path)
  }
  assert.equal(JSON.parse(source('src-tauri/tauri.conf.json')).plugins.updater, undefined)
  assert.equal(source('src-tauri/Cargo.toml').includes('tauri-plugin-updater'), false)
})

test('removing update gates retains native desktop commands and scene save validation', () => {
  const native = source('src-tauri/src/lib.rs')
  for (const name of ['commands::screenshot::screenshot_begin', 'commands::workspace::open_new_window',
    'commands::mcp::mcp_spawn_stdio', 'commands::creation_mcp::resolve_creation_mcp']) assert.ok(native.includes(name), name)
  const workbench = source('src/components/memory/MemoryWorkbench.vue')
  assert.ok(workbench.includes('sceneSaveQueue'))
  assert.ok(workbench.includes('projectMapSaveQueue'))
  assert.ok(workbench.includes('flushCanvasSave'))
})
