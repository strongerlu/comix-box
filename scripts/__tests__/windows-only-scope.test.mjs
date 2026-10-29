import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

const source = path => readFileSync(path, 'utf8')

test('Windows builds enter the workbench directly and retain the screenshot entry', () => {
  assert.match(source('index.html'), /src="\/src\/main\.ts"/)
  const vite = source('vite.config.ts')
  assert.doesNotMatch(vite, /JC_BUILD_TARGET|mobile\/index|try\/index|safari15|@tiptap/)
  assert.match(vite, /screenshot\/index\.html/)
  assert.match(vite, /target: 'chrome105'/)
  const config = JSON.parse(source('src-tauri/tauri.conf.json'))
  assert.equal(config.build.devUrl, 'http://localhost:1420/')
  assert.deepEqual(config.bundle.targets, ['nsis'])
  assert.equal(config.bundle.macOS, undefined)
  assert.ok(!config.bundle.icon.some(path => path.endsWith('.icns')))
})

test('mobile client and platform packaging no longer enter the Windows source tree', () => {
  for (const path of ['mobile', 'src/mobile', 'src/services/mobileRemoteClient.ts',
    'src/services/mobileRemoteTransport.ts', 'src-tauri/src/commands/remote_client.rs',
    'src-tauri/tauri.ios.conf.json', 'src-tauri/capabilities/mobile.json',
    'src-tauri/icons/android', 'src-tauri/icons/ios', 'scripts/fix-macos-app.mjs',
    'scripts/create-official-dmg.mjs']) assert.equal(existsSync(path), false, path)
  const pkg = JSON.parse(source('package.json'))
  assert.equal(pkg.dependencies['@tauri-apps/plugin-barcode-scanner'], undefined)
  assert.doesNotMatch(JSON.stringify(pkg.scripts), /ios|macos|dmg|monterey|web-dist/)
  assert.doesNotMatch(source('src-tauri/src/lib.rs'), /remote_client::|tauri_plugin_barcode_scanner/)
})

test('Windows desktop capabilities and standalone identity remain available', () => {
  for (const path of ['default', 'screenshot']) {
    assert.deepEqual(JSON.parse(source(`src-tauri/capabilities/${path}.json`)).platforms, ['windows'])
  }
  const rust = source('src-tauri/src/lib.rs')
  for (const name of ['remote_bridge::remote_bridge_start', 'creation_mcp::resolve_creation_mcp',
    'screenshot::']) assert.ok(rust.includes(name), name)
  assert.equal(JSON.parse(source('src-tauri/tauri.conf.json')).identifier, 'com.comicbox.desktop')
})
