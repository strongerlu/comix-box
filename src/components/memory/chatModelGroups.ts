import { LOCAL_OLLAMA_PROVIDER_ID } from '@/utils/providerConfig'

const PREFERRED_GROUPS = ['anthropic', 'openai', 'google', 'deepseek', 'qwen', 'xai', 'other', 'local']
const GROUP_LABELS: Record<string, string> = { anthropic: 'Claude', openai: 'GPT', google: 'Gemini', deepseek: 'DeepSeek', qwen: '千问', xai: 'Grok', other: '其他', local: '本地模型' }

function modelGroupKey(model: { id: string; providerId?: string }): string {
  if (model.providerId === LOCAL_OLLAMA_PROVIDER_ID) return 'local'
  const id = model.id.toLowerCase()
  if (id.includes('claude') || id.includes('anthropic')) return 'anthropic'
  if (id.includes('gpt') || id.includes('openai')) return 'openai'
  if (id.includes('gemini') || id.includes('gemma') || id.includes('google')) return 'google'
  if (id.includes('grok') || id.includes('xai')) return 'xai'
  if (id.includes('deepseek')) return 'deepseek'
  if (id.includes('qwen') || id.includes('tongyi')) return 'qwen'
  if (id.includes('ollama') || id.includes('local-')) return 'local'
  return 'other'
}

/** 对话模型按厂商分组，组按固定顺序排，组内保持原顺序。 */
export function groupChatModels<T extends { id: string; providerId?: string }>(models: T[]) {
  const groups = new Map<string, T[]>()
  for (const model of models) {
    const key = modelGroupKey(model)
    const group = groups.get(key) || []
    group.push(model)
    groups.set(key, group)
  }
  const remaining = [...groups.entries()]
  const groupRank = (key: string) => PREFERRED_GROUPS.indexOf(key)
  remaining.sort(([left], [right]) => groupRank(left) - groupRank(right))
  return remaining.map(([key, models]) => ({ key, label: GROUP_LABELS[key] || key, models }))
}

export function isInternalMediaModel(modelId: string): boolean {
  const id = modelId.toLowerCase()
  return id.startsWith('rh-') || id.includes('/rh-') || id.includes('runninghub') || id === 'jina-search' || id === 'jina-reader'
}
