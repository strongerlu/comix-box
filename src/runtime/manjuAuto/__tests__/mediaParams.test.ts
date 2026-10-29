import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildMediaParams, profileFromCapability, profileFromSpec } from '../mediaParams'

const spec = (keys: string[], extra: { duration?: { min?: number; max?: number; allowedValues?: number[] }; maxImages?: number } = {}) => profileFromSpec({
  fields: keys.map(key => ({ key, label: key, kind: 'text' })) as never,
  capabilities: { duration: extra.duration } as never,
  files: extra.maxImages === undefined ? undefined : { images: { max: extra.maxImages } },
})

test('uses the model-specific ratio field name', () => {
  assert.deepEqual(buildMediaParams(spec(['prompt', 'ratio']), { prompt: 'p', ratio: '9:16' }), { prompt: 'p', ratio: '9:16' })
  assert.deepEqual(buildMediaParams(spec(['prompt', 'aspect_ratio']), { prompt: 'p', ratio: '9:16' }), { prompt: 'p', aspect_ratio: '9:16' })
})

test('rounds duration up to the nearest allowed value and rejects overlong segments', () => {
  const fixed = spec(['ratio'], { duration: { allowedValues: [5, 10, 15, 30] } })
  assert.equal(buildMediaParams(fixed, { prompt: 'p', ratio: '9:16', durationSeconds: 13 }).duration, 15)
  assert.throws(() => buildMediaParams(spec(['ratio'], { duration: { allowedValues: [15] } }), { prompt: 'p', ratio: '9:16', durationSeconds: 28 }), /最长 15/)
  assert.equal(buildMediaParams(spec(['ratio'], { duration: { min: 4, max: 30 } }), { prompt: 'p', ratio: '9:16', durationSeconds: 3 }).duration, 4)
  assert.throws(() => buildMediaParams(spec(['ratio'], { duration: { min: 4, max: 15 } }), { prompt: 'p', ratio: '9:16', durationSeconds: 20 }), /最长 15/)
})

test('passes reference images in order and rejects counts above the model limit', () => {
  assert.deepEqual(buildMediaParams(spec(['ratio'], { maxImages: 2 }), { prompt: 'p', ratio: '9:16', images: ['/a.png', '/b.png'] }).images, ['/a.png', '/b.png'])
  assert.throws(() => buildMediaParams(spec(['ratio'], { maxImages: 1 }), { prompt: 'p', ratio: '9:16', images: ['/a.png', '/b.png'] }), /上限 1/)
})

test('remote capability profile uses its schema keys, image slot name, duration enum and slot limit', () => {
  const profile = profileFromCapability({
    parameter_schema: { properties: { prompt: {}, ratio: {}, duration: { enum: [5, 10, 15] } } },
    asset_slots: [{ name: 'reference_images', modalities: ['image'], max: 4 }],
  })
  assert.deepEqual(buildMediaParams(profile, { prompt: 'p', ratio: '9:16', images: ['/a.png'], durationSeconds: 7 }),
    { prompt: 'p', ratio: '9:16', reference_images: ['/a.png'], duration: 10 })
  assert.throws(() => buildMediaParams(profile, { prompt: 'p', ratio: '9:16', images: ['1', '2', '3', '4', '5'] }), /上限 4/)
})

test('sends the chosen resolution only to models that declare a resolution field', () => {
  assert.equal(buildMediaParams(spec(['ratio', 'resolution']), { prompt: 'p', ratio: '9:16', resolution: '480P' }).resolution, '480P')
  assert.equal(buildMediaParams(spec(['ratio']), { prompt: 'p', ratio: '9:16', resolution: '480P' }).resolution, undefined)
})

test('dynamic profiles separate first-frame and reference slots and keep declared scalar names and enums', () => {
  const profile = profileFromCapability({
    parameter_schema: { properties: { prompt: {}, duration_seconds: { minimum: 2, maximum: 12 }, aspect_ratio: { enum: ['16:9'] }, resolution: { enum: ['720p'] } } },
    asset_slots: [{ name: 'first_frame', modalities: ['image'], max: 1 }, { name: 'reference_images', modalities: ['image'], max: 3 }],
  })
  assert.deepEqual(buildMediaParams(profile, { prompt: 'p', ratio: '16:9', resolution: '720p', durationSeconds: 8, images: ['ref'], firstFrame: 'tail.png' }),
    { prompt: 'p', aspect_ratio: '16:9', resolution: '720p', duration_seconds: 8, reference_images: ['ref'], first_frame: ['tail.png'] })
  assert.throws(() => buildMediaParams(profile, { prompt: 'p', ratio: '9:16' }), /比例/)
  assert.throws(() => buildMediaParams(profile, { prompt: 'p', ratio: '16:9', resolution: '4k' }), /分辨率/)
})

test('undeclared frame support fails before submission and frame-only modes cannot silently discard identity refs', () => {
  assert.throws(() => buildMediaParams(spec(['ratio']), { prompt: 'p', ratio: '16:9', firstFrame: 'tail.png' }), /首帧/)
  const profile = profileFromSpec({ fields: [{ key: 'images', kind: 'images' }, { key: 'image_mode', options: [{ value: 'first_frame', label: '首帧' }] }] as never, capabilities: {} as never, apiStyle: 'openai-video' })
  assert.throws(() => buildMediaParams(profile, { prompt: 'p', ratio: '16:9', images: ['identity'], firstFrame: 'tail.png' }), /参考图.*首帧/)
  assert.deepEqual(buildMediaParams(profile, { prompt: 'p', ratio: '16:9', firstFrame: 'tail.png' }), { prompt: 'p', images: ['tail.png'], image_mode: 'first_frame' })
})

test('unknown or invalid duration metadata cannot be presented as a thirty-second service contract', () => {
  for (const duration of [{}, { maximum: -2 }, { enum: [true, '', null] }, { minimum: 12, maximum: 3 }]) {
    const profile = profileFromCapability({ parameter_schema: { properties: { prompt: {}, duration } }, asset_slots: [] })
    assert.equal(profile.duration, undefined)
    assert.throws(() => buildMediaParams(profile, { prompt: 'p', ratio: '16:9', durationSeconds: 8 }), /未声明.*时长/)
  }
})


test('local workflow ratio enums map canonical ratios and size-only first frames select exact aspect sizes', () => {
  const profile = profileFromSpec({ fields: [{key:'ratio',options:[{value:'16:9 (Widescreen)',label:'横屏 16:9'}]}], capabilities:{ratios:['16:9 (Widescreen)']}} as never)
  assert.equal(buildMediaParams(profile,{prompt:'p',ratio:'16:9'}).ratio,'16:9 (Widescreen)')
  const frame = profileFromSpec({apiStyle:'comfy-first-frame',fields:[{key:'images'},{key:'size',options:[{value:'1344x768',label:'默认'},{value:'1024x576',label:'16:9'},{value:'576x1024',label:'9:16'}]}],capabilities:{duration:{max:28}}} as never)
  assert.equal(buildMediaParams(frame,{prompt:'p',ratio:'9:16',firstFrame:'tail'}).size,'576x1024')
  assert.throws(()=>buildMediaParams(frame,{prompt:'p',ratio:'21:9',firstFrame:'tail'}),/比例|画幅/)
})
