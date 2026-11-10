import type { ProjectResource } from '@/utils/projectResource'

/** 文件树内部的复制/剪切板；只在同一项目、同一运行时内粘贴。 */
export interface ProjectResourceClipboard {
  owner: string
  runtime: ProjectResource['runtime']
  mode: 'copy' | 'cut'
  roots: ProjectResource[]
}

type ResourceChange =
  | { type: 'renamed'; oldResource: ProjectResource; resource: ProjectResource }
  | { type: 'deleted' | 'changed' | 'created'; resource: ProjectResource }

const within = (path: string, root: string) => path === root || path.startsWith(`${root}/`)

export function clipboardFor(roots: ProjectResource[], mode: ProjectResourceClipboard['mode']): ProjectResourceClipboard | null {
  return roots.length ? { owner: roots[0].owner, runtime: roots[0].runtime, mode, roots } : null
}

export function isCutPath(clipboard: ProjectResourceClipboard | null, path: string): boolean {
  return Boolean(
    clipboard?.mode === 'cut' &&
    clipboard.roots.some(root => path === root.path || (root.isDirectory && path.startsWith(`${root.path}/`))),
  )
}

/** 剪切板跟随项目变化：根被删则清空，根或其上级改名则改写路径。 */
export function followResourceChange(
  clipboard: ProjectResourceClipboard | null,
  change: ResourceChange,
): ProjectResourceClipboard | null {
  if (!clipboard || clipboard.owner !== change.resource.owner) return clipboard
  if (change.type === 'deleted')
    return clipboard.roots.some(root => within(root.path, change.resource.path)) ? null : clipboard
  if (change.type !== 'renamed') return clipboard
  const { oldResource, resource } = change
  return {
    ...clipboard,
    roots: clipboard.roots.map(root => {
      if (!within(root.path, oldResource.path)) return root
      const path = `${resource.path}${root.path.slice(oldResource.path.length)}`
      return { ...root, path, name: path.split('/').pop()! }
    }),
  }
}
