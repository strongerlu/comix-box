import { rewriteCheckpointPrompt, textHash } from '../checkpointPreflight'
import { continuationPrompt } from '../videoScheduler'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { awaitSegment, checkEpisodeVideos, regenerateSegment, retryFailedVideos, submitEpisodeVideos, videoRegistryPath, listSegmentVersions, restoreSegmentVersion, rememberSegmentVersion, registerProcessedVersion, saveSegmentReview, type VideoCheckpoint, type VideoSchedulerDeps } from '../videoScheduler'

type FakeTask = { status: string; localPath?: string; error?: string; submissionUncertain?: boolean }

function fakeDeps(files: Record<string, string>) {
  const fs = new Map(Object.entries(files))
  const tasks = new Map<string, FakeTask>()
  const submits: Array<{ requestId: string; prompt: string; images: string[]; durationSeconds: number; firstFrame?: string }> = []
  const deps: VideoSchedulerDeps = {
    async readText(path) {
      const text = fs.get(path)
      if (text === undefined) throw new Error(`missing ${path}`)
      return text
    },
    async writeText(path, content) { fs.set(path, content) },
    async exists(path) { return fs.has(path) },
    async submitVideo(input) {
      submits.push(input)
      const id = `v${submits.length}`
      tasks.set(id, { status: 'pending' })
      return id
    },
    async getTask(taskId) { return tasks.get(taskId) },
  }
  return { deps, fs, tasks, submits }
}

const wiki = 'wiki'
const seg1 = 'wiki/剧本/视频提示词/Seedance/第1集001视频提示词.md'
const seg2 = 'wiki/剧本/视频提示词/Seedance/第1集002视频提示词.md'
const prompts = {
  [seg1]: '# 第1集001视频提示词\n石道追问。\n@图1：石道\n@图2：莫甘娜',
  [seg2]: '书房对峙。\n@图1：莫甘娜',
}
const checkpoint: VideoCheckpoint = {
  episode_number: 1,
  video_model: 'Seedance',
  segments: [
    { path: seg1, start_seconds: 0, end_seconds: 27.5, refs: ['场景/石道', '角色/莫甘娜'] },
    { path: seg2, start_seconds: 27.5, end_seconds: 40, refs: ['角色/莫甘娜'] },
  ],
}
const images = { '角色/莫甘娜': '/p/莫甘娜.png', '场景/石道': '/p/石道.png' }
const registry = (fs: Map<string, string>) => JSON.parse(fs.get(`${wiki}/${videoRegistryPath('Seedance', 1)}`)!).segments

test('planned cuts and scene changes keep ordinary inputs despite a configured continuation model', async () => {
  for (const type of ['cut', 'scene_change'] as const) {
    const w = fakeDeps(prompts)
    w.deps.continuation = { modelId: 'frame', exclusive: true, checkVideo() { throw new Error('不应检查首帧') }, submitVideo: w.deps.submitVideo }
    const plan = structuredClone(checkpoint)
    Object.assign(plan.segments[1], { transition: { type, reason: '切换观察视角或时空' } })
    await submitEpisodeVideos(wiki, plan, images, w.deps)
    assert.equal(w.submits.length, 2)
    assert.equal(w.submits[1].firstFrame, undefined)
    assert.deepEqual(w.submits[1].images, ['/p/莫甘娜.png'])
  }
})

test('invalid transitions fail before any submission', async () => {
  for (const transition of [{ type: 'unknown', reason: 'x' }, { type: 'continue', reason: '' }]) {
    const w = fakeDeps(prompts), plan = structuredClone(checkpoint)
    Object.assign(plan.segments[1], { transition })
    await assert.rejects(submitEpisodeVideos(wiki, plan, images, w.deps), /接续|镜头关系/)
    assert.equal(w.submits.length, 0)
  }
})

test('exclusive frame prompts preserve entity distinctions and voice details without inventing image slots', () => {
  const seedance = continuationPrompt('@图1：甲，低沉声音\n@图2：乙，清亮声音\n@图1走向@图2。')
  assert.match(seedance, /主体1：甲，低沉声音/)
  assert.match(seedance, /主体2：乙，清亮声音/)
  assert.match(seedance, /主体1走向主体2/)
  assert.doesNotMatch(seedance, /@图|<Picture/)
  const h3 = continuationPrompt('subject_definitions:\n<Picture 1> is Alice, soft voice.\nsummary:\nAlice turns.\nretention_analysis:\nKeep the blue coat.\ndetailed_description:\nShot 1 Alice speaks.\noverall_soundscape:\nAlice: "Hello"\nnon_diegetic_music:\nNone.')
  assert.match(h3, /integrated_multimodal_description:/)
  assert.match(h3, /soft voice|blue coat/)
  assert.match(h3, /Alice: "Hello"/)
  assert.doesNotMatch(h3, /subject_definitions:|retention_analysis:|<Picture/)
})

test('unprovided video and audio references and mixed image syntaxes fail before submitting', async () => {
  for (const suffix of ['<Video 1>', '<Audio 1>', '@视频1', '@音频1', '<Picture 1>']) {
    const w = fakeDeps({ ...prompts, [seg2]: prompts[seg2] + '\n' + suffix })
    await assert.rejects(submitEpisodeVideos(wiki, checkpoint, images, w.deps), /素材|参考图|输入/)
    assert.equal(w.submits.length, 0)
  }
})

test('a prompt edited after preflight cannot be submitted under the old fingerprint', async () => {
  const w = fakeDeps(prompts), read = w.deps.readText
  let reads = 0
  w.deps.readText = async path => {
    const text = await read(path)
    return path === seg1 && ++reads > 1 ? text + '\n镜头已修改' : text
  }
  await assert.rejects(submitEpisodeVideos(wiki, checkpoint, images, w.deps), /提交前.*改变/)
  assert.equal(w.submits.length, 0)
})

test('the first segment cannot continue a nonexistent predecessor, while ordinary mode can render a planned continuation', async () => {
  const w = fakeDeps(prompts), plan = structuredClone(checkpoint)
  Object.assign(plan.segments[0], { transition: { type: 'continue', reason: '无前段' } })
  await assert.rejects(submitEpisodeVideos(wiki, plan, images, w.deps), /首段/)
  delete plan.segments[0].transition
  plan.segments[1].transition = { type: 'continue', reason: '同一镜头动作，未选首帧则独立描述初态' }
  await submitEpisodeVideos(wiki, plan, images, w.deps)
  assert.equal(w.submits.length, 2)
  assert.equal(w.submits[1].firstFrame, undefined)
})

test('versions survive restart and restore prompt plus selected video without another submission', async () => {
  const { deps, fs, tasks, submits } = fakeDeps(prompts)
  await submitEpisodeVideos(wiki, checkpoint, images, deps)
  tasks.set('v1', { status: 'success', localPath: '/out/one.mp4' })
  tasks.set('v2', { status: 'success', localPath: '/out/two.mp4' })
  fs.set('/out/one.mp4', 'video'); fs.set('/out/two.mp4', 'video')
  const before = await checkEpisodeVideos(wiki, checkpoint, deps)
  await rememberSegmentVersion(wiki, checkpoint, 0, deps)
  fs.set(seg1, prompts[seg1] + '\n新构图')
  await regenerateSegment(wiki, checkpoint, 0, deps)
  tasks.set('v3', { status: 'success', localPath: '/out/three.mp4' }); fs.set('/out/three.mp4', 'video')
  const revised = await checkEpisodeVideos(wiki, checkpoint, deps)
  const versions = await listSegmentVersions(wiki, checkpoint, 0, deps)
  assert.equal(versions.length, 2)
  const original = versions.find(version => version.video_path === '/out/one.mp4')!
  assert.notEqual(before.reviewKey, revised.reviewKey)
  const count = submits.length
  await restoreSegmentVersion(wiki, checkpoint, 0, original.id, deps)
  assert.equal(fs.get(seg1), prompts[seg1])
  assert.equal(submits.length, count)
  assert.deepEqual((await checkEpisodeVideos(wiki, checkpoint, deps)).videos, ['/out/one.mp4', '/out/two.mp4'])
  assert.equal((await listSegmentVersions(wiki, checkpoint, 0, deps)).length, 2)
  fs.delete('/out/three.mp4')
  await assert.rejects(restoreSegmentVersion(wiki, checkpoint, 0, versions.find(version => version.video_path === '/out/three.mp4')!.id, deps), /文件/)
})

test('explicit tail binding preserves reference order and prevents stale upstream frame reuse', async () => {
  const { deps, fs, tasks, submits } = fakeDeps(prompts)
  let extractions = 0
  deps.canUseFirstFrame = () => true
  deps.extractTailFrame = async (video, end) => { assert.equal(video, '/out/one.mp4'); assert.equal(end, 27.5); extractions++; return '/out/tail.png' }
  await submitEpisodeVideos(wiki, checkpoint, images, deps)
  tasks.set('v1', { status: 'success', localPath: '/out/one.mp4' })
  tasks.set('v2', { status: 'success', localPath: '/out/two.mp4' })
  await checkEpisodeVideos(wiki, checkpoint, deps)
  await regenerateSegment(wiki, checkpoint, 1, deps, { previousTail: true })
  assert.equal(extractions, 1)
  assert.equal(submits.at(-1)!.firstFrame, '/out/tail.png')
  assert.deepEqual(submits.at(-1)!.images, ['/p/莫甘娜.png'])
  tasks.set('v3', { status: 'success', localPath: '/out/anchored.mp4' })
  await checkEpisodeVideos(wiki, checkpoint, deps)
  const saved = JSON.parse(fs.get(`${wiki}/${videoRegistryPath('Seedance', 1)}`)!)
  saved.segments[0].task_id = 'another'
  fs.set(`${wiki}/${videoRegistryPath('Seedance', 1)}`, JSON.stringify(saved))
  const count = submits.length
  assert.equal((await checkEpisodeVideos(wiki, checkpoint, deps)).status, 'failed')
  assert.equal(submits.length, count, 'stale anchor never causes an automatic paid regeneration')
})

test('local corrections are reversible versions, persist categorized notes and never call a generation endpoint', async () => {
  const { deps, fs, tasks, submits } = fakeDeps(prompts)
  await submitEpisodeVideos(wiki, checkpoint, images, deps)
  tasks.set('v1', { status: 'success', localPath: '/out/original.mp4' }); fs.set('/out/original.mp4', 'video')
  tasks.set('v2', { status: 'success', localPath: '/out/two.mp4' })
  const before = await checkEpisodeVideos(wiki, checkpoint, deps)
  const count = submits.length
  await saveSegmentReview(wiki, checkpoint, 0, { category: 'color', notes: '整体亮度偏高' }, deps)
  assert.equal(registry(fs)[0].review.category, 'color')
  await assert.rejects(registerProcessedVersion(wiki, checkpoint, 0, '/missing.mp4', deps), /文件/)
  fs.set('/out/adjusted.mp4', 'video')
  await registerProcessedVersion(wiki, checkpoint, 0, '/out/adjusted.mp4', deps)
  const changed = await checkEpisodeVideos(wiki, checkpoint, deps)
  assert.notEqual(changed.reviewKey, before.reviewKey)
  assert.equal(changed.videos[0], '/out/adjusted.mp4')
  assert.equal(submits.length, count)
  const versions = await listSegmentVersions(wiki, checkpoint, 0, deps)
  assert.equal(versions.length, 2)
  assert.equal(versions.find(version => version.current)?.origin, 'postprocess')
  await restoreSegmentVersion(wiki, checkpoint, 0, versions.find(version => version.video_path === '/out/original.mp4')!.id, deps)
  assert.equal((await checkEpisodeVideos(wiki, checkpoint, deps)).videos[0], '/out/original.mp4')
  assert.equal(submits.length, count)
  await saveSegmentReview(wiki, checkpoint, 0, { category: 'sound', notes: '新记录' }, deps)
  assert.equal((await listSegmentVersions(wiki, checkpoint, 0, deps)).find(version => version.current)?.review?.notes, '新记录')
})

test('unsupported binding, missing predecessor and changed version input contract are blocked before spending', async () => {
  const { deps, fs, tasks, submits } = fakeDeps(prompts)
  await submitEpisodeVideos(wiki, checkpoint, images, deps)
  const count = submits.length
  await assert.rejects(regenerateSegment(wiki, checkpoint, 1, deps, { previousTail: true }), /不支持/)
  deps.canUseFirstFrame = () => true; deps.extractTailFrame = async () => '/tail.png'
  await assert.rejects(regenerateSegment(wiki, checkpoint, 1, deps, { previousTail: true }), /未就绪/)
  assert.equal(submits.length, count)
  tasks.set('v1', { status: 'success', localPath: '/out/original.mp4' }); fs.set('/out/original.mp4', 'video')
  await checkEpisodeVideos(wiki, checkpoint, deps)
  await rememberSegmentVersion(wiki, checkpoint, 0, deps)
  const original = (await listSegmentVersions(wiki, checkpoint, 0, deps))[0]
  const changed = structuredClone(checkpoint); changed.segments[0].end_seconds -= 1
  await assert.rejects(restoreSegmentVersion(wiki, changed, 0, original.id, deps), /时长或参考/)
})

test('failed video review preserves segment positions and successful results without automatic resubmission', async () => {
  const { deps, tasks, submits } = fakeDeps(prompts)
  await submitEpisodeVideos(wiki, checkpoint, images, deps)
  tasks.set('v1', { status: 'failed', submissionUncertain: true })
  tasks.set('v2', { status: 'success', localPath: '/out/second.mp4' })
  const result = await checkEpisodeVideos(wiki, checkpoint, deps)
  assert.equal(result.status, 'failed')
  assert.deepEqual(result.videos, ['', '/out/second.mp4'])
  assert.equal(submits.length, 2)
})

test('submits every segment with reference images in @图 order and rounded-up duration, without waiting', async () => {
  const { deps, fs, submits } = fakeDeps(prompts)
  await submitEpisodeVideos(wiki, checkpoint, images, deps)
  assert.equal(submits.length, 2)
  assert.deepEqual(submits[0].images, ['/p/石道.png', '/p/莫甘娜.png'])
  assert.equal(submits[0].prompt, '石道追问。\n@图1：石道\n@图2：莫甘娜')
  assert.equal(submits[0].durationSeconds, 28)
  assert.equal(submits[1].durationSeconds, 13)
  assert.deepEqual(registry(fs).map((s: { status: string }) => s.status), ['pending', 'pending'])
})

test('refuses to submit when a referenced image is missing', async () => {
  const { deps, submits } = fakeDeps(prompts)
  await assert.rejects(submitEpisodeVideos(wiki, checkpoint, { '角色/莫甘娜': '/p/a.png' }, deps), /场景\/石道/)
  assert.equal(submits.length, 0)
})

test('persisted video registry prevents re-submission after restart; changed image resubmits only that segment', async () => {
  const { deps, fs, submits } = fakeDeps(prompts)
  await submitEpisodeVideos(wiki, checkpoint, images, deps)
  const restarted = fakeDeps(Object.fromEntries(fs))
  await submitEpisodeVideos(wiki, checkpoint, images, restarted.deps)
  assert.equal(restarted.submits.length, 0)
  await submitEpisodeVideos(wiki, checkpoint, { ...images, '场景/石道': '/p/石道v2.png' }, restarted.deps)
  assert.equal(restarted.submits.length, 1)
  assert.deepEqual(restarted.submits[0].images, ['/p/石道v2.png', '/p/莫甘娜.png'])
  assert.equal(submits.length, 2)
})

test('single check pass: ready, still pending, one retry for failures, no retry for moderation', async () => {
  const { deps, fs, tasks, submits } = fakeDeps(prompts)
  await submitEpisodeVideos(wiki, checkpoint, images, deps)
  tasks.set('v1', { status: 'success', localPath: '/p/1.mp4' })
  tasks.set('v2', { status: 'failed', error: 'HTTP 500' })
  const first = await checkEpisodeVideos(wiki, checkpoint, deps)
  assert.equal(first.status, 'pending')
  assert.equal(submits.length, 3, '第二段重提一次')
  tasks.set('v3', { status: 'failed', error: 'HTTP 500' })
  const second = await checkEpisodeVideos(wiki, checkpoint, deps)
  assert.equal(second.status, 'failed')
  assert.deepEqual(second.failed, [2])
  assert.equal(submits.length, 3, '视频只重试 1 次')
  assert.equal(registry(fs)[1].attempts, 2)

  const other = fakeDeps(prompts)
  await submitEpisodeVideos(wiki, checkpoint, images, other.deps)
  other.tasks.set('v1', { status: 'success', localPath: '/p/1.mp4' })
  other.tasks.set('v2', { status: 'failed', error: '视频内容审核不通过' })
  const moderated = await checkEpisodeVideos(wiki, checkpoint, other.deps)
  assert.equal(moderated.status, 'failed')
  assert.equal(other.submits.length, 2)
})

test('ready episode returns local videos in segment order', async () => {
  const { deps, tasks } = fakeDeps(prompts)
  await submitEpisodeVideos(wiki, checkpoint, images, deps)
  tasks.set('v2', { status: 'success', localPath: '/p/2.mp4' })
  tasks.set('v1', { status: 'success' })
  assert.equal((await checkEpisodeVideos(wiki, checkpoint, deps)).status, 'pending', '文件未落盘不算完成')
  tasks.set('v1', { status: 'success', localPath: '/p/1.mp4' })
  const done = await checkEpisodeVideos(wiki, checkpoint, deps)
  assert.equal(done.status, 'ready')
  assert.deepEqual(done.videos, ['/p/1.mp4', '/p/2.mp4'])
})

test('model constraint failure on any segment blocks the whole episode before spending', async () => {
  const { deps, submits } = fakeDeps(prompts)
  deps.checkVideo = input => { if (input.durationSeconds > 15) throw new Error('片段 28 秒超过该模型最长 15 秒') }
  await assert.rejects(submitEpisodeVideos(wiki, checkpoint, images, deps), /最长 15/)
  assert.equal(submits.length, 0)
})

test('rate-limited video failures resubmit at the next check without using the single retry', async () => {
  const { deps, fs, tasks, submits } = fakeDeps(prompts)
  await submitEpisodeVideos(wiki, checkpoint, images, deps)
  tasks.set('v1', { status: 'success', localPath: '/p/1.mp4' })
  tasks.set('v2', { status: 'failed', error: '请求过于频繁，请稍后再试' })
  await checkEpisodeVideos(wiki, checkpoint, deps)
  tasks.set('v3', { status: 'failed', error: '请求过于频繁' })
  const second = await checkEpisodeVideos(wiki, checkpoint, deps)
  assert.equal(second.status, 'pending')
  assert.equal(registry(fs)[1].attempts, 1)
  const ids = submits.map(item => item.requestId)
  assert.equal(new Set(ids).size, ids.length)
})

test('interrupted video tasks block without a second paid submission', async () => {
  const { deps, fs, tasks, submits } = fakeDeps(prompts)
  await submitEpisodeVideos(wiki, checkpoint, images, deps)
  tasks.set('v1', { status: 'interrupted' })
  tasks.set('v2', { status: 'interrupted' })
  const result = await checkEpisodeVideos(wiki, checkpoint, deps)
  assert.equal(result.status, 'failed')
  assert.equal(submits.length, 2)
  assert.deepEqual(registry(fs).map((s: { status: string }) => s.status), ['uncertain', 'uncertain'])
  assert.deepEqual(await retryFailedVideos(wiki, checkpoint, deps), [])
  await submitEpisodeVideos(wiki, checkpoint, images, deps)
  assert.equal(submits.length, 2)
})

test('a later run gives finally-failed video segments a fresh retry with their registered images', async () => {
  const { deps, fs, tasks, submits } = fakeDeps(prompts)
  await submitEpisodeVideos(wiki, checkpoint, images, deps)
  tasks.set('v1', { status: 'success', localPath: '/p/1.mp4' })
  tasks.set('v2', { status: 'failed', error: 'HTTP 500 上游异常' })
  await checkEpisodeVideos(wiki, checkpoint, deps)
  tasks.set('v3', { status: 'failed', error: 'HTTP 500 上游异常' })
  assert.equal((await checkEpisodeVideos(wiki, checkpoint, deps)).status, 'failed')
  const before = submits.length
  assert.deepEqual(await retryFailedVideos(wiki, checkpoint, deps), [2])
  assert.equal(submits.length, before + 1)
  assert.deepEqual(submits.at(-1)!.images, ['/p/莫甘娜.png'])
  assert.equal(registry(fs)[1].status, 'pending')
  assert.equal(registry(fs)[1].attempts, 1)
  const ids = submits.map(item => item.requestId)
  assert.equal(new Set(ids).size, ids.length)
})

test('network hiccups resubmit without using the single retry, up to a cap', async () => {
  const { deps, fs, tasks, submits } = fakeDeps(prompts)
  await submitEpisodeVideos(wiki, checkpoint, images, deps)
  tasks.set('v1', { status: 'success', localPath: '/p/1.mp4' })
  for (let round = 0; round < 7; round += 1) {
    const last = `v${submits.length}`
    tasks.set(last === 'v1' ? 'v2' : last, { status: 'failed', error: 'HTTP 请求失败: error sending request' })
    await checkEpisodeVideos(wiki, checkpoint, deps)
  }
  const entry = registry(fs)[1]
  assert.equal(entry.transient, 5, '网络重提最多 5 次')
  assert.equal(entry.status, 'failed', '超过上限后按普通失败处理（再重试 1 次后失败）')
})

test('segments are submitted one at a time: each waits until the previous upload has been handed to the model', async () => {
  const { deps } = fakeDeps(prompts)
  const events: string[] = []
  const original = deps.submitVideo
  deps.submitVideo = async input => { const id = await original(input); events.push(`submit:${id}`); return id }
  deps.waitSubmitted = async taskId => { events.push(`wait:${taskId}`) }
  await submitEpisodeVideos(wiki, checkpoint, images, deps)
  assert.deepEqual(events, ['submit:v1', 'wait:v1', 'submit:v2', 'wait:v2'])
})

test('stop between segment submissions: submitted segments stay registered, the rest are submitted on resume', async () => {
  const { deps, fs, submits } = fakeDeps(prompts)
  let stop = false
  deps.waitSubmitted = async () => { stop = true }
  assert.equal(await submitEpisodeVideos(wiki, checkpoint, images, deps, () => stop), false)
  assert.equal(submits.length, 1)
  assert.equal(registry(fs).length, 1)
  stop = false
  deps.waitSubmitted = undefined
  assert.equal(await submitEpisodeVideos(wiki, checkpoint, images, deps, () => stop), true)
  assert.equal(submits.length, 2, '续做只补交第 2 段')
})

test('regenerating one segment during video review resubmits only that segment with its current prompt', async () => {
  const { deps, fs, tasks, submits } = fakeDeps(prompts)
  await submitEpisodeVideos(wiki, checkpoint, images, deps)
  tasks.set('v1', { status: 'success', localPath: '/out/a.mp4' })
  tasks.set('v2', { status: 'success', localPath: '/out/b.mp4' })
  await checkEpisodeVideos(wiki, checkpoint, deps)
  fs.set(seg2, '# 第1集002视频提示词\n书房对峙，改成雨夜。\n@图1：莫甘娜')
  await regenerateSegment(wiki, checkpoint, 1, deps)
  assert.equal(submits.length, 3)
  assert.equal(submits[2].prompt, '书房对峙，改成雨夜。\n@图1：莫甘娜')
  assert.deepEqual(submits[2].images, ['/p/莫甘娜.png'])
  assert.notEqual(submits[2].requestId, submits[1].requestId)
  tasks.set('v3', { status: 'success', localPath: '/out/b2.mp4' })
  assert.equal(await awaitSegment(wiki, checkpoint, 1, deps, { sleep: async () => {}, timeoutMs: 1000 }), '/out/b2.mp4')
  assert.deepEqual(registry(fs).map((s: { video_path: string }) => s.video_path), ['/out/a.mp4', '/out/b2.mp4'])
  // 提示词指纹随之更新：之后的整集提交不会把这段再交一次
  await submitEpisodeVideos(wiki, checkpoint, images, deps)
  assert.equal(submits.length, 3)
})


test('video response loss is recoverable by the saved requestId with no duplicate POST', async () => {
  const { deps, fs, tasks, submits } = fakeDeps(prompts)
  const original = deps.submitVideo
  deps.submitVideo = async input => {
    assert.equal(registry(fs)[0].request_id, input.requestId)
    await original(input)
    throw Error('response lost')
  }
  await assert.rejects(submitEpisodeVideos(wiki, checkpoint, images, deps), /response lost/)
  deps.findTask = async requestId => submits[0]?.requestId === requestId ? 'v1' : undefined
  tasks.set('v1', { status: 'success', localPath: '/p/first.mp4' })
  const result = await checkEpisodeVideos(wiki, checkpoint, deps)
  assert.equal(registry(fs)[0].task_id, 'v1')
  assert.equal(registry(fs)[0].status, 'ready')
  assert.equal(submits.length, 1)
  assert.equal(result.status, 'ready')
})


test('preflight rejects gaps and reference-order mismatches before any paid video request', async () => {
  const gap = fakeDeps(prompts)
  const broken = { ...checkpoint, segments: checkpoint.segments.map((s, i) => i === 1 ? { ...s, start_seconds: 29 } : s) }
  await assert.rejects(submitEpisodeVideos(wiki, broken, images, gap.deps), /连续|覆盖/)
  assert.equal(gap.submits.length, 0)
  const refs = fakeDeps({ ...prompts, [seg1]: '石道。\n@图1：莫甘娜\n@图2：石道' })
  await assert.rejects(submitEpisodeVideos(wiki, checkpoint, images, refs.deps), /参考图|顺序/)
  assert.equal(refs.submits.length, 0)
})

test('all segments are checked for empty prompts and duplicate paths before any submission', async () => {
  const empty = fakeDeps({ ...prompts, [seg2]: '# Prompt\n   ' })
  const plan = { ...checkpoint, segments: [checkpoint.segments[0], { ...checkpoint.segments[1], refs: [] }] }
  await assert.rejects(submitEpisodeVideos(wiki, plan, images, empty.deps), /第2段.*为空/)
  assert.equal(empty.submits.length, 0)
  assert.equal(empty.fs.has(`${wiki}/${videoRegistryPath('Seedance', 1)}`), false)

  const duplicate = fakeDeps(prompts)
  const repeated = { ...checkpoint, segments: [checkpoint.segments[0], { ...checkpoint.segments[1], path: seg1, refs: checkpoint.segments[0].refs }] }
  await assert.rejects(submitEpisodeVideos(wiki, repeated, images, duplicate.deps), /第2段.*重复/)
  assert.equal(duplicate.submits.length, 0)
})

test('reference validation rejects duplicated assets and undeclared body references in both formats', async () => {
  const duplicate = fakeDeps({ [seg1]: '人物移动。\n@图1：莫甘娜\n@图2：莫甘娜' })
  const plan = { ...checkpoint, segments: [{ ...checkpoint.segments[0], refs: ['角色/莫甘娜', '角色/莫甘娜'] }] }
  await assert.rejects(submitEpisodeVideos(wiki, plan, images, duplicate.deps), /参考.*重复/)
  assert.equal(duplicate.submits.length, 0)
  for (const model of ['Seedance', 'H3']) {
    const text = model === 'H3'
      ? 'subject_definitions:\n<Picture 1> 莫甘娜\nsummary:\n<Picture 2> moves.'
      : '@图1：莫甘娜\n镜头中@图2移动。'
    const invalid = fakeDeps({ [seg1]: text })
    await assert.rejects(submitEpisodeVideos(wiki, { ...plan, video_model: model, segments: [{ ...plan.segments[0], refs: ['角色/莫甘娜'] }] }, images, invalid.deps), /未登记|未定义/)
    assert.equal(invalid.submits.length, 0)
  }
})

test('changed registered upstream artifacts block video submission before any POST', async () => {
  const { deps, submits } = fakeDeps({ ...prompts, 'wiki/工程稿.md': 'changed' })
  await assert.rejects(submitEpisodeVideos(wiki, { ...checkpoint, files: { engineering: { 'wiki/工程稿.md': '0'.repeat(64) } } }, images, deps), /已修改|校验/)
  assert.equal(submits.length, 0)
})

test('late recovery of an uncertain video reuses its original result without a new POST', async () => {
  const { deps, fs, tasks, submits } = fakeDeps(prompts)
  await submitEpisodeVideos(wiki, checkpoint, images, deps)
  tasks.set('v1', { status: 'failed', submissionUncertain: true })
  tasks.set('v2', { status: 'success', localPath: '/out/second.mp4' })
  await checkEpisodeVideos(wiki, checkpoint, deps)
  assert.equal(registry(fs)[0].status, 'uncertain')
  tasks.set('v1', { status: 'success', localPath: '/out/recovered.mp4' })
  assert.equal((await checkEpisodeVideos(wiki, checkpoint, deps)).status, 'ready')
  assert.equal(submits.length, 2)
  assert.equal(registry(fs)[0].video_path, '/out/recovered.mp4')
})

test('preflight enforces the registered duration and uses the explicit model instead of its path', async () => {
  const duration = fakeDeps(prompts)
  await assert.rejects(submitEpisodeVideos(wiki, { ...checkpoint, duration_seconds: 41 }, images, duration.deps), /时长/)
  assert.equal(duration.submits.length, 0)
  const h3 = fakeDeps({ [seg1]: '<Picture 1> 石道\n<Picture 2> 莫甘娜' })
  await submitEpisodeVideos(wiki, { ...checkpoint, video_model: 'H3', segments: [checkpoint.segments[0]] }, images, h3.deps)
  assert.equal(h3.submits.length, 1)
  const mismatched = fakeDeps({ [seg1]: 'subject_definitions:\n<Picture 1> 莫甘娜\n<Picture 2> 石道\n\nsummary:\n<Picture 1> 石道\n<Picture 2> 莫甘娜' })
  await assert.rejects(submitEpisodeVideos(wiki, { ...checkpoint, video_model: 'H3', segments: [checkpoint.segments[0]] }, images, mismatched.deps), /参考图|顺序/)
  assert.equal(mismatched.submits.length, 0)
})


test('reviewing one prompt refreshes only its checkpoint hash and regenerates only that segment', async () => {
  const { deps, fs, tasks, submits } = fakeDeps(prompts)
  const cp = { ...checkpoint, files: { prompts: { [seg1]: await textHash(prompts[seg1]), [seg2]: await textHash(prompts[seg2]) } } }
  await submitEpisodeVideos(wiki, cp, images, deps)
  tasks.set('v1', { status: 'success', localPath: '/out/keep.mp4' })
  tasks.set('v2', { status: 'success', localPath: '/out/old.mp4' })
  await checkEpisodeVideos(wiki, cp, deps)
  const originalFirstHash = cp.files.prompts[seg1]
  await rewriteCheckpointPrompt(wiki, cp, seg2, '书房雨夜。\n@图1：莫甘娜', deps)
  assert.equal(cp.files.prompts[seg1], originalFirstHash)
  assert.equal(cp.files.prompts[seg2], await textHash(fs.get(seg2)!))
  await regenerateSegment(wiki, cp, 1, deps)
  assert.equal(submits.length, 3)
  assert.equal(registry(fs)[0].video_path, '/out/keep.mp4')
  assert.equal(registry(fs)[0].task_id, 'v1')
  assert.equal(registry(fs)[1].task_id, 'v3')
})


test('opt-in continuation waits for previous result and uses a declared separate frame model without replacing provenance refs', async () => {
  const {deps,fs,tasks,submits}=fakeDeps(prompts)
  const planned = structuredClone(checkpoint)
  planned.segments[1].transition = { type: 'continue', reason: '同镜头动作接续' }
  const frameSubmits: any[]=[]
  Object.assign(deps,{continuation:{modelId:'frame-model',exclusive:true,checkVideo() {},async submitVideo(input:any){frameSubmits.push(input);tasks.set('frame-task',{status:'pending'});return 'frame-task'}},extractTailFrame:async (video:string,end:number)=>{assert.equal(video,'/out/one.mp4');assert.equal(end,27.5);return '/out/tail.png'},waitPrevious:async(check:()=>Promise<boolean>)=>{assert.equal(submits.length,1);assert.equal(frameSubmits.length,0);tasks.set('v1',{status:'success',localPath:'/out/one.mp4'});assert.equal(await check(),true)}})
  await submitEpisodeVideos(wiki,planned,images,deps)
  assert.equal(submits.length,1)
  assert.equal(frameSubmits.length,1)
  assert.deepEqual(frameSubmits[0].images,[])
  assert.equal(frameSubmits[0].firstFrame,'/out/tail.png')
  assert.doesNotMatch(frameSubmits[0].prompt,/@图\d|<Picture /)
  assert.deepEqual(registry(fs)[1].images,['/p/莫甘娜.png'])
  assert.equal(registry(fs)[1].model_id,'frame-model')
  await submitEpisodeVideos(wiki,planned,images,deps)
  assert.equal(frameSubmits.length,1,'resume does not resubmit')
})


test('invalid continuation parameters fail preflight before any generation', async () => {
  const {deps,submits}=fakeDeps(prompts)
  Object.assign(deps,{continuation:{modelId:'frame',exclusive:true,checkVideo(){throw new Error('续接时长超限')},submitVideo:deps.submitVideo}})
  await assert.rejects(submitEpisodeVideos(wiki,checkpoint,images,deps),/续接时长超限/)
  assert.equal(submits.length,0)
})

test('stopping a chained wait keeps the first task and resume queries it without resubmitting', async () => {
  const {deps,fs,tasks,submits}=fakeDeps(prompts)
  let stop=false, extracted=0
  Object.assign(deps,{continuation:{modelId:'frame',exclusive:true,checkVideo(){},submitVideo:deps.submitVideo},extractTailFrame:async()=>{extracted++;return '/tail'},waitPrevious:async(check:()=>Promise<boolean>)=>{assert.equal(await check(),false);stop=true;await check()}})
  await assert.rejects(submitEpisodeVideos(wiki,checkpoint,images,deps,()=>stop),/停止/)
  assert.equal(submits.length,1);assert.equal(extracted,0)
  stop=false
  deps.waitPrevious=async check=>{tasks.set('v1',{status:'success',localPath:'/one'});assert.equal(await check(),true)}
  await submitEpisodeVideos(wiki,checkpoint,images,deps,()=>stop)
  assert.equal(submits.length,2);assert.equal(extracted,1)
  assert.equal(registry(fs)[0].submits,1)
  assert.equal(registry(fs)[1].first_frame.source_task_id,'v1')
})

test('saved continuation cannot silently switch back to a reference model or another frame endpoint', async () => {
  const {deps,tasks,submits}=fakeDeps(prompts)
  Object.assign(deps,{continuation:{modelId:'frame',exclusive:true,checkVideo(){},submitVideo:deps.submitVideo},extractTailFrame:async()=>'/tail',waitPrevious:async(check:()=>Promise<boolean>)=>{tasks.set('v1',{status:'success',localPath:'/one'});assert.equal(await check(),true)}})
  await submitEpisodeVideos(wiki,checkpoint,images,deps)
  delete deps.continuation
  await assert.rejects(submitEpisodeVideos(wiki,checkpoint,images,deps),/续接型号/)
  assert.equal(submits.length,2)
})

test('changing a saved continuation to a cut requires an explicit ordinary redo that clears the old frame', async () => {
  const w = fakeDeps(prompts), plan = structuredClone(checkpoint)
  w.deps.continuation = { modelId: 'frame', exclusive: true, checkVideo() {}, submitVideo: w.deps.submitVideo }
  w.deps.extractTailFrame = async () => '/tail'
  w.deps.waitPrevious = async check => {
    w.tasks.set('v1', { status: 'success', localPath: '/one' })
    assert.equal(await check(), true)
  }
  await submitEpisodeVideos(wiki, plan, images, w.deps)
  w.tasks.set('v2', { status: 'success', localPath: '/two' })
  await checkEpisodeVideos(wiki, plan, w.deps)
  plan.segments[1].transition = { type: 'cut', reason: '改为反打' }
  await assert.rejects(submitEpisodeVideos(wiki, plan, images, w.deps), /镜头关系/)
  assert.equal(w.submits.length, 2)
  await regenerateSegment(wiki, plan, 1, w.deps)
  assert.equal(w.submits[2].firstFrame, undefined)
  assert.deepEqual(w.submits[2].images, ['/p/莫甘娜.png'])
  assert.equal(registry(w.fs)[1].transition.type, 'cut')
  assert.equal(registry(w.fs)[1].versions.length, 1)
})
