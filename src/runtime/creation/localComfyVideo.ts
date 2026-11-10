import { ref } from 'vue'

export type Workflow = Record<string, { class_type: string; inputs: Record<string, unknown> }>
export interface LocalComfyVideo {
  id: string
  name: string
  workflow: Workflow
  bindings: { prompt: string; duration?: string; width?: string; height?: string; seed?: string }
  minSeconds: number
  maxSeconds: number
}
const key = 'comicBoxLocalComfyVideos'
export const localComfyLoadError = ref('')
export const localComfyVideos = ref<LocalComfyVideo[]>(load())

function binding(workflow: Workflow, value: string) {
  const match = /^([^.\s]+)\.([\w-]+)$/.exec(value)
  if (!match || !Object.hasOwn(workflow[match[1]]?.inputs || {}, match[2])) throw new Error(`参数绑定不存在：${value}（格式：节点ID.输入名）`)
  return { node: match[1], input: match[2] }
}

export function localComfyDurationStep(profile: LocalComfyVideo): number | undefined {
  if (!profile.bindings.duration) return undefined
  const { node, input } = binding(profile.workflow, profile.bindings.duration)
  const target = profile.workflow[node]
  if (target.class_type === 'PrimitiveFloat') return 0.1
  if (target.class_type === 'PrimitiveInt') return 1
  return Number.isInteger(target.inputs[input]) ? 1 : 0.1
}

export function validateLocalComfyVideo(profile: LocalComfyVideo) {
  if (!/^local-comfy\/user-[\w-]+$/.test(profile.id) || !profile.name?.trim()) throw new Error('请填写本地模型名称')
  const graph = profile.workflow
  if (!graph || typeof graph !== 'object' || Array.isArray(graph) || !Object.keys(graph).length || 'nodes' in graph) throw new Error('请粘贴 ComfyUI「导出(API)」的工作流，不是普通画布 JSON')
  for (const node of Object.values(graph)) {
    if (!node || typeof node.class_type !== 'string' || !node.inputs || typeof node.inputs !== 'object' || Array.isArray(node.inputs)) throw new Error('API 工作流节点格式无效')
    if (Object.entries(node.inputs).some(([k, v]) => /^(api_key|access_token|password|secret)$/i.test(k) && v)) throw new Error('本地工作流不能包含明文凭据，请移除后再保存')
  }
  if (!profile.bindings?.prompt) throw new Error('请绑定提示词输入')
  const used = new Set<string>()
  for (const [name, value] of Object.entries(profile.bindings)) {
    if (!['prompt', 'duration', 'width', 'height', 'seed'].includes(name)) throw new Error('不支持的参数绑定')
    if (!value) continue
    const at = binding(graph, value)
    if (used.has(value)) throw new Error('不同参数不能绑定同一个输入')
    used.add(value)
    if (typeof graph[at.node].inputs[at.input] !== (name === 'prompt' ? 'string' : 'number')) throw new Error(`${name} 的目标输入类型不匹配`)
  }
  if (Boolean(profile.bindings.width) !== Boolean(profile.bindings.height)) throw new Error('宽高必须同时绑定')
  if (!Number.isFinite(profile.minSeconds) || !Number.isFinite(profile.maxSeconds) || profile.minSeconds <= 0 || profile.maxSeconds < profile.minSeconds || profile.maxSeconds > 3600) throw new Error('时长范围无效（最长3600秒）')
  if (!profile.bindings.duration && profile.minSeconds !== profile.maxSeconds) throw new Error('未绑定时长时，请把最短和最长设为工作流固定时长')
}

function load(): LocalComfyVideo[] {
  try {
    if (typeof localStorage === 'undefined') return []
    const profiles = JSON.parse(localStorage.getItem(key) ?? '[]')
    if (!Array.isArray(profiles)) throw new Error('配置格式无效')
    profiles.forEach(validateLocalComfyVideo)
    if (new Set(profiles.map(p => p.id)).size !== profiles.length) throw new Error('模型 ID 重复')
    return profiles
  } catch (error) { localComfyLoadError.value = `本地模型配置读取失败，原配置未覆盖：${String(error)}`; return [] }
}

export function saveLocalComfyVideo(profile: LocalComfyVideo) {
  if (localComfyLoadError.value) throw new Error('本地模型配置读取失败。请先修复原配置并重启应用，再保存模型。')
  validateLocalComfyVideo(profile)
  if (localComfyDurationStep(profile) === 1 && Math.ceil(profile.minSeconds) > Math.floor(profile.maxSeconds)) {
    throw new Error('工作流时长需要整数秒，请设置包含整数秒的范围')
  }
  const copy = JSON.parse(JSON.stringify(profile)) as LocalComfyVideo
  const next = [...localComfyVideos.value.filter(p => p.id !== copy.id), copy]
  localStorage.setItem(key, JSON.stringify(next))
  localComfyVideos.value = next
}

export function buildLocalComfyVideo(profile: LocalComfyVideo, params: Record<string, unknown>): Workflow {
  validateLocalComfyVideo(profile)
  const duration = Number(params.duration)
  if (!String(params.prompt || '').trim()) throw new Error('提示词不能为空')
  if (!Number.isFinite(duration) || duration < profile.minSeconds || duration > profile.maxSeconds) throw new Error('时长超出本地工作流范围')
  if (localComfyDurationStep(profile) === 1 && !Number.isInteger(duration)) throw new Error('工作流时长必须是整数秒')
  const graph = JSON.parse(JSON.stringify(profile.workflow)) as Workflow
  const values = { prompt: String(params.prompt), duration, width: Number(params.width), height: Number(params.height), seed: Number(params.seed) }
  for (const [name, value] of Object.entries(profile.bindings)) {
    if (!value) continue
    const next = values[name as keyof typeof values]
    if (name !== 'prompt' && (!Number.isFinite(next) || name !== 'duration' && !Number.isSafeInteger(next) || name !== 'seed' && Number(next) <= 0 || name === 'seed' && Number(next) < 0)) throw new Error(`${name} 参数无效`)
    const at = binding(graph, value)
    graph[at.node].inputs[at.input] = next
  }
  return graph
}
