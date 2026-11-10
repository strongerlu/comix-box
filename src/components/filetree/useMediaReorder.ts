import { ref } from 'vue'
import type { ProjectResource } from '@/utils/projectResource'
import {
  mediaKindOf,
  planMediaReorder,
  temporaryReorderName,
  type MediaReorderMode,
  type MediaReorderPlan,
} from '@/utils/mediaReorder'

interface ReorderFolder { path: string; name: string; isDir: boolean }

export interface MediaReorderHost {
  owner: () => string
  listDirectory: (owner: string, path: string) => Promise<ProjectResource[]>
  rename: (resource: ProjectResource, name: string) => Promise<ProjectResource>
  isVisible: (path: string) => boolean
  isProtected: (path: string) => boolean
  /** 生成时间：交给文件时间兜底时返回 undefined。 */
  createdAtOf: (name: string) => number | undefined
  /** 右键菜单是否仍指向这个文件夹；菜单换了目标就丢弃计数。 */
  isMenuTarget: (path: string) => boolean
  setError: (message: string) => void
  setStatus: (message: string) => void
}

const isMedia = (resource: ProjectResource) =>
  !resource.isDirectory && mediaKindOf(resource.path, resource.mimeType) !== null

/** 媒体排序编号：先预演计划，确认后才改名；成功走状态提示，失败走错误提示。 */
export function useMediaReorder(host: MediaReorderHost) {
  const mediaReorderFolder = ref<{ path: string; name: string } | null>(null)
  const mediaReorderItems = ref<ProjectResource[]>([])
  const mediaReorderPlan = ref<MediaReorderPlan | null>(null)
  const mediaReorderMode = ref<MediaReorderMode>('respect')
  const mediaReorderBusy = ref(false)
  /** null = 还没数出来（此时先允许入口），否则为目录内媒体文件数。 */
  const mediaReorderAvailable = ref<number | null>(null)

  const listVisible = async (owner: string, path: string) =>
    (await host.listDirectory(owner, path)).filter(resource => host.isVisible(resource.path))

  function buildPlan(): MediaReorderPlan {
    return planMediaReorder({
      resources: mediaReorderItems.value,
      baseName: mediaReorderFolder.value?.name || '',
      createdAtOf: (_path, name) => host.createdAtOf(name),
      mode: mediaReorderMode.value,
      isProtected: host.isProtected,
    })
  }

  function reset() {
    mediaReorderFolder.value = null
    mediaReorderPlan.value = null
    mediaReorderItems.value = []
  }

  async function refreshAvailability(node: ReorderFolder | null) {
    mediaReorderAvailable.value = null
    const owner = host.owner()
    if (!owner || !node?.isDir) return
    try {
      const children = await listVisible(owner, node.path)
      if (host.owner() !== owner || !host.isMenuTarget(node.path)) return
      mediaReorderAvailable.value = children.filter(isMedia).length
    } catch {
      mediaReorderAvailable.value = null
    }
  }

  async function open(node: ReorderFolder | null | undefined) {
    const owner = host.owner()
    if (!node?.isDir || !owner) return
    host.setError('')
    host.setStatus('')
    try {
      const children = await listVisible(owner, node.path)
      if (host.owner() !== owner) return
      mediaReorderItems.value = children
      // 编号基础名取当前文件夹名，必须在算计划之前就位。
      mediaReorderFolder.value = { path: node.path, name: node.name }
      const plan = buildPlan()
      if (!plan.renames.length) {
        host.setError(children.some(isMedia)
          ? `该文件夹的媒体文件已经是「编号_${node.name}」格式。`
          : '该文件夹没有可编号的媒体文件。')
        reset()
        return
      }
      mediaReorderPlan.value = plan
    } catch (error) {
      host.setError(`读取文件夹失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  function setMode(mode: MediaReorderMode) {
    mediaReorderMode.value = mode
    mediaReorderPlan.value = buildPlan()
  }

  function cancel() {
    if (!mediaReorderBusy.value) reset()
  }

  async function confirm() {
    const plan = mediaReorderPlan.value
    const folder = mediaReorderFolder.value
    if (!plan || !folder || !host.owner() || mediaReorderBusy.value) return
    const byPath = new Map(mediaReorderItems.value.map(resource => [resource.path, resource]))
    const requested = plan.renames
    if (!requested.length) return
    mediaReorderBusy.value = true
    let done = 0
    let failure = ''
    try {
      // 交换型重名：先只把涉事的文件改成临时名，再统一落到最终名。
      const staged = new Map<string, ProjectResource>()
      if (plan.needsTempPass) {
        for (const [index, rename] of requested.entries()) {
          const involved = plan.conflicts.some(
            conflict => conflict.path === rename.path || conflict.holderPath === rename.path,
          )
          const source = byPath.get(rename.path)
          if (!involved || !source) continue
          staged.set(rename.path, await host.rename(source, temporaryReorderName(index + 1, source.name)))
        }
      }
      for (const rename of requested) {
        const source = staged.get(rename.path) || byPath.get(rename.path)
        if (!source) continue
        await host.rename(source, rename.nextName)
        done += 1
      }
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error)
    } finally {
      mediaReorderBusy.value = false
      reset()
    }
    if (failure) {
      const stagedHint = plan.needsTempPass ? '；若有文件停留在 __pft_reorder_tmp_ 临时名，请手动改回或重新编号' : ''
      host.setError(`已编号 ${done}/${requested.length} 个，随后失败：${failure}${stagedHint}`)
      return
    }
    host.setStatus(`${folder.name}：已为 ${done} 个媒体文件编号`)
  }

  return {
    mediaReorderFolder, mediaReorderPlan, mediaReorderMode, mediaReorderBusy, mediaReorderAvailable,
    refreshAvailability, open, setMode, cancel, confirm,
  }
}
