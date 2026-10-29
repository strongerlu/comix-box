import { findCreationTaskByRequest, runCreationOperation } from '@/runtime/creation/creationMcpBridge'
import { useMediaTaskStore } from '@/stores/mediaTaskStore'
import { invoke } from '@tauri-apps/api/core'
import { createRuntimeProjectFileService, createSkillDraftFiles } from '@/services/projectFileService'
import type { AssetSchedulerDeps, WikiTaskDeps } from './assetScheduler'
import { buildMediaParams, profileFromCapability, profileFromSpec, type MediaParamProfile } from './mediaParams'
import type { VideoSchedulerDeps } from './videoScheduler'

/** 读写项目 Wiki、经 @影音 同一桥查询任务。 */
function wikiTaskDeps(owner: string): WikiTaskDeps {
  const service = createRuntimeProjectFileService()
  const files = createSkillDraftFiles(service, owner)
  return {
    readText: path => files.readText(path),
    async writeText(path, content) { await files.writeText(path, content) },
    async exists(path) {
      const normalized = path.replace(/\\/g, '/')
      if (/^(?:[A-Za-z]:\/|\/)/.test(normalized)) {
        const split = normalized.lastIndexOf('/')
        return invoke<boolean>('dev_file_exists', { input: { root: normalized.slice(0, split), relativePath: normalized.slice(split + 1) } })
      }
      return invoke<boolean>('dev_file_exists', { input: { root: owner, relativePath: normalized } })
    },
    findTask: requestId => findCreationTaskByRequest(owner, requestId),
    async getTask(taskId) {
      try {
        const task = await runCreationOperation('get_creation_task', { taskId }) as { status: string; localPath?: string; error?: string; submissionUncertain?: boolean }
        if (task.status !== 'pending' && task.status !== 'running') return task
        // App 重启后只恢复查询；拿不到受理号时不能据此断定未提交。
        const store = useMediaTaskStore()
        if (store.isTaskActive(taskId)) return task
        const raw = store.getTask(taskId)
        if (raw?.planSnapshot?.protocol) return task // 统一合同任务由 get_creation_task 自己恢复
        if (raw && store.canRefreshTaskResult(raw)) {
          void store.refreshTaskResult(taskId).catch(() => {})
          return task
        }
        return { status: 'interrupted', submissionUncertain: true, error: '提交结果待核实：没有上游任务号，已停止自动重提' }
      } catch (error) {
        if (error instanceof Error && error.message === '未找到创作任务') return undefined
        throw error
      }
    },
  }
}

/** 经 @影音 同一桥提交，复用参数校验与 requestId 去重；canvas:false 不写入用户画布。 */
async function submit(owner: string, modelId: string, requestId: string, params: Record<string, unknown>) {
  const { contextVersion } = await runCreationOperation('get_creation_context', {}) as { contextVersion: string }
  const result = await runCreationOperation('submit_creation_task', { contextVersion, requestId, directory: owner, canvas: false, modelId, params }) as { taskId: string }
  return result.taskId
}

/** 读取模型参数档案：本地登记有 fields，远程动态目录有 parameter_schema。 */
export async function loadMediaParamProfile(modelId: string): Promise<MediaParamProfile> {
  const model = await runCreationOperation('get_creation_model', { modelId }) as Record<string, unknown>
  if (Array.isArray(model.fields)) return profileFromSpec(model as never)
  if (model.parameter_schema) return profileFromCapability(model as never)
  throw new Error(`无法读取模型参数：${modelId}`)
}

export function createDesktopAssetDeps(owner: string, config: { imageModelId: string; ratio: string }, profile: MediaParamProfile): AssetSchedulerDeps {
  return {
    ...wikiTaskDeps(owner),
    // 换装融合时 images = [身份图, 服装图]，按模型的参考图字段名传入。
    submitImage: ({ requestId, prompt, images }) => submit(owner, config.imageModelId, requestId, buildMediaParams(profile, { prompt, ratio: config.ratio, images })),
    sleep: ms => new Promise(resolve => setTimeout(resolve, ms)),
  }
}

export function createDesktopVideoDeps(owner: string, config: { videoModelId: string; ratio: string; resolution?: string; continuationModelId?: string }, profile: MediaParamProfile, continuationProfile?: MediaParamProfile): VideoSchedulerDeps {
  const params = (input: { prompt: string; images: string[]; durationSeconds: number; firstFrame?: string }) => buildMediaParams(profile, { ...input, ratio: config.ratio, resolution: config.resolution })
  return {
    ...wikiTaskDeps(owner),
    ...(config.continuationModelId && continuationProfile && { continuation: {
      modelId: config.continuationModelId, exclusive: Boolean(continuationProfile.firstFrame?.exclusive),
      checkVideo: (input: {prompt: string; images: string[]; durationSeconds: number; firstFrame?: string}) => { buildMediaParams(continuationProfile, { ...input, ratio: config.ratio }) },
      submitVideo: ({ requestId, ...input }: Parameters<VideoSchedulerDeps['submitVideo']>[0]) => submit(owner, config.continuationModelId!, requestId, buildMediaParams(continuationProfile, { ...input, ratio: config.ratio })),
    } }),
    async waitPrevious(check) {
      const deadline = Date.now() + 60 * 60_000
      while (!await check()) {
        if (Date.now() >= deadline) throw new Error('等待上一段超时；任务保留，续做查询原任务')
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    },
    modelId: config.videoModelId,
    canUseFirstFrame: count => Boolean(profile.firstFrame && (!profile.firstFrame.exclusive || count === 0)),
    extractTailFrame: (video, endSeconds) => invoke<string>('media_review_video', { input: { inputPath: video, action: 'tail_frame', endSeconds } }),
    checkVideo: input => { params(input) },
    // 依次提交：等上一段参考图上传完、拿到上游任务号（或已结束）再交下一段，最多等 10 分钟。
    async waitSubmitted(taskId) {
      const deadline = Date.now() + 10 * 60_000
      while (Date.now() < deadline) {
        const task = await runCreationOperation('get_creation_task', { taskId }).catch(() => undefined) as { status?: string; submitted?: boolean } | undefined
        if (!task || task.submitted || !['pending', 'running'].includes(String(task.status))) return
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    },
    submitVideo: ({ requestId, ...input }) => submit(owner, config.videoModelId, requestId, params(input)),
  }
}
