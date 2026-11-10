import assert from 'node:assert/strict'
import { test } from 'node:test'
import { localComfyVideos } from '../../runtime/creation/localComfyVideo'
import type { CreationPlanSnapshot } from '@/stores/mediaTaskStore'

import {
  addFiles,
  buildCurrentCreationParams,
  clearFiles,
  cpState,
  currentRunPlan,
  aspectOptions,
  applyPlanSnapshotParams,
  beginPlanSnapshotPrefill,
  canRegenerateCreationTask,
  genericModelFields,
  hasDuration,
  durationRange,
  resolutionOptions,
  sizeOptions,
  setModelFieldValue,
  setDuration,
  setAspect,
  setResolution,
  switchModel,
  switchTask,
} from '../useCreation'

test('a local float workflow keeps the fractional duration selected in the panel', () => {
  const previous = localComfyVideos.value
  localComfyVideos.value = [{ id: 'local-comfy/user-float', name: 'Float duration', minSeconds: 4, maxSeconds: 5.5,
    workflow: { '1': { class_type: 'TextEncode', inputs: { text: '' } }, '2': { class_type: 'PrimitiveFloat', inputs: { value: 4 } } },
    bindings: { prompt: '1.text', duration: '2.value' } }]
  try {
    switchTask('video')
    switchModel('local-comfy/user-float')
    assert.deepEqual(durationRange.value, { min: 4, max: 5.5, step: 0.1, fixed: false })
    setDuration(4.5)
    assert.equal(buildCurrentCreationParams().duration, 4.5)
  } finally {
    localComfyVideos.value = previous
  }
})

test('switching to a local workflow uses its dimensions and seed, while reselecting preserves edits', () => {
  const previous = localComfyVideos.value
  localComfyVideos.value = [{ id: 'local-comfy/user-dimensions', name: 'Local dimensions', minSeconds: 8, maxSeconds: 8,
    workflow: { '1': { class_type: 'Video', inputs: { prompt: '', width: 1344, height: 768, seed: 42 } } },
    bindings: { prompt: '1.prompt', width: '1.width', height: '1.height', seed: '1.seed' } }]
  try {
    switchTask('video')
    switchModel('jc-minimax-h3-ref2v')
    cpState.width = 512; cpState.height = 512; cpState.fieldValues.seed = 999
    switchModel('local-comfy/user-dimensions')
    assert.equal(buildCurrentCreationParams().width, 1344)
    assert.equal(buildCurrentCreationParams().height, 768)
    assert.equal(buildCurrentCreationParams().seed, 42)
    cpState.width = 960
    switchModel('local-comfy/user-dimensions')
    assert.equal(buildCurrentCreationParams().width, 960)
  } finally { localComfyVideos.value = previous }
})

test('only finished creation tasks with a plan snapshot can prefill the panel', () => {
  const plan = { modelId: 'jc-minimax-h3-ref2v' } as CreationPlanSnapshot
  for (const status of ['success', 'failed', 'cancelled'] as const) {
    assert.equal(canRegenerateCreationTask({ source: 'creation', status, planSnapshot: plan }), true)
  }
  assert.equal(canRegenerateCreationTask({ source: 'creation', status: 'running', planSnapshot: plan }), false)
  assert.equal(canRegenerateCreationTask({ source: 'chat', status: 'success', planSnapshot: plan }), false)
  assert.equal(canRegenerateCreationTask({ source: 'creation', status: 'success' }), false)
})

test('a local workflow snapshot restores model, parameters and prompt without references', () => {
  const previous = localComfyVideos.value
  localComfyVideos.value = [{ id: 'local-comfy/user-prefill', name: 'Prefill', minSeconds: 4, maxSeconds: 10,
    workflow: { '1': { class_type: 'Video', inputs: { prompt: '', width: 1344, height: 768, seed: 42, seconds: 4 } } },
    bindings: { prompt: '1.prompt', width: '1.width', height: '1.height', seed: '1.seed', duration: '1.seconds' } }]
  try {
    switchTask('image')
    addFiles([makeFile('stale.png', 'image/png')])
    const plan = { modelId: 'local-comfy/user-prefill', task: 'video', apiStyle: 'comfy-workflow-video',
      normalizedParams: { prompt: '旧提示词', duration: 8, width: 960, height: 540, seed: 7 } } as unknown as CreationPlanSnapshot
    assert.equal(beginPlanSnapshotPrefill(plan), false)
    assert.deepEqual(applyPlanSnapshotParams(plan, '旧提示词'), { hasReferences: false })
    assert.equal(cpState.modelKey, 'local-comfy/user-prefill')
    const params = buildCurrentCreationParams()
    assert.equal(params.width, 960)
    assert.equal(params.seed, 7)
    assert.equal(params.duration, 8)
    assert.equal(cpState.prompt, '旧提示词')
    assert.equal(cpState.files.length, 0)

    const withImage = { ...plan, normalizedParams: { ...plan.normalizedParams, images: ['https://cdn.example.test/a.png'] } }
    beginPlanSnapshotPrefill(withImage)
    assert.deepEqual(applyPlanSnapshotParams(withImage, '旧提示词'), { hasReferences: true })
  } finally { localComfyVideos.value = previous }
})

test('an AI app snapshot restores the app identity before node fields', () => {
  const plan = { modelId: 'rh-aiapp', task: 'video', apiStyle: 'rh-aiapp',
    normalizedParams: { webappId: '1987', outputType: 'video', billingModel: 'rh-app', '12:text': '雨夜' } } as unknown as CreationPlanSnapshot
  assert.equal(beginPlanSnapshotPrefill(plan), true)
  assert.equal(cpState.task, 'ai-app')
  assert.equal(cpState.aiAppWebappId, '1987')
  assert.equal(cpState.aiAppOutputType, 'video')
  assert.equal(cpState.aiAppBillingModel, 'rh-app')
  applyPlanSnapshotParams(plan, '雨夜')
  assert.equal(cpState.fieldValues['12:text'], '雨夜')
})

test('易红 Max 显示固定时长、720p 和运镜，切换后不沿用其他模型参数', () => {
  switchTask('video')
  switchModel('newapi/yihong/seedance-2.5-max')
  clearFiles()
  cpState.prompt = '公交车内的公益短片'
  assert.equal(hasDuration.value, true)
  assert.deepEqual(durationRange.value, { min: 30, max: 30, step: 1, fixed: true })
  assert.deepEqual(resolutionOptions.value, ['720p'])
  const camera = genericModelFields.value.find(field => field.key === 'camera_movement')
  assert.ok(camera)
  assert.deepEqual(camera.options?.map(option => option.value), ['auto', 'fixed'])
  setModelFieldValue(camera, 'fixed')
  const params = buildCurrentCreationParams()
  assert.equal(params.duration, 30)
  assert.equal(params.resolution, '720p')
  assert.equal(params.camera_movement, 'fixed')
  switchModel('newapi/yihong/seedance2.5 cheap')
  assert.equal(buildCurrentCreationParams().camera_movement, undefined)
})

function makeFile(name: string, type: string): File {
  return new File(['fixture'], name, { type })
}

test('switching from a 2K GPT route to the 1K route discards the stale derived size', () => {
  switchTask('image')
  switchModel('gpt-image-2-超分')
  cpState.prompt = '一张方形图片'
  cpState.ar = '1:1'
  setResolution('2k')
  assert.equal(cpState.size, '2048x2048')

  switchModel('gpt-image-2-1k')

  assert.equal(buildCurrentCreationParams().size, undefined)
  assert.equal(currentRunPlan.value?.debug.normalizedParams.size, '1024x1024')
})

test('易红 GPT Image 面板拆分尺寸与比例，并按可用像素组合约束选项', () => {
  switchTask('image')
  cpState.prompt = 'p'
  cpState.ar = '1:1'
  cpState.res = '1k'
  switchModel('newapi/yihong/yihong-gpt-image-2')

  assert.deepEqual(aspectOptions.value, ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'])
  assert.deepEqual(resolutionOptions.value, ['1k', '2k'])
  assert.deepEqual(sizeOptions.value, [])
  assert.equal(buildCurrentCreationParams().size, undefined)

  setAspect('9:16')
  assert.deepEqual(resolutionOptions.value, ['1k', '2k', '4k'])
  setResolution('4k')
  assert.equal(currentRunPlan.value?.debug.normalizedParams.size, '2160x3840')

  setAspect('3:2')
  assert.equal(cpState.res, '1k')
  assert.deepEqual(resolutionOptions.value, ['1k'])
  assert.equal(currentRunPlan.value?.debug.normalizedParams.size, '1536x1024')
})

test('buildCurrentCreationParams keeps creation file objects so plan preview can materialize the same payload as submit', () => {
  switchTask('image')
  switchModel('gpt-image-2-超分')
  clearFiles()

  addFiles([makeFile('hero.png', 'image/png')])
  cpState.prompt = '一张电影海报'

  const params = buildCurrentCreationParams()

  assert.equal(Array.isArray(params.images), true)
  assert.equal((params.images as unknown[])[0] instanceof File, true)
  assert.equal((params.image as unknown[])[0] instanceof File, true)
  assert.equal((params.images as File[])[0]?.name, 'hero.png')

  clearFiles()
})

test('短式比例在面板里就补全成模型枚举，不会原样发给工作流', () => {
  switchTask('video')
  switchModel('jc-minimax-h3-ref2v')
  clearFiles()
  cpState.prompt = '镜头缓慢推进'

  // 记忆计划/画布给的是 '16:9' 这种界面标签；原样提交会被 ResolutionSelector 的
  // 「Value not in list」校验直接拒掉（2026-10-02 实测）
  setAspect('16:9')
  assert.equal(cpState.ar, '16:9 (Widescreen)')

  const params = buildCurrentCreationParams({ images: ['https://cdn.example.test/a.png'] })
  assert.equal(params.aspect_ratio, '16:9 (Widescreen)')

  // 已经是枚举值就原样保留
  setAspect('21:9 (Ultrawide)')
  assert.equal(cpState.ar, '21:9 (Ultrawide)')
})

test('buildCurrentCreationParams materializes current model field defaults into RunPlan params', () => {
  switchTask('image')
  switchModel('runninghub/api/z-image-turbo')
  clearFiles()

  cpState.prompt = '一张品牌海报'
  cpState.ar = '16:9'

  const params = buildCurrentCreationParams()

  assert.equal(params.outputFormat, 'png')
  assert.equal(params.lora_strength, 1)
})

test('buildCurrentCreationParams uses the selected server AI App contract', () => {
  switchTask('ai-app')
  switchModel('runninghub/aiapp/rh-aiapp')
  cpState.aiAppWebappId = '12345'
  cpState.aiAppLabel = '图片应用'
  cpState.aiAppOutputType = 'image'
  cpState.aiAppBillingModel = 'rh-custom-image'

  const params = buildCurrentCreationParams()

  assert.equal(params.webappId, '12345')
  assert.equal(params.outputType, 'image')
  assert.equal(params.billingModel, 'rh-custom-image')
  assert.equal(params.prompt, cpState.prompt)
})

test('Minimax H3 AI Apps use one prompt and map canvas images to workflow slots', () => {
  switchTask('ai-app')
  switchModel('runninghub/aiapp/rh-aiapp')
  cpState.aiAppWebappId = '2093662476146667522'
  cpState.aiAppLabel = 'Minimax-h3 多参3图'
  cpState.aiAppOutputType = 'video'
  cpState.aiAppBillingModel = 'rh-aiapp'
  cpState.prompt = '三个人一起大笑'
  cpState.aiAppFields = [
    { key: '137:image', label: 'image1', kind: 'image' },
    { key: '156:image', label: 'image2', kind: 'image' },
    { key: '157:image', label: 'image3', kind: 'image' },
    { key: '141:text', label: '提示词', kind: 'text', defaultValue: '旧提示词' },
    { key: '115:megapixels', label: '质量', kind: 'number', defaultValue: '0.4' },
    { key: '132:value', label: '时长', kind: 'number', defaultValue: '2' },
  ]

  const params = buildCurrentCreationParams({ images: ['left.png', 'middle.png', 'right.png'] })

  assert.equal(params.prompt, '三个人一起大笑')
  assert.equal(params['141:text'], '三个人一起大笑')
  assert.equal(params['137:image'], 'left.png')
  assert.equal(params['156:image'], 'middle.png')
  assert.equal(params['157:image'], 'right.png')
  // 质量控件已隐藏，固定提交 0.9；时长统一默认 5，不沿用工作流自带的 2
  assert.equal(params['115:megapixels'], 0.9)
  assert.equal(params['132:value'], 5)

  // 张数是上限不是等值：少传时按顺序只占用前面的槽位
  const partial = buildCurrentCreationParams({ images: ['only-one.png'] })
  assert.equal(partial['137:image'], 'only-one.png')
  assert.equal(partial['156:image'], 'None')
  assert.equal(partial['157:image'], 'None')

  assert.throws(
    () => buildCurrentCreationParams({ images: ['a.png', 'b.png', 'c.png', 'd.png'] }),
    /最多 3 张参考图/,
  )
})

test('Minimax H3 node 134 prompt is merged into the main creation prompt', () => {
  switchTask('ai-app')
  switchModel('runninghub/aiapp/rh-aiapp')
  cpState.aiAppWebappId = '2093571735550521345'
  cpState.aiAppLabel = 'Minimax-h3 首帧图生视频'
  cpState.aiAppOutputType = 'video'
  cpState.aiAppBillingModel = 'rh-aiapp'
  cpState.prompt = '镜头推近人物'
  cpState.aiAppFields = [
    { key: '134:text', label: '提示词', kind: 'text', defaultValue: '工作流默认提示词' },
    { key: '140:image', label: '首帧', kind: 'image' },
  ]

  const params = buildCurrentCreationParams({ images: ['first.png'] })

  assert.equal(params.prompt, '镜头推近人物')
  assert.equal(params['134:text'], '镜头推近人物')
  assert.equal(params['140:image'], 'first.png')
})

test('文武双修 应用用 28:prompt 承接主提示词，参考图按画布顺序取前 N 张', () => {
  switchTask('ai-app')
  switchModel('runninghub/aiapp/rh-aiapp')
  cpState.aiAppWebappId = '2101840271142117377'
  cpState.aiAppLabel = '文武双修'
  cpState.aiAppOutputType = 'video'
  cpState.aiAppBillingModel = 'rh-aiapp'
  cpState.prompt = '一个男人在雨里回头'
  cpState.aiAppFields = [
    { key: '28:prompt', label: 'prompt', kind: 'text', defaultValue: '作者示例提示词' },
    ...[6, 35, 36, 37, 38, 39, 40, 41, 42].map((nodeId, index) => ({
      key: `${nodeId}:image`,
      label: `image${index + 1}`,
      kind: 'image',
    })),
    { key: '29:aspect_ratio', label: '比例', kind: 'select', defaultValue: '16:9 (Widescreen)' },
    { key: '27:value', label: '时长', kind: 'number', defaultValue: '15' },
  ]

  const params = buildCurrentCreationParams({
    images: [1, 2, 3].map(index => `ref-${index}.png`),
  })

  assert.equal(params.prompt, '一个男人在雨里回头')
  assert.equal(params['28:prompt'], '一个男人在雨里回头')
  assert.equal(params['6:image'], 'ref-1.png')
  assert.equal(params['36:image'], 'ref-3.png')
  assert.equal(params['37:image'], 'None')
  assert.equal(params['29:aspect_ratio'], '16:9 (Widescreen)')
  assert.equal(params['27:value'], 5)
})

test('多参-4图 的时长节点描述是 value，仍按统一默认 5 提交', () => {
  switchTask('ai-app')
  switchModel('runninghub/aiapp/rh-aiapp')
  cpState.aiAppWebappId = '2093651661213491202'
  cpState.aiAppLabel = 'Minimax-h3 多参-4图'
  cpState.aiAppOutputType = 'video'
  cpState.aiAppBillingModel = 'rh-aiapp'
  cpState.prompt = '四个人一起转绘'
  cpState.aiAppFields = [
    ...[137, 156, 157, 158].map((nodeId, index) => ({
      key: `${nodeId}:image`,
      label: 'image',
      kind: 'image',
    })),
    { key: '141:text', label: 'text', kind: 'text', defaultValue: '旧提示词' },
    { key: '115:aspect_ratio', label: 'aspect_ratio', kind: 'select', defaultValue: '9:16 (Portrait Widescreen)' },
    { key: '115:megapixels', label: 'megapixels', kind: 'number', defaultValue: '0.4' },
    { key: '132:value', label: 'value', kind: 'number', defaultValue: '15' },
  ]

  const params = buildCurrentCreationParams({ images: ['a.png', 'b.png'] })

  assert.equal(params['141:text'], '四个人一起转绘')
  assert.equal(params['137:image'], 'a.png')
  assert.equal(params['156:image'], 'b.png')
  assert.equal(params['157:image'], 'None')
  assert.equal(params['115:megapixels'], 0.9)
  assert.equal(params['132:value'], 5)
})

test('AI App selected nodes override stale standard controls and clear saved H3 placeholders', () => {
  switchTask('ai-app')
  switchModel('runninghub/aiapp/rh-aiapp')
  cpState.aiAppWebappId = '2101840271142117377'
  cpState.aiAppOutputType = 'video'
  cpState.dur = 20
  cpState.ar = '1:1'
  cpState.aiAppFields = [
    { key: '27:value', label: '时长', kind: 'number', defaultValue: 20 },
    { key: '29:aspect_ratio', label: '比例', kind: 'select' },
    { key: '6:image', label: 'image1', kind: 'image', defaultValue: 'placeholder.png' },
    { key: '35:image', label: 'image2', kind: 'image', defaultValue: 'placeholder.png' },
    { key: '80:value', label: 'seed', kind: 'number', defaultValue: 123 },
  ]
  cpState.fieldValues = { '27:value': 3, '29:aspect_ratio': '9:16 (Portrait Widescreen)', '35:image': 'stored.png' }
  const params = buildCurrentCreationParams({ images: ['selected.png'] })
  assert.equal(params.duration, 3)
  assert.equal(params.aspect_ratio, '9:16')
  assert.equal(params['35:image'], 'None')
  assert.equal(params['80:value'], 123)

  cpState.aiAppWebappId = 'dynamic-app'
  cpState.aiAppFields = [{ key: '80:value', label: 'seed', kind: 'number', defaultValue: 123 },
    { key: '1:image', label: 'image', kind: 'image', defaultValue: 'placeholder.png' }]
  const dynamic = buildCurrentCreationParams({ images: [] })
  assert.equal(dynamic.duration, undefined)
  assert.equal(dynamic.aspect_ratio, undefined)
  assert.equal(dynamic['1:image'], undefined)
  cpState.aiAppFields = [
    { key: '8:duration', label: 'duration', kind: 'number', defaultValue: 4 },
    { key: '9:seconds', label: 'seconds', kind: 'number', defaultValue: 6 },
  ]
  const ambiguous = buildCurrentCreationParams({ images: [] })
  assert.equal(ambiguous.duration, undefined)
  assert.equal(ambiguous['8:duration'], 4)
  assert.equal(ambiguous['9:seconds'], 6)
  cpState.fieldValues = {}
})

test('Seed Audio rejects reference files larger than 10 MB', () => {
  switchTask('audio')
  switchModel('seed-audio-1.0')
  clearFiles()

  const oversized = makeFile('oversized.mp3', 'audio/mpeg')
  Object.defineProperty(oversized, 'size', { value: 10 * 1024 * 1024 + 1 })
  addFiles([oversized])

  assert.equal(cpState.files.length, 0)
  clearFiles()
})

test('Gemini Omni video edit derives billing seconds at submit time and never keeps stale duration', () => {
  switchTask('video')
  switchModel('runninghub/api/rh-gemini-omni-video-edit')
  clearFiles()
  cpState.dur = 5
  cpState.fieldValues.seconds = 99

  const params = buildCurrentCreationParams()

  assert.equal(params.duration, undefined)
  assert.equal(params.seconds, undefined)
  assert.equal(genericModelFields.value.some(field => field.key === 'seconds'), false)
  delete cpState.fieldValues.seconds
  clearFiles()
})

test('Gemini Omni media files reject references over 10 MB before submission', () => {
  switchTask('video')
  switchModel('runninghub/api/rh-gemini-omni-image-video')
  clearFiles()
  const oversized = makeFile('oversized.png', 'image/png')
  Object.defineProperty(oversized, 'size', { value: 10 * 1024 * 1024 + 1 })

  addFiles([oversized])

  assert.equal(cpState.files.length, 0)
  clearFiles()
})
