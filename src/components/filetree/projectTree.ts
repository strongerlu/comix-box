import { searchItems } from '@/utils/generalSearch'
import { compareFileEntries, type FileSortMode } from '@/utils/fileSort'
import type { ProjectResource } from '@/utils/projectResource'

export interface FlatEntry {
  id?: string
  path: string
  isDir: boolean
  size: number | null
  updatedAt?: number
  mimeType?: string
  content?: string
}
export interface TreeNode {
  id?: string
  name: string
  path: string
  isDir: boolean
  size?: number
  updatedAt?: number
  mimeType?: string
  content?: string
  children: TreeNode[]
  expanded: boolean
  loaded: boolean
  depth: number
}
export interface VisibleNode {
  node: TreeNode
  indent: number
  hasChildren: boolean
  isExpanded: boolean
}

/**
 * 同级排序：目录优先；同级目录按最后修改时间倒序（刚建的、刚动过的在最上面），
 * 文件按名字——文件必须按名字才能对上编号顺序。
 *
 * 这是加载时的基础顺序；屏幕上的实际顺序由 `sortedChildren()` 按用户选的排序模式决定。
 */
export function sortTreeChildren<T extends { isDir: boolean; path: string; updatedAt?: number }>(children: T[]): T[] {
  return children.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
    if (a.isDir) {
      const timeDiff = (b.updatedAt ?? 0) - (a.updatedAt ?? 0)
      if (timeDiff !== 0) return timeDiff
    }
    return a.path.localeCompare(b.path)
  })
}

export function buildTree(entries: FlatEntry[], rootPath: string): TreeNode {
  const root: TreeNode = {
    name: rootPath.split('/').filter(Boolean).pop() || rootPath,
    path: '',
    isDir: true,
    children: [],
    expanded: true,
    loaded: true,
    depth: 0,
  }
  const nodeMap = new Map<string, TreeNode>()
  nodeMap.set('', root)
  for (const e of entries) {
    const parts = e.path.split('/')
    const n: TreeNode = {
      id: e.id,
      name: parts[parts.length - 1],
      path: e.path,
      isDir: e.isDir,
      size: e.size ?? undefined,
      updatedAt: e.updatedAt,
      mimeType: e.mimeType,
      content: e.content,
      children: [],
      expanded: false,
      loaded: !e.isDir,
      depth: parts.length,
    }
    const p = nodeMap.get(parts.slice(0, -1).join('/'))
    if (p) p.children.push(n)
    if (e.isDir) nodeMap.set(e.path, n)
  }
  // 按父逐个排序，而不是把扁平列表整体排——否则子目录可能排到父目录之前而丢掉。
  for (const node of nodeMap.values()) sortTreeChildren(node.children)
  return root
}

export function buildSearchTree(resources: ProjectResource[], rootPath: string): TreeNode {
  const entries = new Map<string, FlatEntry>()
  for (const resource of resources) {
    const parts = resource.path.split('/')
    for (let index = 1; index < parts.length; index++) {
      const path = parts.slice(0, index).join('/')
      entries.set(path, { path, isDir: true, size: null })
    }
    entries.set(resource.path, {
      id: resource.id,
      path: resource.path,
      isDir: resource.isDirectory,
      size: resource.size ?? null,
      updatedAt: resource.updatedAt,
      mimeType: resource.mimeType,
    })
  }
  return buildTree([...entries.values()], rootPath)
}

/* ─── 模糊筛选（fuzzysort + 拼音） ─── */
function fuzzyMatch(name: string, query: string): boolean {
  const q = query.trim()
  if (!q) return true
  // ponytail: searchItems 带拼音增强，打 "juese" 匹配「角色设计」
  return searchItems(q, [{ name }]).length > 0
}
function nodeMatchesFilter(node: TreeNode, q: string): boolean {
  return (
    fuzzyMatch(node.name, q) || (node.isDir && node.children.some(c => nodeMatchesFilter(c, q)))
  )
}
export function flattenVisible(root: TreeNode | null, filter: string, mode: FileSortMode): VisibleNode[] {
  if (!root) return []
  const result: VisibleNode[] = []
  const q = filter.trim()
  function walk(node: TreeNode) {
    if (!q || fuzzyMatch(node.name, q) || node.children.some(c => nodeMatchesFilter(c, q))) {
      result.push({ node, indent: node.depth, hasChildren: node.isDir, isExpanded: node.expanded })
      if (node.expanded && node.isDir) for (const child of sortedChildren(node.children, mode)) walk(child)
    }
  }
  for (const child of sortedChildren(root.children, mode)) walk(child)
  return result
}

/**
 * 屏幕顺序的唯一真源：目录永远优先（混排会把目录冲散，nodeMap 找不到父节点会静默丢节点），
 * 同级再按当前模式。排序放在展开视图这一步而不是加载时：换排序不用重读目录，
 * 也不会漏掉 buildTree / ensureDirectoryLoaded / refreshDirectory 里某一条加载路径。
 */
export function sortedChildren(children: TreeNode[], mode: FileSortMode): TreeNode[] {
  return children.slice().sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
    return compareFileEntries(a, b, mode)
  })
}
