import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { ProjectResource } from '@/utils/projectResource'
import { useMediaReorder } from '../useMediaReorder'

const file = (path: string, updatedAt = 0) =>
  ({ runtime: 'desktop', owner: '/p', path, name: path.split('/').pop()!, isDirectory: false, kind: 'media', updatedAt }) as ProjectResource

function fixture(children: ProjectResource[], options: { failOn?: string } = {}) {
  const log = { renames: [] as Array<[string, string]>, error: '', status: '', listed: 0 }
  let owner = '/p'
  let menuTarget = '分镜'
  const reorder = useMediaReorder({
    owner: () => owner,
    listDirectory: async () => { log.listed++; return children },
    rename: async (resource, name) => {
      if (resource.name === options.failOn) throw new Error('boom')
      log.renames.push([resource.path, name])
      return { ...resource, name, path: resource.path.replace(/[^/]+$/, name) }
    },
    isVisible: () => true,
    isProtected: () => false,
    createdAtOf: () => undefined,
    isMenuTarget: path => path === menuTarget,
    setError: message => { log.error = message },
    setStatus: message => { log.status = message },
  })
  return { reorder, log, switchOwner: (next: string) => { owner = next }, moveMenu: (next: string) => { menuTarget = next } }
}

const folder = { path: '分镜', name: '分镜', isDir: true }

test('opening the preview plans names from the folder name without renaming anything', async () => {
  const { reorder, log } = fixture([file('分镜/b.png', 2), file('分镜/a.png', 1)])
  await reorder.open(folder)
  assert.deepEqual(log.renames, [])
  assert.equal(reorder.mediaReorderFolder.value?.name, '分镜')
  assert.ok(reorder.mediaReorderPlan.value?.renames.length)
  assert.ok(reorder.mediaReorderPlan.value!.renames.every(rename => /^\d{3}_分镜\.png$/.test(rename.nextName)))
})

test('a folder without anything to renumber explains why and opens no dialog', async () => {
  const empty = fixture([])
  await empty.reorder.open(folder)
  assert.equal(empty.log.error, '该文件夹没有可编号的媒体文件。')
  assert.equal(empty.reorder.mediaReorderPlan.value, null)

  const done = fixture([file('分镜/001_分镜.png')])
  await done.reorder.open(folder)
  assert.equal(done.log.error, '该文件夹的媒体文件已经是「编号_分镜」格式。')
  assert.equal(done.reorder.mediaReorderFolder.value, null)
})

test('a project switch during listing discards the preview', async () => {
  const { reorder, switchOwner } = fixture([file('分镜/a.png')])
  const opening = reorder.open(folder)
  switchOwner('/other')
  await opening
  assert.equal(reorder.mediaReorderPlan.value, null)
})

test('confirming renames every planned file, reports success through the status channel and closes', async () => {
  const { reorder, log } = fixture([file('分镜/b.png', 2), file('分镜/a.png', 1)])
  await reorder.open(folder)
  const planned = reorder.mediaReorderPlan.value!.renames.map(rename => [rename.path, rename.nextName])
  await reorder.confirm()
  assert.deepEqual(log.renames, planned)
  assert.equal(log.status, `分镜：已为 ${planned.length} 个媒体文件编号`)
  assert.equal(log.error, '')
  assert.equal(reorder.mediaReorderPlan.value, null)
  assert.equal(reorder.mediaReorderBusy.value, false)
})

test('a failure part way reports how many were renamed through the error channel', async () => {
  const { reorder, log } = fixture([file('分镜/a.png', 1), file('分镜/b.png', 2)], { failOn: 'b.png' })
  await reorder.open(folder)
  const total = reorder.mediaReorderPlan.value!.renames.length
  await reorder.confirm()
  assert.match(log.error, new RegExp(`^已编号 \\d/${total} 个，随后失败：boom`))
  assert.equal(log.status, '')
  assert.equal(reorder.mediaReorderFolder.value, null)
})

test('the menu entry counts media files only while the menu still targets that folder', async () => {
  const counted = fixture([file('分镜/a.png'), file('分镜/b.mp4'), file('分镜/notes.md')])
  await counted.reorder.refreshAvailability(folder)
  assert.equal(counted.reorder.mediaReorderAvailable.value, 2)

  const moved = fixture([file('分镜/a.png')])
  const counting = moved.reorder.refreshAvailability(folder)
  moved.moveMenu('其他')
  await counting
  assert.equal(moved.reorder.mediaReorderAvailable.value, null)
})
