<script setup lang="ts">
import { reactive, ref } from 'vue'
import { localComfyVideos, localComfyLoadError, saveLocalComfyVideo, type LocalComfyVideo } from '@/runtime/creation/localComfyVideo'

const id = ref('')
const name = ref('')
const workflow = ref('')
const min = ref(4)
const max = ref(4)
const bindings = reactive({ prompt: '', duration: '', width: '', height: '', seed: '' })
const message = ref('')
const failed = ref(false)
const labels = { prompt: '提示词（必填）', duration: '时长（秒）', width: '实际宽度', height: '实际高度', seed: '种子' }

function edit(profile?: LocalComfyVideo) {
  id.value = profile?.id || ''; name.value = profile?.name || ''
  workflow.value = profile ? JSON.stringify(profile.workflow, null, 2) : ''
  min.value = profile?.minSeconds ?? 4; max.value = profile?.maxSeconds ?? 4
  for (const key of Object.keys(bindings) as Array<keyof typeof bindings>) bindings[key] = profile?.bindings[key] || ''
  failed.value = false
  message.value = ''
}
async function importFile(event: Event) {
  const input = event.target as HTMLInputElement
  try {
    const file = input.files?.[0]
    if (file) {
      workflow.value = await file.text()
      failed.value = false
      message.value = ''
    }
  }
  catch (error) { failed.value = true; message.value = String(error) }
  input.value = ''
}
function save() {
  try {
    const nextId = id.value || `local-comfy/user-${crypto.randomUUID()}`
    saveLocalComfyVideo({ id: nextId, name: name.value.trim(), workflow: JSON.parse(workflow.value), bindings: { ...bindings }, minSeconds: Number(min.value), maxSeconds: Number(max.value) })
    id.value = nextId; failed.value = false; message.value = '已保存，可在视频模型列表「本地 ComfyUI」中选择。'
  } catch (error) { failed.value = true; message.value = error instanceof Error ? error.message : String(error) }
}
</script>

<template>
  <div class="local-comfy-video-settings">
    <strong>本地视频模型（ComfyUI）</strong>
    <p>与 MCP 设置中的 ComfyUI 连接共用服务地址，支持本机和局域网。先在 ComfyUI 中验证工作流，再选择「导出(API)」。本轮支持文生视频；模型权重与节点安装在 GPU 服务器上。</p>
    <p v-if="localComfyLoadError" role="alert">{{ localComfyLoadError }}。请修复原配置并重启应用后再保存。</p>
    <div class="model-list"><button type="button" @click="edit()">新增本地视频模型</button><button v-for="model in localComfyVideos" :key="model.id" type="button" @click="edit(model)">编辑 {{ model.name }}</button></div>
    <label>模型显示名称<input v-model="name" placeholder="例如：局域网 H3 精细版" /></label>
    <label>导入 API 工作流 JSON<input type="file" accept=".json,application/json" @change="importFile" /></label>
    <label>API 工作流内容<textarea v-model="workflow" rows="7" spellcheck="false" placeholder="粘贴导出(API)的 JSON，保留模型文件名、采样参数和保存视频节点；不要放入密钥。" /></label>
    <p>绑定格式为「节点ID.输入名」，例如 12.text。宽高应绑定真正控制尺寸的上游节点输入；可选项留空时保留工作流原值。时长必须以秒为单位，不要直接绑定帧数。整数时长输入的范围须包含整数秒。没有时长绑定时，最短和最长均填写工作流固定时长。</p>
    <label v-for="(label, key) in labels" :key="key">{{ label }}<input v-model="bindings[key]" :placeholder="key === 'prompt' ? '例如：12.text' : '可选'" /></label>
    <div class="duration"><label>最短秒数<input v-model.number="min" type="number" min="0.1" step="0.1" /></label><label>最长秒数<input v-model.number="max" type="number" min="0.1" step="0.1" /></label></div>
    <button type="button" :disabled="!!localComfyLoadError" @click="save">保存本地视频模型</button>
    <p v-if="message" :role="failed ? 'alert' : 'status'">{{ message }}</p>
    <p>配置保存在这台电脑。保存会校验结构和绑定，不会自动生成视频，也不代表服务器已安装所有依赖。任务保存工作流快照，编辑配置不会修改已提交任务。</p>
  </div>
</template>

<style scoped>
.local-comfy-video-settings { display: grid; gap: 10px; min-width: 0; }
label { display: grid; gap: 5px; font-size: 12px; }
input, textarea { box-sizing: border-box; width: 100%; min-width: 0; padding: 8px; border: 1px solid var(--line); border-radius: 6px; background: var(--paper); color: var(--ink1); }
textarea { resize: vertical; font-family: monospace; }
.model-list, .duration { display: flex; gap: 8px; flex-wrap: wrap; }
button { padding: 7px 10px; border: 1px solid var(--line); border-radius: 6px; background: var(--paper); color: var(--ink1); cursor: pointer; }
p { margin: 0; color: var(--ink2); font-size: 12px; line-height: 1.6; }
[role=alert] { color: var(--error, #c33); }
</style>
