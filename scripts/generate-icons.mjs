import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const icons = join(root, 'src-tauri', 'icons')
const source = join(icons, 'app-icon.png')
const cli = join(root, 'node_modules', '@tauri-apps', 'cli', 'tauri.js')
const output = mkdtempSync(join(tmpdir(), 'comic-box-icons-'))

function generate(args) {
  const result = spawnSync(process.execPath, [cli, 'icon', source, ...args], {
    cwd: root,
    encoding: 'utf8',
    stdio: 'inherit',
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`Icon generation failed (${result.status})`)
}

try {
  // Tauri generates all platforms; copy only Windows assets into this repository.
  generate(['--output', output])
  for (const name of [
    'icon.ico', 'icon.png', '32x32.png', '64x64.png', '128x128.png', '128x128@2x.png',
    'StoreLogo.png', 'Square30x30Logo.png', 'Square44x44Logo.png', 'Square71x71Logo.png',
    'Square89x89Logo.png', 'Square107x107Logo.png', 'Square142x142Logo.png',
    'Square150x150Logo.png', 'Square284x284Logo.png', 'Square310x310Logo.png',
  ]) copyFileSync(join(output, name), join(icons, name))

  // Preserve existing SVG URLs and the exact approved artwork, without tracing it.
  const png = readFileSync(join(output, 'icon.png'))
  const size = png.readUInt32BE(16)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 ${size} ${size}">\n  <title>COMIC-BOX</title>\n  <image width="${size}" height="${size}" href="data:image/png;base64,${png.toString('base64')}"/>\n</svg>\n`
  for (const name of [
    'logo.svg', 'jiucaihua-crown.svg', 'public/logo.svg', 'public/logo-solid.svg',
    'public/favicon.svg', 'src/assets/logo-filled.svg', 'src/assets/logo-outline.svg',
    'src-tauri/icons/app-icon.svg',
  ]) writeFileSync(join(root, name), svg)
  copyFileSync(source, join(root, 'logo.png'))

  generate(['--output', join(output, 'touch'), '--png', '180'])
  copyFileSync(join(output, 'touch', '180x180.png'), join(root, 'public', 'apple-touch-icon.png'))
  console.log('Updated COMIC-BOX brand assets and Windows icons from app-icon.png')
} finally {
  if (dirname(resolve(output)) !== resolve(tmpdir())) throw new Error('Unexpected temporary icon directory')
  rmSync(output, { recursive: true, force: true })
}
