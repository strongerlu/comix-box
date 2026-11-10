import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { ProjectResource } from '@/utils/projectResource'
import { clipboardFor, followResourceChange, isCutPath } from '../resourceClipboard'

const resource = (path: string, isDirectory = false) =>
  ({ runtime: 'desktop', owner: '/p', path, name: path.split('/').pop()!, isDirectory, kind: 'text' }) as ProjectResource

test('clipboardFor keeps the owner and runtime of the selection and ignores an empty selection', () => {
  assert.equal(clipboardFor([], 'copy'), null)
  assert.deepEqual(clipboardFor([resource('a.md')], 'cut'), { owner: '/p', runtime: 'desktop', mode: 'cut', roots: [resource('a.md')] })
})

test('isCutPath marks cut roots and everything inside a cut folder, never copies', () => {
  const cut = clipboardFor([resource('dir', true), resource('a.md')], 'cut')
  assert.equal(isCutPath(cut, 'dir'), true)
  assert.equal(isCutPath(cut, 'dir/x.png'), true)
  assert.equal(isCutPath(cut, 'directory.md'), false)
  assert.equal(isCutPath(cut, 'a.md'), true)
  assert.equal(isCutPath(clipboardFor([resource('a.md')], 'copy'), 'a.md'), false)
  assert.equal(isCutPath(null, 'a.md'), false)
})

test('deleting a clipboard root or its parent empties the clipboard', () => {
  const clipboard = clipboardFor([resource('dir/a.md')], 'copy')
  assert.equal(followResourceChange(clipboard, { type: 'deleted', resource: resource('dir', true) }), null)
  assert.equal(followResourceChange(clipboard, { type: 'deleted', resource: resource('other.md') }), clipboard)
})

test('renaming a root or its parent folder rewrites the clipboard paths and names', () => {
  const clipboard = clipboardFor([resource('dir/a.md'), resource('b.md')], 'cut')
  const next = followResourceChange(clipboard, { type: 'renamed', oldResource: resource('dir', true), resource: resource('新目录', true) })
  assert.deepEqual(next?.roots.map(root => [root.path, root.name]), [['新目录/a.md', 'a.md'], ['b.md', 'b.md']])
  assert.equal(next?.mode, 'cut')
})

test('changes in another project leave the clipboard untouched', () => {
  const clipboard = clipboardFor([resource('a.md')], 'copy')
  const elsewhere = { ...resource('a.md'), owner: '/other' }
  assert.equal(followResourceChange(clipboard, { type: 'deleted', resource: elsewhere }), clipboard)
})
