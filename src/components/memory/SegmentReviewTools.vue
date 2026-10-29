<template>
  <div class="segment-review-tools">
    <label>问题类型
      <select v-model="category" :disabled="busy" @change="saveNote">
        <option value="story">剧情与表演</option><option value="continuity">空间与接续</option>
        <option value="color">亮度与色彩</option><option value="sound">声音</option>
      </select>
    </label>
    <textarea v-model="notes" rows="2" placeholder="记录这一段的问题（可不填）" :disabled="busy" @change="saveNote" />
    <template v-if="category === 'continuity'">
      <small>{{ frameBound ? '已绑定上一段实际尾帧；上一段换版后需重新绑定。' : '普通参考图提供外观，不能保证首帧站位。' }}</small>
      <button type="button" :disabled="busy || !previousReady" @click="emit('previewFrame')">查看上一段切点尾帧</button>
      <img v-if="framePreview" :src="convertFileSrc(framePreview)" alt="上一段在本集计划切点的实际尾帧">
      <button type="button" :disabled="busy || !canBind" :title="canBind ? '取上一段在计划切点的实际尾帧，作为本段首帧重新生成；会创建付费任务' : '需要上一段视频就绪，且模型明确支持当前参考图与首帧组合'" @click="emit('bind')">用上一段尾帧重做</button>
    </template>
    <template v-if="category === 'color' || category === 'sound'">
      <small>本地处理后生成独立版本，保留原视频，可在版本对比中选择。</small>
      <template v-if="category === 'color'">
        <label v-for="field in colorFields" :key="field.key">{{ field.label }}
          <input v-model.number="adjustments[field.key]" type="range" :min="field.min" :max="field.max" step="0.05" :disabled="busy"><output>{{ adjustments[field.key] }}</output>
        </label>
      </template>
      <label v-else>音量（0 为静音）<input v-model.number="adjustments.volume" type="range" min="0" max="3" step="0.1" :disabled="busy"><output>{{ adjustments.volume }}</output></label>
      <button type="button" :disabled="busy || !video || neutral" @click="emit('process', { ...adjustments })">生成本地调整版</button>
    </template>
    <button type="button" :disabled="busy || !versions.length" @click="comparing = !comparing">{{ comparing ? '收起版本对比' : `版本对比（${versions.length}）` }}</button>
    <Teleport to="body">
    <div v-if="comparing" class="segment-version-overlay" @click.self="comparing = false">
    <section class="segment-version-dialog" role="dialog" :aria-label="`${label}版本对比`">
      <header><strong>{{ label }} · 版本对比</strong><button type="button" @click="comparing = false">关闭</button></header>
      <div class="segment-versions">
      <figure v-for="(version, index) in versions" :key="version.id">
        <figcaption>版本 {{ index + 1 }} · {{ version.origin === 'postprocess' ? '本地处理' : '模型生成' }}{{ version.current ? ' · 当前采用' : '' }}</figcaption>
        <small v-if="version.transition">{{ version.transition.type === 'continue' ? '动作接续' : version.transition.type === 'cut' ? '切换镜头' : '切换场景' }}：{{ version.transition.reason }}</small>
        <video v-if="version.video_path" :src="convertFileSrc(version.video_path)" controls preload="metadata" />
        <details v-if="version.submitted_prompt && version.submitted_prompt !== version.prompt_document"><summary>实际提交内容</summary><pre>{{ version.submitted_prompt }}</pre></details>
        <details><summary>查看提示词</summary><pre>{{ version.prompt_document || '此旧版本没有提示词快照，只能对比视频。' }}</pre></details>
        <button type="button" :disabled="busy || version.current || !version.prompt_document" @click="emit('adopt', version.id)">采用此版本</button>
      </figure>
      </div>
    </section>
    </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { convertFileSrc } from '@tauri-apps/api/core'
import type { ReviewCategory, SegmentReviewNote, VideoVersion } from '@/runtime/manjuAuto/videoScheduler'

const props = defineProps<{ label: string; video?: string; versions: VideoVersion[]; busy: boolean; canBind: boolean; frameBound: boolean; review?: SegmentReviewNote; previousReady: boolean; framePreview?: string }>()
const emit = defineEmits<{ note: [review: SegmentReviewNote]; adopt: [id: string]; bind: []; previewFrame: []; process: [adjustments: typeof adjustments] }>()
const category = ref<ReviewCategory>('story')
const notes = ref('')
const comparing = ref(false)
const adjustments = reactive({ brightness: 0, contrast: 1, saturation: 1, warmth: 0, volume: 1 })
const colorFields = [
  { key: 'brightness', label: '亮度', min: -1, max: 1 }, { key: 'contrast', label: '对比度', min: 0.1, max: 3 },
  { key: 'saturation', label: '饱和度', min: 0, max: 3 }, { key: 'warmth', label: '冷暖', min: -1, max: 1 },
] as const
const neutral = computed(() => adjustments.brightness === 0 && adjustments.contrast === 1 && adjustments.saturation === 1 && adjustments.warmth === 0 && adjustments.volume === 1)
watch(() => props.review, value => { category.value = value?.category || 'story'; notes.value = value?.notes || '' }, { immediate: true })
watch(() => props.video, () => Object.assign(adjustments, { brightness: 0, contrast: 1, saturation: 1, warmth: 0, volume: 1 }))
function saveNote() { emit('note', { category: category.value, notes: notes.value }) }
</script>

<style scoped>
.segment-review-tools { display: grid; gap: 6px; width: 100%; }
label { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; }
select, textarea, button { max-width: 100%; padding: 5px; color: var(--ink1); background: var(--paper); border: 1px solid var(--line); border-radius: 5px; font: inherit; }
textarea { width: 100%; box-sizing: border-box; resize: vertical; }
input[type=range] { width: 95px; flex: 1; min-width: 50px; }
small { color: var(--ink3); line-height: 1.5; }
.segment-version-overlay { position: fixed; inset: 0; z-index: 5000; display: grid; place-items: center; padding: 20px; background: rgb(0 0 0 / 45%); }
.segment-version-dialog { display: grid; gap: 12px; width: min(1100px, 90vw); max-height: 85vh; overflow: auto; padding: 16px; border-radius: 10px; background: var(--paper); color: var(--ink1); font-size: 13px; }
header { display: flex; align-items: center; justify-content: space-between; }
.segment-versions { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
figure { display: grid; gap: 5px; margin: 0; padding: 6px; border: 1px solid var(--line); }
video, img { width: 100%; max-height: 260px; background: #000; object-fit: contain; }
pre { white-space: pre-wrap; overflow-wrap: anywhere; max-height: 150px; overflow: auto; }
button:disabled { opacity: .5; cursor: default; }
</style>
