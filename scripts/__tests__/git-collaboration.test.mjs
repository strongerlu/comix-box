import assert from 'node:assert/strict'
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

test('shared ignore rules exclude local outputs without hiding source, examples or bundled assets', t => {
  const root = mkdtempSync(join(tmpdir(), 'comic-box-git-ignore-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  copyFileSync('.gitignore', join(root, '.gitignore'))
  const git = args => spawnSync('git', ['-c', 'core.excludesFile=NUL', ...args], { cwd: root, encoding: 'utf8' })
  assert.equal(git(['init', '--quiet']).status, 0)
  const ignored = [
    'tmp/comic-box-sample/wiki/成片/第1集成片.mp4', 'tmp/sample/.raw/media/image.png',
    'tmp/planning-focused.log', 'build-local.log', '.cache/tool/state.json',
    '.comic-box/.jc_api_key', '.env', '.env.development', 'rh-adapter/.env.production',
    'node_modules/pkg/index.js', 'src-tauri/resources/deepseek-harness/node_modules/pkg/index.js',
    'src-tauri/target/debug/comic-box.exe', 'dist/index.html', '.venv/pyvenv.cfg',
    'attachment-processor/.venv/pyvenv.cfg', 'tsconfig.app.tsbuildinfo',
  ]
  const shared = [
    'src/runtime/manjuAuto/checkpointPreflight.ts', 'public/skills/jc-manju-pipeline/SKILL.md',
    'src/runtime/creation/workflows/z-image-turbo.json', 'src-tauri/icons/icon.ico',
    'src-tauri/resources/storyboarder/models/adult-male.glb', 'logo.png',
    'scripts/__tests__/fixtures/sample.mp4', 'scripts/__tests__/fixtures/example.log',
    'rh-adapter/.env.example', 'scripts/newapi-media/r2.env.example', '.env.production.example',
    'package.json', 'pnpm-lock.yaml', 'src-tauri/Cargo.lock',
    'src-tauri/resources/deepseek-harness/package.json', 'src-tauri/resources/deepseek-harness/package-lock.json',
    'AGENTS.md', 'docs/wiki/log.md', 'docs/wiki/归档/handover/example.md',
    'gateway/site/index.html', 'docs/design/logo.png',
  ]
  const result = spawnSync('git', ['-c', 'core.excludesFile=NUL', 'check-ignore', '--no-index', '--stdin', '-z'], {
    cwd: root, encoding: 'utf8', input: [...ignored, ...shared].join('\0') + '\0',
  })
  assert.ok(result.status === 0 || result.status === 1, result.stderr)
  const matches = new Set(result.stdout.split('\0').filter(Boolean))
  for (const path of ignored) assert.ok(matches.has(path), `local file must be ignored: ${path}`)
  for (const path of shared) assert.ok(!matches.has(path), `shared file must remain visible: ${path}`)
})
