import type { CreationModelSpec } from '@/runtime/creation/creationMediaTypes'
import type { CreationCapability } from '@/runtime/creation/creationProtocolClient'

/**
 * 按模型登记的字段名和约束组装提交参数：各线路比例字段叫 ratio / aspect_ratio 不一，
 * 时长有的只允许固定档位（如 5/10/15/30），参考图有上限。
 * 本地登记（CreationModelSpec）与远程动态目录（CreationCapability）先统一成同一份档案。
 */
export interface MediaParamProfile {
  keys: string[]
  imageKey: string
  maxImages?: number
  duration?: { min?: number; max?: number; allowedValues?: number[] }
  durationKey?: string
  ratios?: string[]
  resolutions?: string[]
  ratioValues?: Record<string, string>
  sizes?: Array<{ value: string; ratio: string }>
  source?: 'catalog' | 'local'
  firstFrame?: { key: string; array: boolean; exclusive?: boolean; modeKey?: string }
}

export function profileFromSpec(spec: Pick<CreationModelSpec, 'fields' | 'capabilities' | 'files'> & { apiStyle?: string }): MediaParamProfile {
  const mode = spec.fields.find(field => field.key === 'image_mode')
  const firstFrame = spec.apiStyle === 'comfy-first-frame'
    ? { key: 'images', array: true, exclusive: true }
    : mode?.options?.some(option => option.value === 'first_frame')
      ? { key: 'images', array: true, exclusive: true, modeKey: 'image_mode' } : undefined
  const ratioField = spec.fields.find(field => ['ratio', 'aspect_ratio', 'aspectRatio'].includes(field.key))
  const ratioValues = Object.fromEntries((ratioField?.options || []).flatMap(option => {
    const ratio = String(option.value).match(/^(\d+:\d+)(?:\s|$)/)?.[1]
    return ratio ? [[ratio, String(option.value)]] : []
  }))
  const sizes = (spec.fields.find(field => field.key === 'size')?.options || []).flatMap(option => {
    const ratio = option.label.match(/\b(\d+:\d+)\b/)?.[1]
    return ratio ? [{ value: String(option.value), ratio }] : []
  })
  return { ratioValues, sizes, keys: spec.fields.map(field => field.key), imageKey: 'images', maxImages: spec.files?.images?.max, duration: spec.capabilities.duration,
    source: 'local', ratios: Object.keys(ratioValues).length ? Object.keys(ratioValues) : sizes.length ? [...new Set(sizes.map(size => size.ratio))] : spec.capabilities.ratios, resolutions: spec.capabilities.resolutions,
    durationKey: ['duration', 'duration_seconds', 'seconds'].find(key => spec.fields.some(field => field.key === key)), firstFrame }
}

export function profileFromCapability(capability: Pick<CreationCapability, 'parameter_schema' | 'asset_slots'>): MediaParamProfile {
  const properties = (capability.parameter_schema.properties || {}) as Record<string, { type?: string; enum?: unknown[]; minimum?: number; maximum?: number }>
  const frame = capability.asset_slots.find(item => ['first_frame', 'first_frame_image'].includes(item.name) && item.modalities.includes('image'))
  const slot = capability.asset_slots.find(item => item !== frame && !['last_frame', 'last_frame_image'].includes(item.name) && item.modalities.includes('image'))
  const durationKey = ['duration', 'duration_seconds', 'seconds'].find(key => properties[key])
  const duration = durationKey ? properties[durationKey] : undefined
  const allowed = duration?.enum?.filter(value => typeof value === 'number' || typeof value === 'string' && value.trim()).map(Number).filter(value => Number.isFinite(value) && value > 0)
  const validRange = typeof duration?.maximum === 'number' && Number.isFinite(duration.maximum) && duration.maximum > 0
    && (duration.minimum === undefined || Number.isFinite(duration.minimum) && duration.minimum > 0 && duration.minimum <= duration.maximum)
  const strings = (key: string) => properties[key]?.enum?.filter((value): value is string => typeof value === 'string')
  const modeFrame = properties.image_mode?.enum?.includes('first_frame')
  return {
    keys: Object.keys(properties),
    imageKey: slot?.name || 'images',
    maxImages: slot?.max ?? (slot ? undefined : 0),
    duration: allowed?.length ? { allowedValues: allowed } : validRange ? { min: duration!.minimum, max: duration!.maximum } : undefined,
    durationKey, source: 'catalog',
    ratios: strings(['ratio', 'aspect_ratio', 'aspectRatio'].find(key => properties[key]) || ''), resolutions: strings('resolution'),
    firstFrame: frame ? { key: frame.name, array: true } : modeFrame ? { key: slot?.name || 'images', array: true, exclusive: true, modeKey: 'image_mode' } : undefined,
  }
}

export function buildMediaParams(
  profile: MediaParamProfile | undefined,
  input: { prompt: string; ratio: string; images?: string[]; durationSeconds?: number; resolution?: string; firstFrame?: string },
): Record<string, unknown> {
  const keys = new Set(profile?.keys || [])
  const ratioKey = ['ratio', 'aspect_ratio', 'aspectRatio'].find(key => keys.has(key)) || (!profile ? 'aspect_ratio' : undefined)
  if (profile?.ratios?.length && !profile.ratios.includes(input.ratio)) throw new Error('所选比例不在模型能力目录中')
  if (input.resolution && profile?.resolutions?.length && !profile.resolutions.includes(input.resolution)) throw new Error('所选分辨率不在模型能力目录中')
  const params: Record<string, unknown> = { prompt: input.prompt, ...(ratioKey && { [ratioKey]: profile?.ratioValues?.[input.ratio] || input.ratio }) }
  if (!ratioKey && profile?.sizes?.length) params.size = profile.sizes.find(size => size.ratio === input.ratio)?.value
  if (input.resolution && keys.has('resolution')) params.resolution = input.resolution
  if (input.images?.length) {
    const max = profile?.maxImages
    if (max !== undefined && input.images.length > max) throw new Error(`参考图 ${input.images.length} 张超过该模型上限 ${max} 张`)
    params[profile?.imageKey || 'images'] = input.images
  }
  if (input.durationSeconds !== undefined) {
    if (profile?.source === 'catalog' && !profile.duration) throw new Error('所选模型未声明有效时长合同，不能自动提交')
    const limit = profile?.duration
    const allowed = limit?.allowedValues?.slice().sort((a, b) => a - b)
    let duration = input.durationSeconds
    if (allowed?.length) {
      const fit = allowed.find(value => value >= duration)
      if (fit === undefined) throw new Error(`片段 ${duration} 秒超过该模型最长 ${allowed.at(-1)} 秒`)
      duration = fit
    } else {
      if (limit?.max !== undefined && duration > limit.max) throw new Error(`片段 ${duration} 秒超过该模型最长 ${limit.max} 秒`)
      if (limit?.min !== undefined) duration = Math.max(duration, limit.min)
    }
    params[profile?.durationKey || 'duration'] = duration
  }
  if (input.firstFrame) {
    const frame = profile?.firstFrame
    if (!frame) throw new Error('所选模型未明确声明首帧约束能力')
    if (frame.exclusive && input.images?.length) throw new Error('该模型的参考图与首帧模式互斥，不能丢弃身份参考图后继续提交')
    params[frame.key] = frame.array ? [input.firstFrame] : input.firstFrame
    if (frame.modeKey) params[frame.modeKey] = 'first_frame'
  }
  return params
}
