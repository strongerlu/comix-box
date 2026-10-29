import type { EpisodeCheckpoint, WikiTaskDeps } from './assetScheduler'

export interface CheckpointFiles {
  episode_number: number
  video_model: string
  source_path?: string
  source_hash?: string
  duration_seconds?: number
  files?: Record<string, Record<string, string>>
  assets?: EpisodeCheckpoint['assets']
}

export async function textHash(text: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

/** 付费前核对当前进度记录的真实文件；读取和比较不产生生成请求。 */
export async function verifyCheckpointFiles(checkpoint: CheckpointFiles, deps: Pick<WikiTaskDeps, 'readText'>) {
  const files = new Map(Object.values(checkpoint.files || {}).flatMap(entries => Object.entries(entries)))
  if (checkpoint.source_path && checkpoint.source_hash) files.set(checkpoint.source_path, checkpoint.source_hash)
  for (const [path, hash] of files) {
    if (!/^[a-f0-9]{64}$/.test(hash) || await textHash(await deps.readText(path)) !== hash)
      throw new Error(`原作或前置产物已修改：${path}；请先重新校验文字进度`)
  }
}

export interface SegmentTransition { type: 'continue' | 'cut' | 'scene_change'; reason: string }

export function usesContinuation(segment: { transition?: SegmentTransition }, index: number, enabled: boolean) {
  return enabled && index > 0 && (!segment.transition || segment.transition.type === 'continue')
}

export interface SegmentPlan {
  duration_seconds?: number
  segments: Array<{ path: string; start_seconds: number; end_seconds: number; refs?: string[]; transition?: SegmentTransition }>
}

/** 只校验结构事实，不用关键词猜测剧情、动作因果或画面质量。 */
export function validateSegmentPlan(checkpoint: SegmentPlan) {
  if (!Array.isArray(checkpoint.segments) || !checkpoint.segments.length) throw new Error('没有可生成的视频片段')
  const paths = new Set<string>()
  let end = 0
  for (const [index, segment] of checkpoint.segments.entries()) {
    const label = `第${index + 1}段`
    const transition = segment.transition
    if (transition !== undefined && (!transition || !['continue', 'cut', 'scene_change'].includes(transition.type)
      || typeof transition.reason !== 'string' || !transition.reason.trim() || index === 0 && transition.type === 'continue'))
      throw new Error(`${label}镜头关系无效：填写 continue/cut/scene_change 及依据；首段不能接续上一段`)
    if (typeof segment.path !== 'string' || !segment.path.trim()) throw new Error(`${label}未指定提示词路径`)
    const path = segment.path.replace(/\\/g, '/')
    if (paths.has(path)) throw new Error(`${label}提示词路径重复：${segment.path}`)
    paths.add(path)
    if (!Number.isFinite(segment.start_seconds) || !Number.isFinite(segment.end_seconds) || segment.end_seconds <= segment.start_seconds || Math.abs(segment.start_seconds - end) > 0.01)
      throw new Error(`${label}视频片段必须从 0 开始连续覆盖，不能重叠或留空`)
    end = segment.end_seconds
    const refs = segment.refs ?? []
    if (!Array.isArray(refs) || refs.some(id => typeof id !== 'string' || !id.trim())) throw new Error(`${label}参考图登记无效`)
    if (new Set(refs).size !== refs.length) throw new Error(`${label}参考图资产重复登记`)
  }
  if (checkpoint.duration_seconds !== undefined && (!Number.isFinite(checkpoint.duration_seconds) || Math.abs(end - checkpoint.duration_seconds) > 0.01))
    throw new Error('视频片段必须完整覆盖本集登记时长')
}

export function validatePromptReferences(prompt: string, refs: string[], model: string) {
  if (!prompt.trim()) throw new Error('视频提示词正文为空，请先补齐正文')
  if (/<(?:Video|Audio)\s*\d+>|@(?:视频|音频)\d+/i.test(prompt)) throw new Error('提示词引用了本次未提供的视频或音频素材')
  if (model === 'H3' ? /@图\d+/.test(prompt) : /<Picture\s*\d+>/i.test(prompt)) throw new Error('提示词参考图语法与实际输入路线不一致')
  const subjectDefinitions = (prompt.match(/^subject_definitions:\s*\n([\s\S]*)/m)?.[1] || prompt).split(/^summary:/m)[0]
  const definitions = model === 'H3'
    ? [...new Set([...subjectDefinitions.matchAll(/<Picture (\d+)>/g)].map(match => Number(match[1])))].sort((a, b) => a - b)
      .map(number => ({ number, text: subjectDefinitions.split('\n').filter(line => line.includes(`<Picture ${number}>`)).join('\n') }))
    : [...prompt.matchAll(/^@图(\d+)[：:]([^\n]*)$/gm)].map(match => ({ number: Number(match[1]), text: match[2] }))
  if (definitions.length !== refs.length || definitions.some((item, index) => item.number !== index + 1 || !item.text.includes(refs[index].split('/').slice(1).join('/'))))
    throw new Error('视频提示词的参考图编号、实体名称或顺序与本段登记不一致，请先修正提示词')
  const used = model === 'H3' ? [...prompt.matchAll(/<Picture (\d+)>/g)] : [...prompt.matchAll(/@图(\d+)/g)]
  if (used.some(match => Number(match[1]) < 1 || Number(match[1]) > refs.length))
    throw new Error('视频提示词正文引用了未登记的参考图，请先核对图号')
}

/** 用户在审图/审片面板明确编辑正文：只刷新该文件的指纹，其余依赖必须仍然一致。 */
export async function rewriteCheckpointPrompt(wikiRoot: string, checkpoint: CheckpointFiles, path: string, body: string, deps: WikiTaskDeps, options?: { fullDocument?: boolean }) {
  await verifyCheckpointFiles(checkpoint, deps)
  if (checkpoint.files && !Object.values(checkpoint.files).some(entries => path in entries))
    throw new Error('提示词未登记在本集进度中，不能直接修改')
  const original = await deps.readText(path)
  const heading = original.match(/^(?:\s*#[^\n]*\n)+/)?.[0] || ''
  const text = options?.fullDocument ? body : `${heading}${body.trim()}\n`
  const next = JSON.parse(JSON.stringify(checkpoint)) as CheckpointFiles
  const hash = await textHash(text)
  for (const entries of Object.values(next.files || {})) if (path in entries) entries[path] = hash
  for (const entry of Object.values(next.assets || {})) if (entry.prompt_path === path) entry.prompt_hash = hash
  await deps.writeText(path, text)
  if (next.files) await deps.writeText(`${wikiRoot}/制作流水线/${checkpoint.video_model}/第${checkpoint.episode_number}集进度.json`, JSON.stringify(next, null, 2) + '\n')
  Object.assign(checkpoint, next)
  return text
}
