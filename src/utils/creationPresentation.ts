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
