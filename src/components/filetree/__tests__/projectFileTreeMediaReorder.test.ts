import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

const source = readFileSync(
  join(process.cwd(), 'src/components/filetree/ProjectFileTree.vue'),
  'utf8',
)

function sliceFunction(marker: string): string {
  const start = source.indexOf(marker)
  assert.notEqual(start, -1, `missing ${marker}`)
  const end = source.indexOf('\n}', start)
  assert.notEqual(end, -1, `unterminated ${marker}`)
  return source.slice(start, end)
}

test('媒体排序编号只出现在目录右键菜单里', () => {
  const directoryMenuStart = source.indexOf('v-else-if="ctxMenu.node?.isDir"')
  const fileMenuStart = source.indexOf('── 文件右键菜单 ──')
  assert.notEqual(directoryMenuStart, -1)
  assert.notEqual(fileMenuStart, -1)
  const directoryMenu = source.slice(directoryMenuStart, fileMenuStart)

  assert.match(directoryMenu, /媒体排序编号/)
  assert.match(directoryMenu, /ctxReorderMedia/)
  assert.match(directoryMenu, /mediaReorderAvailable === null \|\| mediaReorderAvailable > 1/)

  const fileMenu = source.slice(fileMenuStart)
  assert.doesNotMatch(fileMenu, /ctxReorderMedia/)
})

test('右键入口先关菜单再打开预演，预演与改名逻辑在 useMediaReorder 中', () => {
  const open = sliceFunction('async function ctxReorderMedia()')
  assert.match(open, /closeCtxMenu\(\)[\s\S]*await openMediaReorder\(node\)/)
  assert.doesNotMatch(open, /projectFiles\.rename\(/)
  assert.match(source, /import \{ useMediaReorder \} from '\.\/useMediaReorder'/)
})

test('编号复用现有重命名合同、保护规则与生成记录时间', () => {
  assert.match(source, /rename: \(resource, name\) => projectFiles\.rename\(resource, name\)/)
  assert.match(source, /isProtected: isProtectedMemoryPath/)
  assert.match(source, /createdAtOf: mediaCreatedAtOf/)
  assert.match(sliceFunction('function mediaCreatedAtOf('), /mediaTaskStore\.tasks/)
})

test('预演弹窗沿用现有弹窗的可访问性范式', () => {
  assert.match(source, /class="pft-reorder-overlay"/)
  assert.match(source, /role="dialog" aria-modal="true" aria-label="媒体排序编号"/)
  assert.match(source, /@click="confirmMediaReorder"/)
  assert.match(source, /@click="cancelMediaReorder"/)
})
