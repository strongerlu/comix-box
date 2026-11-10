import type { MediaTask } from '@/stores/mediaTaskStore'
import { isUncertainSubmission } from '@/runtime/creation/submissionSafety'

/** UI projection only; never used to route, bill or persist a task. */
export function creationTaskStage(task: Pick<MediaTask, 'status' | 'downloadState' | 'assetStatus' | 'assetUri' | 'projectPath' | 'canvasWriteStatus' | 'submissionUncertain' | 'upstreamTaskId' | 'errorMsg' | 'error'>): string {
  if (isUncertainSubmission(task)) return '提交结果待核实'
  if (task.status === 'pending') return '排队中'
  if (task.status === 'running') return '生成中'
  if (task.status === 'failed') return '生成失败'
  if (task.downloadState === 'paused') return '下载已暂停'
  if (task.status === 'cancelled') return '已取消'
  if (task.downloadState === 'failed') return '下载失败'
  if (task.assetStatus === 'failed') return '保存失败'
  if (task.downloadState === 'queued') return '等待下载'
  if (task.downloadState === 'downloading') return '下载中'
  if (task.assetStatus === 'pending') return '保存中'
  if (task.assetUri || task.projectPath) return task.canvasWriteStatus === 'unwritten' ? '已保存 · 未加入画布' : '已保存'
  return '已生成 · 待保存'
}

export type CreationTaskFilter = 'all' | 'active' | 'saved' | 'attention'
export function matchesCreationTaskFilter(task: MediaTask, filter: CreationTaskFilter): boolean {
  if (filter === 'all') return true
  const stage = creationTaskStage(task)
  if (filter === 'active') return ['排队中', '生成中', '等待下载', '下载中', '保存中'].includes(stage)
  if (filter === 'saved') return stage.startsWith('已保存')
  return !['排队中', '生成中', '等待下载', '下载中', '保存中', '已保存', '已取消'].includes(stage)
}

export function creationModelDisplayLabel(label: string): string {
  const grok = label.match(/^xy-grok-imagine-image-(\d[\d.]*)$/i)
  if (grok) return `Grok Image ${grok[1]} · 小易`
  const gpt = label.match(/^xy-gpt-image-(\d[\d.]*)(?:-(flare|sunburst))?-(\d+k)$/i)
  if (gpt) return `GPT Image ${gpt[1]}${gpt[2] ? ` ${gpt[2]}` : ''} · ${gpt[3].toUpperCase()} · 小易`
  return label
}

// 菠萝 = 图片两项排最前；FK 图片组排在灵动前面；jc 本机整组排最后（用户 2026-10-23 决定）。
const IMAGE_GROUP_ORDER = [
  'FK-Image', '灵动seedace2.5', '菠萝', '易红 API',
  'Grok Image', 'GPT Image', 'Banana', 'Z Image', 'FLUX Klein', 'Veo', 'Grok Video',
  'Seedance 2.0 Mini', 'Seedance 2.0 Fast', 'Seedance 2.5', 'Sora2', 'LTX 2.3', 'Suno', '3D', 'AI 应用', '其他模型',
  'jc 本机',
]
const VIDEO_GROUP_ORDER = [
  // FK Seedance 2.5 置顶；H3 保留独立分组。
  'FK · Seedance 2.5', '灵动seedace2.5', 'FK · H3', 'FK · Wan 3.0', 'ZX · Seedance', '菠萝',
  'Seedance 2.5', '易红 API', '源流 AI', 'Veo', 'Grok Video', 'Seedance 2.0 Mini', 'Seedance 2.0 Fast',
  'GPT Image', 'Banana', 'Z Image', 'FLUX Klein', 'Grok Image', 'Sora2', 'LTX 2.3', 'Suno', '3D', 'AI 应用', '其他模型',
  'jc 本机',
]
const OTHER_GROUP_ORDER = [
  '菠萝',
  'GPT Image', 'Banana', 'Z Image', 'FLUX Klein', 'Grok Image', 'Veo', 'Grok Video',
  'Seedance 2.0 Mini', 'Seedance 2.0 Fast', 'Seedance 2.5', 'Sora2', 'LTX 2.3', 'Suno', '3D', 'AI 应用', '其他模型',
  'jc 本机',
]

/** 创作模型按 family 分组；插件目录新增的分组不在表里，排到已知分组之后。 */
export function groupCreationModels<T extends { family: string }>(models: T[], task: string): [string, T[]][] {
  const groups = new Map<string, T[]>()
  for (const model of models) groups.set(model.family, [...(groups.get(model.family) || []), model])
  const order = task === 'image' ? IMAGE_GROUP_ORDER : task === 'video' ? VIDEO_GROUP_ORDER : OTHER_GROUP_ORDER
  const rank = (family: string) => order.includes(family) ? order.indexOf(family) : order.length
  return [...groups].sort(([left], [right]) => rank(left) - rank(right))
}
