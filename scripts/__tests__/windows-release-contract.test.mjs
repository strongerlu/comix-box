import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const tauriConfig = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'))
// 统一行尾：仓库在 Windows 上 checkout 出来是 CRLF，而下面的断言用 \n 匹配
const workflow = readFileSync('.github/workflows/build.yml', 'utf8').replace(/\r\n/g, '\n')
const rustApp = readFileSync('src-tauri/src/lib.rs', 'utf8')
const rustManifest = readFileSync('src-tauri/Cargo.toml', 'utf8')
const packageManifest = JSON.parse(readFileSync('package.json', 'utf8'))

test('Windows release config installs WebView2 through the NSIS installer', () => {
  assert.deepEqual(tauriConfig.bundle.windows.webviewInstallMode, {
    type: 'downloadBootstrapper',
    silent: false,
  })
  assert.match(workflow, /--bundles nsis/)
  assert.match(workflow, /windows_setup\.exe/)
  assert.match(workflow, /\$setupPath = "src-tauri\\target\\COMIC-BOX_\$\{tag\}_x64_windows_setup\.exe"/)
  assert.match(workflow, /gh release upload \$tag \$zipPath \$setupPath --clobber/)
})

test('Windows retains native startup checks with application updating removed', () => {
  assert.equal(tauriConfig.plugins.updater, undefined)
  assert.doesNotMatch(rustApp, /commands::desktop_update/)
  assert.doesNotMatch(rustManifest, /tauri-plugin-updater/)
  assert.match(workflow, /Smoke test — Windows app startup/)
  assert.match(workflow, /Start-Process[\s\S]*comic-box\.exe/)
  assert.match(workflow, /HasExited/)
})

test('Windows release uses the audited frontend and keeps upstream production publication detached', () => {
  assert.match(workflow, /prepare-release:[\s\S]*gh release create/)
  assert.match(workflow, /windows:\n\s+needs: prepare-release/)
  assert.doesNotMatch(workflow, /macos-arm:|macos-intel:|ubuntu-latest|publish-download-manifest:|promote-updater:/)
  const body = workflow.slice(workflow.indexOf('  windows:'))
  assert.ok(body.indexOf('pnpm run build:desktop:quick') < body.indexOf('pnpm tauri'))
})

test('Storyboarder assets are fetchable and included in the Windows portable zip', () => {
  const csp = tauriConfig.app.security.csp
  const connectSrc = csp.match(/connect-src ([^;]+)/)?.[1] || ''
  assert.match(connectSrc, /(?:^|\s)asset:(?:\s|$)/)
  assert.match(connectSrc, /(?:^|\s)http:\/\/asset\.localhost(?:\s|$)/)

  assert.match(workflow, /Copy-Item "\$releaseDir\\storyboarder" \(Join-Path \$portableDir "storyboarder"\) -Recurse/)
  for (const path of [
    'storyboarder/manifest.json',
    'storyboarder/models/adult-male.glb',
    'storyboarder/models/adult-female.glb',
    'storyboarder/models/teen-male.glb',
    'storyboarder/models/teen-female.glb',
    'storyboarder/models/child.glb',
  ]) assert.ok(workflow.includes(`"${path}"`), path)
})

test('new workbench windows retain construction and state attachment without updater gates', () => {
  const body = rustApp.match(/pub\(crate\) fn spawn_workbench_window\([\s\S]*?\n\}/)?.[0]
  assert.ok(body)
  assert.match(body, /workbench_window_config/)
  assert.match(body, /build_workbench_window/)
  assert.match(body, /attach_window_state/)
  assert.doesNotMatch(body, /desktop_update|native_task/)
})

test('screenshot retains its own editing and save state without an update-install lease', () => {
  const screenshot = readFileSync('src-tauri/src/commands/screenshot.rs', 'utf8')
  assert.match(screenshot, /struct Active \{[\s\S]*?saving: bool/)
  assert.match(screenshot, /state\.active = Some\(Active \{/)
  assert.match(screenshot, /screenshot_geometry::\{check_task, crop_bounds\}/)
  assert.doesNotMatch(screenshot, /update_task|desktop_update/)
})
