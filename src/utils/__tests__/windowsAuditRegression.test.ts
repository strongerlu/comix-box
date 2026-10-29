import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

test('Windows keyring uses native credential storage and API key file failures propagate', () => {
  const manifest = source('src-tauri/Cargo.toml')
  const secureStore = source('src-tauri/src/secure_store.rs')
  const apiClient = source('src/services/newApiClient.ts')
  const setApiKey = apiClient.match(/export async function setApiKey\(token: string\): Promise<void> \{([\s\S]*?)\n\}/)?.[1] || ''

  assert.match(manifest, /target_os = "windows"[\s\S]*?keyring = \{ version = "3", features = \["windows-native"\] \}/)
  assert.match(secureStore, /fn sync_key_to_cli_file\(key: &str\) -> Result<\(\), String>/)
  assert.match(secureStore, /std::fs::rename\(&temporary, &path\)/)
  assert.match(secureStore, /sync_key_to_cli_file\(&api_key\)\n\}/)
  assert.ok(apiClient.indexOf("await invoke('set_api_key'") < apiClient.indexOf('apiKeyMemoryCache = clean'))
  assert.doesNotMatch(setApiKey, /catch/)
})

test('FFmpeg readiness is based on a successful native executable probe', () => {
  const capabilities = source('src/utils/localCapabilities.ts')
  const devCommands = source('src-tauri/src/commands/dev.rs')
  const setupPanel = source('src/components/settings/LocalCapabilitySetup.vue')

  assert.match(capabilities, /await invoke\('dev_check_ffmpeg'\)/)
  assert.doesNotMatch(capabilities, /jc_ffmpeg_checked/)
  assert.match(devCommands, /dev_check_ffmpeg\(app: AppHandle\)[\s\S]*?resolve_app_media_binary\(&app, "ffmpeg"\)[\s\S]*?output\.status\.success\(\)/)
  assert.match(setupPanel, /catch \(error\) \{\s*cap\.status = isTauri \? 'pending' : 'unavailable'/)
})

test('background media subprocesses share the Windows no-console configuration', () => {
  const commands = [
    source('src-tauri/src/commands/dev.rs'),
    source('src-tauri/src/commands/http.rs'),
    source('src-tauri/src/commands/media.rs'),
    source('src-tauri/src/commands/tools.rs'),
    source('src-tauri/src/commands/mcp.rs'),
  ]
  for (const command of commands) assert.match(command, /configure_background_command/)
  assert.match(commands[3], /CREATE_NO_WINDOW: u32 = 0x08000000/)
})
