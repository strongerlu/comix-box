/**
 * 漫剧全自动成片 P2：视频提交与后台检查。
 *
 * 资产齐全后按每段 refs（@图 顺序）取参考图提交视频，不等待；
 * 之后在集与集之间或定时调用 checkEpisodeVideos 单次检查，不在这里循环轮询。
 */
import { MAX_TRANSIENT, MODERATION, RATE_LIMIT, promptBody, registeredTask, unresolvedSubmission, type WikiTaskDeps } from './assetScheduler'
import { UNCERTAIN_SUBMISSION } from '../creation/submissionSafety'
import { rewriteCheckpointPrompt, usesContinuation, validatePromptReferences, validateSegmentPlan, verifyCheckpointFiles, type CheckpointFiles, type SegmentTransition } from './checkpointPreflight'

/** 首次提交 + 1 次重试（2026-10-25 用户确认）。 */
const MAX_ATTEMPTS = 2

export interface VideoCheckpoint extends CheckpointFiles {
  episode_number: number
  video_model: string
  segments: Array<{ path: string; start_seconds: number; end_seconds: number; refs?: string[]; transition?: SegmentTransition }>
}

export interface VideoSchedulerDeps extends WikiTaskDeps {
  submitVideo(input: { requestId: string; prompt: string; images: string[]; durationSeconds: number; firstFrame?: string }): Promise<string>
  modelId?: string
  /** 用户明确选择的续接接口；互斥模式只上传上一段尾帧，原参考图仍保留作来源。 */
  continuation?: { modelId: string; exclusive: boolean; checkVideo(input: { prompt: string; images: string[]; durationSeconds: number; firstFrame?: string }): void; submitVideo: VideoSchedulerDeps['submitVideo'] }
  waitPrevious?(check: () => Promise<boolean>): Promise<void>
  canUseFirstFrame?(referenceCount: number): boolean
  extractTailFrame?(video: string, endSeconds: number): Promise<string>
  /** 提交前对每段做模型约束检查（时长档位、参考图上限），任一段不合格则整集不提交。 */
  checkVideo?(input: { prompt: string; images: string[]; durationSeconds: number; firstFrame?: string }): void
  /**
   * 等这一段的参考图上传完、任务已交给模型后再提交下一段。2026-10-25 实测：10 段同时提交，
   * 几十张 2MB 参考图同时上传 R2 挤满上行、申请上传地址 502，单张上传则正常。
   */
  waitSubmitted?(taskId: string): Promise<void>
}

export type ReviewCategory = 'story' | 'continuity' | 'color' | 'sound'
export interface SegmentReviewNote { category: ReviewCategory; notes: string }
export interface FrameBinding { model_id?: string; exclusive?: boolean; path: string; source_task_id?: string; source_fingerprint: string; source_video_path: string; end_seconds: number }
export interface VideoEntry {
  path: string
  fingerprint: string
  images: string[]
  duration_seconds: number
  status: 'pending' | 'ready' | 'failed' | 'uncertain'
  attempts: number
  /** 累计提交次数，生成唯一 requestId。 */
  submits?: number
  /** 连续暂时性失败（限流、网络）次数。 */
  transient?: number
  task_id?: string
  request_id?: string
  video_path?: string
  error?: string
  model_id?: string
  prompt_document?: string
  submitted_prompt?: string
  refs?: string[]
  start_seconds?: number
  end_seconds?: number
  first_frame?: FrameBinding
  transition?: SegmentTransition
  origin?: 'generation' | 'postprocess'
  review?: SegmentReviewNote
  versions?: VideoVersion[]
}

export interface VideoVersion extends Omit<VideoEntry, 'versions'> { id: string; current?: boolean }

type Registry = { version: 1; segments: VideoEntry[] }

export interface VideoCheckResult {
  status: 'ready' | 'pending' | 'failed'
  /** 按片段顺序给出本地视频路径，未完成项为空；仅 ready 时可拼接。 */
  videos: string[]
  pending: number[]
  failed: number[]
  /** 绑定实际任务与提示词版本，防止旧审片确认沿用于新视频。 */
  reviewKey: string
}

export function videoRegistryPath(model: string, episode: number) {
  return `制作流水线/${model}/第${episode}集视频任务.json`
}

async function load(wikiRoot: string, checkpoint: VideoCheckpoint, deps: WikiTaskDeps): Promise<Registry> {
  const path = `${wikiRoot}/${videoRegistryPath(checkpoint.video_model, checkpoint.episode_number)}`
  return await deps.exists(path) ? JSON.parse(await deps.readText(path)) : { version: 1, segments: [] }
}

function save(wikiRoot: string, checkpoint: VideoCheckpoint, registry: Registry, deps: WikiTaskDeps) {
  return deps.writeText(`${wikiRoot}/${videoRegistryPath(checkpoint.video_model, checkpoint.episode_number)}`, JSON.stringify(registry, null, 2) + '\n')
}

async function fingerprintOf(text: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('').slice(0, 16)
}

type Prepared = { images: string[]; durationSeconds: number; fingerprint: string }

function inputFingerprint(prompt: string, images: string[], duration: number, frame?: FrameBinding) {
  return fingerprintOf(JSON.stringify(frame ? [prompt, images, duration, frame] : [prompt, images, duration]))
}

function staleFrame(entry: VideoEntry, previous?: VideoEntry) {
  const frame = entry.first_frame
  return frame && (!previous || previous.status !== 'ready' || frame.source_task_id !== previous.task_id
    || frame.source_fingerprint !== previous.fingerprint || frame.source_video_path !== previous.video_path)
}

async function prepare(segment: VideoCheckpoint['segments'][number], images: Record<string, string>, model: string, deps: VideoSchedulerDeps, frame?: FrameBinding, plannedContinuation = false): Promise<Prepared> {
  const refs = segment.refs || []
  const missing = refs.filter(id => !images[id])
  if (missing.length) throw new Error(`参考图未就绪：${missing.join('、')}`)
  const prompt = promptBody(await deps.readText(segment.path))
  validatePromptReferences(prompt, refs, model)
  const ordered = refs.map(id => images[id])
  const durationSeconds = Math.ceil(segment.end_seconds - segment.start_seconds)
  const exclusive = frame?.exclusive ?? (plannedContinuation && deps.continuation?.exclusive)
  const input = { prompt: exclusive ? continuationPrompt(prompt) : prompt, images: exclusive ? [] : ordered, durationSeconds, firstFrame: frame?.path || (plannedContinuation ? 'preflight-only' : undefined) }
  if (frame?.model_id) {
    if (deps.continuation?.modelId !== frame.model_id) throw new Error('首帧续接型号与保存的任务不一致')
    deps.continuation.checkVideo(input)
  } else if (plannedContinuation) deps.continuation!.checkVideo(input)
  else deps.checkVideo?.(input)
  return { images: ordered, durationSeconds, fingerprint: await inputFingerprint(prompt, ordered, durationSeconds, frame) }
}

/** 单首帧已包含实际人物与空间；保留描述，移除不存在的多参考图编号。 */
export function continuationPrompt(prompt: string) {
  const instruction = 'Continue from the supplied first frame. Preserve its people, objects, positions and lighting. The descriptions below refer to those same entities, not additional images.'
  const body = prompt.replace(/<Picture (\d+)>/g, 'Subject $1').replace(/@图(\d+)/g, '主体$1')
  // H3 的单首帧模式使用三节基础结构；保留人物描述、镜头、对白与声音，不能只换图号仍发送多参考格式。
  if (/^subject_definitions:/m.test(body)) {
    const sound = body.search(/^overall_soundscape:/m)
    const visual = (sound >= 0 ? body.slice(0, sound) : body).replace(/^(?:subject_definitions|summary|retention_analysis|detailed_description):\s*/gm, '')
    return `integrated_multimodal_description:\n${instruction}\n\n${visual.trim()}\n\n${sound >= 0 ? body.slice(sound) : 'overall_soundscape:\n\nnon_diegetic_music:\n'}`
  }
  return `${instruction}\n\n${body}`
}

function generationInput(entry: VideoEntry, prompt: string) {
  return { prompt: entry.first_frame?.exclusive ? continuationPrompt(prompt) : prompt,
    images: entry.first_frame?.exclusive ? [] : entry.images, durationSeconds: entry.duration_seconds,
    ...(entry.first_frame && { firstFrame: entry.first_frame.path }) }
}

function continuationRoute(entry: VideoEntry, deps: VideoSchedulerDeps) {
  if (!entry.first_frame?.model_id) return undefined
  if (deps.continuation?.modelId !== entry.first_frame.model_id) throw new Error('此段首帧续接型号与当前配置不一致，请恢复原配置后继续')
  return deps.continuation
}

async function submit(wikiRoot: string, checkpoint: VideoCheckpoint, registry: Registry, index: number, deps: VideoSchedulerDeps) {
  const entry = registry.segments[index]
  const document = await deps.readText(entry.path)
  const prompt = promptBody(document)
  const refs = entry.refs || checkpoint.segments[index].refs || []
  validatePromptReferences(prompt, refs, checkpoint.video_model)
  if (await inputFingerprint(prompt, entry.images, entry.duration_seconds, entry.first_frame) !== entry.fingerprint)
    throw new Error('提交前提示词或素材输入已改变，请重新校验后再生成')
  const route = continuationRoute(entry, deps)
  const input = generationInput(entry, prompt)
  validatePromptReferences(input.prompt, entry.first_frame?.exclusive ? [] : refs, checkpoint.video_model)
  if (route) route.checkVideo(input)
  else deps.checkVideo?.(input)
  entry.submits = (entry.submits ?? entry.attempts - 1) + 1
  const requestId = `manju-video:${checkpoint.video_model}:${checkpoint.episode_number}:${index + 1}:${entry.fingerprint}:${entry.submits}`
  entry.request_id = requestId
  entry.status = 'pending'
  delete entry.error
  delete entry.task_id
  entry.prompt_document = document
  entry.submitted_prompt = input.prompt
  entry.model_id = route?.modelId || deps.modelId
  entry.origin = 'generation'
  await save(wikiRoot, checkpoint, registry, deps)
  entry.task_id = await (route?.submitVideo || deps.submitVideo)({ requestId, ...input })
  await save(wikiRoot, checkpoint, registry, deps)
  await deps.waitSubmitted?.(entry.task_id)
}

/**
 * 资产齐全后调用：按 refs 顺序取图提交每段视频，立即返回。指纹未变的段不重复提交。
 * 每段要等上传完成（可能数分钟），段与段之间检查 shouldStop；停下返回 false，续做时只补交未提交的段。
 */
export async function submitEpisodeVideos(wikiRoot: string, checkpoint: VideoCheckpoint, images: Record<string, string>, deps: VideoSchedulerDeps, shouldStop?: () => boolean): Promise<boolean> {
  await verifyCheckpointFiles(checkpoint, deps)
  validateSegmentPlan(checkpoint)
  const registry = await load(wikiRoot, checkpoint, deps)
  const prepared = await Promise.all(checkpoint.segments.map(async (segment, index) => {
    try {
      const current = registry.segments[index]
      if (current?.first_frame && segment.transition && segment.transition.type !== 'continue'
        && current.transition?.type !== segment.transition.type) throw new Error('镜头关系已改为切镜，请先在审片中普通重做本段以解除旧首帧绑定')
      if (registry.segments[index] && staleFrame(registry.segments[index], registry.segments[index - 1])) throw new Error('首帧绑定已过期，请重新绑定上一段的当前尾帧')
      return await prepare(segment, images, checkpoint.video_model, deps, registry.segments[index]?.first_frame, usesContinuation(segment, index, Boolean(deps.continuation)))
    }
    catch (cause) { throw new Error(`第${index + 1}段（${segment.path}）：${cause instanceof Error ? cause.message : String(cause)}`) }
  }))
  registry.segments.length = Math.min(registry.segments.length, checkpoint.segments.length)
  for (const [index, segment] of checkpoint.segments.entries()) {
    if (shouldStop?.()) { await save(wikiRoot, checkpoint, registry, deps); return false }
    const current = registry.segments[index]
    let frame = current?.first_frame
    if (usesContinuation(segment, index, Boolean(deps.continuation)) && deps.continuation && !current) {
      if (!deps.extractTailFrame || !deps.waitPrevious) throw new Error('首帧续接缺少等待或提帧能力')
      await deps.waitPrevious(async () => {
        if (shouldStop?.()) throw new Error('续接等待已停止；已提交任务保留，续做时恢复查询')
        await checkEpisodeVideos(wikiRoot, checkpoint, deps)
        Object.assign(registry, await load(wikiRoot, checkpoint, deps))
        const previous = registry.segments[index - 1]
        if (previous?.status === 'failed' || previous?.status === 'uncertain') throw new Error('上一段尚未成功，已停止后续首帧提交')
        return previous?.status === 'ready'
      })
      if (shouldStop?.()) return false
      const previous = registry.segments[index - 1], source = checkpoint.segments[index - 1]
      const end = source.end_seconds - source.start_seconds
      frame = { path: await deps.extractTailFrame(previous.video_path!, end), source_task_id: previous.task_id,
        source_fingerprint: previous.fingerprint, source_video_path: previous.video_path!, end_seconds: end,
        model_id: deps.continuation.modelId, exclusive: deps.continuation.exclusive }
      prepared[index] = await prepare(segment, images, checkpoint.video_model, deps, frame)
    }
    if (current?.status === 'failed' && unresolvedSubmission(await registeredTask(current, deps))) {
      Object.assign(current, { status: 'uncertain', error: UNCERTAIN_SUBMISSION })
      await save(wikiRoot, checkpoint, registry, deps)
    }
    if (current?.status === 'uncertain') continue
    if (current?.path === segment.path && current.fingerprint === prepared[index].fingerprint && current.status !== 'failed'
      && (!current.model_id || !deps.modelId || current.model_id === (frame?.model_id || deps.modelId))) continue
    if (current) await archiveVersion(current, segment, deps)
    const { fingerprint, images: ordered, durationSeconds } = prepared[index]
    registry.segments[index] = { path: segment.path, fingerprint, images: ordered, duration_seconds: durationSeconds, status: 'pending', attempts: 1,
      refs: segment.refs || [], start_seconds: segment.start_seconds, end_seconds: segment.end_seconds,
      ...(segment.transition && { transition: segment.transition }),
      ...(current && { submits: current.submits ?? current.attempts, versions: current.versions }), ...(frame && { first_frame: frame }) }
    await submit(wikiRoot, checkpoint, registry, index, deps)
  }
  await save(wikiRoot, checkpoint, registry, deps)
  return true
}

/** 新一次运行时调用：上次最终失败的片段用登记的参考图与时长重新给一轮机会。返回重提的段号（从 1 起）。 */
export async function retryFailedVideos(wikiRoot: string, checkpoint: VideoCheckpoint, deps: VideoSchedulerDeps): Promise<number[]> {
  const registry = await load(wikiRoot, checkpoint, deps)
  const retried: number[] = []
  for (const [index, entry] of registry.segments.entries()) {
    if (staleFrame(entry, registry.segments[index - 1])) {
      entry.error = '首帧绑定已过期：上一段版本已改变，请重新绑定后重做本段，或恢复对应的上一段版本'
      continue
    }
    if (entry.status !== 'failed') continue
    if (unresolvedSubmission(await registeredTask(entry, deps))) {
      Object.assign(entry, { status: 'uncertain', error: UNCERTAIN_SUBMISSION })
      await save(wikiRoot, checkpoint, registry, deps)
      continue
    }
    Object.assign(entry, { attempts: 1, transient: 0 })
    delete entry.error
    await submit(wikiRoot, checkpoint, registry, index, deps)
    retried.push(index + 1)
  }
  return retried
}

/** 单次检查：成功且已落盘的段标记完成；失败重提 1 次；审核类失败不重试。 */
export async function checkEpisodeVideos(wikiRoot: string, checkpoint: VideoCheckpoint, deps: VideoSchedulerDeps): Promise<VideoCheckResult> {
  const registry = await load(wikiRoot, checkpoint, deps)
  const pending: number[] = [], failed: number[] = []
  for (const [index, entry] of registry.segments.entries()) {
    if (staleFrame(entry, registry.segments[index - 1])) {
      entry.error = '首帧绑定已过期：上一段版本已改变，请重新绑定后重做本段，或恢复对应的上一段版本'
      failed.push(index + 1)
      continue
    }
    if (entry.status === 'ready' && entry.error?.startsWith('首帧绑定已过期')) delete entry.error
    if (entry.status === 'ready') continue
    if (entry.status === 'failed') { failed.push(index + 1); continue }
    const task = await registeredTask(entry, deps)
    if (entry.status === 'uncertain' && task?.status !== 'success') { failed.push(index + 1); continue }
    if (unresolvedSubmission(task)) {
      Object.assign(entry, { status: 'uncertain', error: UNCERTAIN_SUBMISSION })
      failed.push(index + 1)
    } else if (task?.status === 'success' && task.localPath) {
      entry.status = 'ready'
      entry.video_path = task.localPath
    } else if (!task || task.status === 'failed' || task.status === 'cancelled' || task.status === 'interrupted') {
      const error = task?.error || '任务记录丢失'
      if (task && RATE_LIMIT.test(error) && (entry.transient ?? 0) < MAX_TRANSIENT) {
        // 限流、网络抖动或 App 重启后无人跟进：直接重提（沿用登记的参考图与时长），不计入重试次数。
        entry.transient = (entry.transient ?? 0) + 1
        await submit(wikiRoot, checkpoint, registry, index, deps)
        pending.push(index + 1)
      } else if (MODERATION.test(error) || entry.attempts >= MAX_ATTEMPTS) {
        Object.assign(entry, { status: 'failed', error })
        failed.push(index + 1)
      } else {
        // 重提沿用登记的参考图与时长，不重新解析资产。
        entry.attempts += 1
        await submit(wikiRoot, checkpoint, registry, index, deps)
        pending.push(index + 1)
      }
    } else {
      pending.push(index + 1)
    }
  }
  await save(wikiRoot, checkpoint, registry, deps)
  const status = pending.length ? 'pending' : failed.length ? 'failed' : 'ready'
  const reviewKey = await fingerprintOf(JSON.stringify(registry.segments.map(entry => [entry.path, entry.fingerprint, entry.task_id, entry.video_path])))
  return { status, videos: registry.segments.map(entry => entry.status === 'ready' ? entry.video_path! : ''), pending, failed, reviewKey }
}

/**
 * 审片时单独重做一段：沿用登记的参考图与时长，读取当前提示词（可能刚改过）重新提交，
 * 指纹随提示词更新，之后的整集提交不会再交一次。
 */
export async function regenerateSegment(wikiRoot: string, checkpoint: VideoCheckpoint, index: number, deps: VideoSchedulerDeps, options?: { previousTail?: boolean }) {
  await verifyCheckpointFiles(checkpoint, deps)
  const registry = await load(wikiRoot, checkpoint, deps)
  const entry = registry.segments[index]
  if (!entry) throw new Error(`找不到第${index + 1}段视频任务`)
  await archiveVersion(entry, checkpoint.segments[index], deps)
  const segment = checkpoint.segments[index]
  if (!options?.previousTail && segment.transition && segment.transition.type !== 'continue') delete entry.first_frame
  if (options?.previousTail) {
    if ((!deps.continuation && !deps.canUseFirstFrame?.(entry.images.length)) || !deps.extractTailFrame) throw new Error('所选模型不支持当前参考图与首帧约束组合')
    const previous = registry.segments[index - 1]
    if (!previous?.video_path || previous.status !== 'ready') throw new Error('上一段视频尚未就绪，不能绑定尾帧')
    const source = checkpoint.segments[index - 1]
    const end = source.end_seconds - source.start_seconds
    entry.first_frame = { path: await deps.extractTailFrame(previous.video_path, end), source_task_id: previous.task_id,
      source_fingerprint: previous.fingerprint, source_video_path: previous.video_path, end_seconds: end, ...(deps.continuation && { model_id: deps.continuation.modelId, exclusive: deps.continuation.exclusive }) }
  }
  if (staleFrame(entry, registry.segments[index - 1])) throw new Error('首帧绑定已过期，请重新绑定上一段的当前尾帧')
  const prompt = promptBody(await deps.readText(entry.path))
  validatePromptReferences(prompt, checkpoint.segments[index].refs || [], checkpoint.video_model)
  const route = continuationRoute(entry, deps)
  if (route) route.checkVideo(generationInput(entry, prompt))
  else deps.checkVideo?.(generationInput(entry, prompt))
  Object.assign(entry, { fingerprint: await inputFingerprint(prompt, entry.images, entry.duration_seconds, entry.first_frame), attempts: 1, transient: 0,
    refs: checkpoint.segments[index].refs || [], start_seconds: checkpoint.segments[index].start_seconds, end_seconds: checkpoint.segments[index].end_seconds, transition: segment.transition })
  delete entry.video_path
  await submit(wikiRoot, checkpoint, registry, index, deps)
}

async function archiveVersion(entry: VideoEntry, segment: VideoCheckpoint['segments'][number], deps: VideoSchedulerDeps) {
  if (entry.status !== 'ready' || !entry.video_path) return
  const { versions: _versions, ...snapshot } = entry
  if (!snapshot.prompt_document) {
    const document = await deps.readText(entry.path)
    if (await inputFingerprint(promptBody(document), entry.images, entry.duration_seconds, entry.first_frame) === entry.fingerprint) snapshot.prompt_document = document
  }
  const id = await fingerprintOf(JSON.stringify([entry.fingerprint, entry.task_id, entry.video_path]))
  const version = { ...snapshot, id, refs: entry.refs ?? segment.refs ?? [],
    start_seconds: entry.start_seconds ?? segment.start_seconds, end_seconds: entry.end_seconds ?? segment.end_seconds }
  entry.versions = entry.versions?.some(item => item.id === id)
    ? entry.versions.map(item => item.id === id ? version : item) : [...entry.versions || [], version]
}

/** 修改提示词前调用，旧记录也能保留实际旧文；不生成、不修改原视频。 */
export async function rememberSegmentVersion(wikiRoot: string, checkpoint: VideoCheckpoint, index: number, deps: VideoSchedulerDeps) {
  const registry = await load(wikiRoot, checkpoint, deps)
  if (!registry.segments[index] || !checkpoint.segments[index]) throw new Error('找不到片段')
  await archiveVersion(registry.segments[index], checkpoint.segments[index], deps)
  await save(wikiRoot, checkpoint, registry, deps)
}

export async function listSegmentVersions(wikiRoot: string, checkpoint: VideoCheckpoint, index: number, deps: VideoSchedulerDeps): Promise<VideoVersion[]> {
  const registry = await load(wikiRoot, checkpoint, deps)
  const entry = registry.segments[index]
  if (!entry) return []
  await archiveVersion(entry, checkpoint.segments[index], deps)
  const current = await fingerprintOf(JSON.stringify([entry.fingerprint, entry.task_id, entry.video_path]))
  return (entry.versions || []).map(version => ({ ...version, current: entry.status === 'ready' && version.id === current }))
}

export async function restoreSegmentVersion(wikiRoot: string, checkpoint: VideoCheckpoint, index: number, id: string, deps: VideoSchedulerDeps) {
  await verifyCheckpointFiles(checkpoint, deps)
  const registry = await load(wikiRoot, checkpoint, deps)
  const current = registry.segments[index], segment = checkpoint.segments[index]
  if (!current || !segment) throw new Error('找不到片段')
  await archiveVersion(current, segment, deps)
  const version = current.versions?.find(item => item.id === id)
  if (!version?.video_path || !await deps.exists(version.video_path)) throw new Error('历史视频文件不存在，未恢复')
  if (!version.prompt_document) throw new Error('此历史版本缺少实际提示词快照，只能对比，不能恢复')
  if (version.path !== segment.path || version.start_seconds !== segment.start_seconds || version.end_seconds !== segment.end_seconds
    || JSON.stringify(version.refs) !== JSON.stringify(segment.refs || [])) throw new Error('当前分段时长或参考绑定已改变，不能直接恢复该版本')
  if (staleFrame(version, registry.segments[index - 1])) throw new Error('历史版本首帧依赖的上一段已改变，不能恢复')
  validatePromptReferences(promptBody(version.prompt_document), segment.refs || [], checkpoint.video_model)
  await rewriteCheckpointPrompt(wikiRoot, checkpoint, segment.path, version.prompt_document, deps, { fullDocument: true })
  const { id: _id, current: _current, ...selected } = version
  registry.segments[index] = { ...selected, status: 'ready', versions: current.versions, submits: current.submits }
  await save(wikiRoot, checkpoint, registry, deps)
  return version.video_path
}

export async function saveSegmentReview(wikiRoot: string, checkpoint: VideoCheckpoint, index: number, review: SegmentReviewNote, deps: VideoSchedulerDeps) {
  if (!['story', 'continuity', 'color', 'sound'].includes(review.category)) throw new Error('审片问题类型无效')
  const registry = await load(wikiRoot, checkpoint, deps)
  if (!registry.segments[index]) throw new Error('找不到片段')
  registry.segments[index].review = review
  await save(wikiRoot, checkpoint, registry, deps)
}

/** 后期结果是独立本地版本，保持原始视频和生成输入，不提交模型任务。 */
export async function registerProcessedVersion(wikiRoot: string, checkpoint: VideoCheckpoint, index: number, video: string, deps: VideoSchedulerDeps) {
  await verifyCheckpointFiles(checkpoint, deps)
  if (!await deps.exists(video)) throw new Error('本地处理结果文件不存在')
  const registry = await load(wikiRoot, checkpoint, deps)
  const entry = registry.segments[index]
  if (!entry || entry.status !== 'ready') throw new Error('视频尚未就绪')
  await archiveVersion(entry, checkpoint.segments[index], deps)
  entry.video_path = video
  entry.origin = 'postprocess'
  delete entry.error
  await save(wikiRoot, checkpoint, registry, deps)
}

/** 等一段视频出片（失败重试仍由 checkEpisodeVideos 负责），返回本地路径。 */
export async function awaitSegment(wikiRoot: string, checkpoint: VideoCheckpoint, index: number, deps: VideoSchedulerDeps,
  options: { sleep(ms: number): Promise<void>; timeoutMs: number; pollMs?: number }): Promise<string> {
  const deadline = Date.now() + options.timeoutMs
  for (;;) {
    const result = await checkEpisodeVideos(wikiRoot, checkpoint, deps)
    const entry = (await load(wikiRoot, checkpoint, deps)).segments[index]
    if (entry?.status === 'ready' && entry.video_path) return entry.video_path
    if (result.failed.includes(index + 1)) throw new Error(entry?.error || `第${index + 1}段视频生成失败`)
    if (Date.now() >= deadline) throw new Error(`第${index + 1}段视频等待超时`)
    await options.sleep(options.pollMs ?? 5000)
  }
}
