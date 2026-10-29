import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const source = path => readFileSync(path, 'utf8')
const config = JSON.parse(source('src-tauri/tauri.conf.json'))

test('COMIC-BOX owns a distinct Windows install, mutex, profile and protocol identity', () => {
  assert.equal(config.identifier, 'com.comicbox.desktop')
  assert.equal(config.productName, 'COMIC-BOX')
  assert.match(source('src-tauri/Cargo.toml'), /\[package\]\s+name = "comic-box"/)
  assert.deepEqual(config.plugins['deep-link'].desktop.schemes, ['comic-box'])
  assert.equal(config.plugins.updater, undefined)
  assert.equal(config.bundle.windows.nsis.startMenuFolder, 'COMIC-BOX')
})

test('COMIC-BOX does not write the original credential, session, plugin or MCP discovery namespace', () => {
  for (const path of ['src-tauri/src/secure_store.rs', 'src-tauri/src/commands/session.rs',
    'src-tauri/src/commands/plugin.rs', 'src-tauri/src/commands/creation_mcp.rs',
    'scripts/jiucaihezi-creation-mcp/index.ts', 'src-tauri/resources/deepseek-harness/plugins/creation-tools/index.mjs']) {
    assert.doesNotMatch(source(path), /["']\.jiucaihezi["']/)
    assert.match(source(path), /\.comic-box/)
  }
  assert.match(source('src-tauri/src/secure_store.rs'), /com\.comicbox\.app/)
  assert.match(source('src/utils/idb.ts'), /legacyDataDir: joinTauriPath\(homeDir, '\.comic-box', 'data'\)/)
  assert.match(source('src-tauri/src/skills/path_utils.rs'), /join\("\.comic-box"\)\.join\("skillsmanage"\)/)
})

test('COMIC-BOX callbacks never register or target the original desktop protocol', () => {
  assert.match(source('src/services/desktopBrowserLogin.ts'), /comic-box:\/\/auth\/callback/)
  assert.doesNotMatch(source('src/services/apiKeyCallback.ts'), /url\.protocol === 'jiucaihezi:'/)
  assert.doesNotMatch(source('src/services/mcpOAuth.ts'), /url\.protocol !== 'jiucaihezi:'/)
})


test('first login can create its new private session directory', () => {
  const session = source('src-tauri/src/commands/session.rs')
  assert.match(session, /std::fs::create_dir_all\(&directory\)/)
})


test('standalone comparison builds use embedded pages instead of requiring the Vite dev server', () => {
  const app = source('src-tauri/src/lib.rs')
  const config = app.slice(app.indexOf('fn workbench_window_config('), app.indexOf('fn build_workbench_window('))
  assert.match(config, /if tauri::is_dev\(\) \{/)
  assert.doesNotMatch(config, /cfg\(all\(debug_assertions/)
})


test('Harness workspace reads and writes inherit the application FS scope', () => {
  const capability = JSON.parse(source('src-tauri/capabilities/default.json'))
  assert.ok(capability.permissions.includes('fs:default'), 'retain the WebView protections')
  const scope = capability.permissions.find(permission => permission.identifier === 'fs:scope')
  assert.ok(scope, 'custom paths belong to the global FS scope, not the fs:default permission set')
  assert.ok(scope.allow.some(entry => entry.path === '$APPDATA/**'))
  // MSIX launchers can redirect this existing subtree independently of its AppData parent.
  assert.ok(scope.allow.some(entry => entry.path === '$APPDATA/deepseek-harness'))
  assert.ok(scope.allow.some(entry => entry.path === '$APPDATA/deepseek-harness/**'))
  assert.ok(scope.allow.every(entry => !entry.path.includes('OpenAI.Codex') && !entry.path.includes('LocalCache')))
  assert.ok(scope.deny.some(entry => entry.path === '$HOME/.comic-box/.session'))
  for (const command of ['mkdir', 'read-text-file', 'write-text-file', 'exists'])
    assert.ok(capability.permissions.includes(`fs:allow-${command}`))
})
