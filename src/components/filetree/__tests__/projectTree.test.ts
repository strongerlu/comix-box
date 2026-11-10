import assert from 'node:assert/strict'
import { test } from 'node:test'

import { buildSearchTree, buildTree, flattenVisible, sortedChildren, sortTreeChildren } from '../projectTree'

const paths = (nodes: { path: string }[]) => nodes.map(node => node.path)

test('buildTree nests entries under their parent and sorts each level by folder recency then path', () => {
  const root = buildTree([
    { path: 'old', isDir: true, size: null, updatedAt: 1 },
    { path: 'new', isDir: true, size: null, updatedAt: 9 },
    { path: 'b.md', isDir: false, size: 1 },
    { path: 'a.md', isDir: false, size: 1 },
    { path: 'new/02.png', isDir: false, size: 1 },
    { path: 'new/01.png', isDir: false, size: 1 },
  ], 'D:/books/demo')
  assert.equal(root.name, 'demo')
  assert.deepEqual(paths(root.children), ['new', 'old', 'a.md', 'b.md'])
  assert.deepEqual(paths(root.children[0].children), ['new/01.png', 'new/02.png'])
  assert.equal(root.children[0].depth, 1)
  assert.equal(root.children[0].children[0].depth, 2)
  assert.equal(root.children[0].loaded, false)
  assert.equal(root.children[2].loaded, true)
})

test('sortTreeChildren keeps folders ahead of files', () => {
  const sorted = sortTreeChildren([
    { path: 'z.md', isDir: false },
    { path: 'a', isDir: true },
  ])
  assert.deepEqual(paths(sorted), ['a', 'z.md'])
})

test('buildSearchTree adds the missing ancestor folders of each hit', () => {
  const root = buildSearchTree([
    { id: 'x', path: 'wiki/人物/主角.md', name: '主角.md', isDirectory: false } as never,
  ], 'demo')
  assert.deepEqual(paths(root.children), ['wiki'])
  assert.deepEqual(paths(root.children[0].children), ['wiki/人物'])
  assert.equal(root.children[0].children[0].children[0].id, 'x')
})

test('flattenVisible lists only expanded folders and keeps ancestors of filtered hits', () => {
  const root = buildTree([
    { path: '角色设计', isDir: true, size: null },
    { path: '场景', isDir: true, size: null },
    { path: '场景/角色设计稿.png', isDir: false, size: 1 },
    { path: 'notes.md', isDir: false, size: 1 },
  ], 'demo')
  assert.deepEqual(paths(flattenVisible(root, '', 'name-asc').map(entry => entry.node)), ['场景', '角色设计', 'notes.md'])

  root.children.find(node => node.path === '场景')!.expanded = true
  const filtered = flattenVisible(root, 'juese', 'name-asc')
  assert.deepEqual(paths(filtered.map(entry => entry.node)), ['场景', '场景/角色设计稿.png', '角色设计'])
  assert.deepEqual(filtered[0], { node: filtered[0].node, indent: 1, hasChildren: true, isExpanded: true })
  assert.deepEqual(flattenVisible(null, '', 'name-asc'), [])
})

test('sortedChildren applies the display mode without reordering the loaded tree', () => {
  const root = buildTree([
    { path: 'b.md', isDir: false, size: 1 },
    { path: 'a.md', isDir: false, size: 1 },
    { path: 'dir', isDir: true, size: null },
  ], 'demo')
  const loaded = paths(root.children)
  assert.deepEqual(paths(sortedChildren(root.children, 'name-desc')), ['dir', 'b.md', 'a.md'])
  assert.deepEqual(paths(root.children), loaded)
})
