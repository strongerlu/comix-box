import assert from 'node:assert/strict'
import test from 'node:test'
import type { LocalComfyVideo } from '../localComfyVideo'

const profile: LocalComfyVideo = { id: 'local-comfy/user-test', name: '测试本地视频', minSeconds: 2, maxSeconds: 8,
  workflow: { '1': { class_type: 'TextEncode', inputs: { text: 'old' } }, '2': { class_type: 'Video', inputs: { seconds: 4, width: 864, height: 480, seed: 1, clip: ['1', 0] } } },
  bindings: { prompt: '1.text', duration: '2.seconds', width: '2.width', height: '2.height', seed: '2.seed' } }

const storageBeforeImport = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
const originalProfiles = JSON.stringify([profile, { ...profile, id: 'invalid' }])
let storedProfiles = originalProfiles
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: () => storedProfiles,
  setItem: (_key: string, value: string) => { storedProfiles = value },
} })
const { buildLocalComfyVideo, localComfyLoadError, localComfyVideos, saveLocalComfyVideo, validateLocalComfyVideo } = await import('../localComfyVideo')

test('failed startup load does not let a new save overwrite the original profiles', () => {
  try {
    assert.match(localComfyLoadError.value, /读取失败/)
    assert.throws(() => saveLocalComfyVideo({ ...profile, id: 'local-comfy/user-new' }), /读取失败/)
    assert.equal(storedProfiles, originalProfiles)
  } finally {
    localComfyLoadError.value = ''
    localComfyVideos.value = []
    if (storageBeforeImport) Object.defineProperty(globalThis, 'localStorage', storageBeforeImport)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  }
})

const { getCreationModelSpec, listCreationModels, listCreationPanelModels } = await import('../creationModelRegistry')
const { buildCreationRunPlan } = await import('../creationMediaPlan')

test('duration respects integer inputs and the explicit float primitive even with an integer default', () => {
  const params = { prompt: 'lake', width: 864, height: 480, seed: 1, duration: 4.5 }
  assert.throws(() => buildLocalComfyVideo(profile, params), /整数/)
  assert.equal(buildLocalComfyVideo(profile, { ...params, duration: 4 })['2'].inputs.seconds, 4)
  const float = structuredClone(profile)
  float.workflow['2'].inputs.seconds = 4.5
  assert.equal(buildLocalComfyVideo(float, params)['2'].inputs.seconds, 4.5)
  float.workflow['2'].inputs.seconds = 4
  float.workflow['2'].class_type = 'PrimitiveFloat'
  assert.equal(buildLocalComfyVideo(float, params)['2'].inputs.seconds, 4.5)
})

test('configured local videos enter the common selector and capture the actual workflow in the run plan', () => {
  localComfyVideos.value = [{ ...structuredClone(profile), name: '测试本地 · 精细版' }]
  assert.ok(listCreationModels({ task: 'video' }).some(p => p.id === profile.id))
  assert.equal(listCreationPanelModels({ task: 'video' }).find(p => p.id === profile.id)?.label, '测试本地 · 精细版')
  assert.equal(getCreationModelSpec(profile.id)?.route, 'local-comfy')
  const plan = buildCreationRunPlan({ modelId: profile.id, params: { prompt: 'lake', duration: 4, width: 1344, height: 768, seed: 42 } })
  assert.equal(plan.route, 'local-comfy')
  localComfyVideos.value = []
  assert.equal(plan.localWorkflow?.workflow['1'].inputs.text, 'old', 'plan remains usable after editing/removing settings')
})

test('binding changes the actual connected input and leaves the original workflow intact', () => {
  const output = buildLocalComfyVideo(profile, { prompt: 'new', duration: 6, width: 1344, height: 768, seed: 42 })
  assert.equal(output['1'].inputs.text, 'new')
  assert.equal(output['2'].inputs.width, 1344)
  assert.deepEqual(output['2'].inputs.clip, ['1', 0])
  assert.equal(profile.workflow['1'].inputs.text, 'old')
})

test('invalid graphs, missing inputs, duplicate bindings and undeclared durations fail before generation', () => {
  for (const change of [ { workflow: { nodes: [] } }, { bindings: { prompt: '9.text' } }, { bindings: { prompt: '1.text', duration: '1.text' } }, { bindings: { prompt: '1.text' } }, { minSeconds: 10 }, { workflow: { '1': { class_type: 'API', inputs: { text: 'x', api_key: 'private' } } } } ])
    assert.throws(() => validateLocalComfyVideo({ ...profile, ...change } as LocalComfyVideo))
  assert.throws(() => buildLocalComfyVideo(profile, { prompt: 'x', duration: 9 }))
  assert.throws(() => validateLocalComfyVideo({ ...profile, maxSeconds: 1e20 }))
  assert.throws(() => validateLocalComfyVideo({ ...profile, bindings: { prompt: '1.text', duration: '2.seconds', width: '2.clip', height: '2.height' } }), /类型/)
})

test('saving and editing retains model IDs and does not publish an update when storage fails', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  let saved = '', fail = false
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { setItem(_key: string, value: string) { if (fail) throw new Error('disk full'); saved = value } } })
  try {
    localComfyVideos.value = []
    saveLocalComfyVideo(profile)
    const first = getCreationModelSpec(profile.id)
    assert.ok(first)
    assert.equal(first.fields.find(field => field.key === 'duration')?.step, 1)
    assert.equal(getCreationModelSpec(profile.id), first)
    saveLocalComfyVideo({ ...profile, name: '改名' })
    assert.notEqual(getCreationModelSpec(profile.id), first)
    assert.equal(getCreationModelSpec(profile.id)?.label, '改名')
    assert.equal(localComfyVideos.value.length, 1)
    assert.equal(JSON.parse(saved)[0].name, '改名')
    fail = true
    assert.throws(() => saveLocalComfyVideo({ ...profile, name: '未保存' }), /disk full/)
    assert.equal(localComfyVideos.value[0].name, '改名')
  } finally {
    localComfyVideos.value = []
    if (original) Object.defineProperty(globalThis, 'localStorage', original)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  }
})
