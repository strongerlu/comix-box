<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import JcIcon from '@/components/icons/JcIcon.vue'
import type { MediaTask } from '@/stores/mediaTaskStore'
import { projectResourceForMediaTask } from '@/runtime/workbench/mediaReference'
import { acquireProjectMediaDisplay } from '@/services/projectMediaResolver'
import { resolveProjectVideoThumbnail } from '@/utils/mediaThumbnail'

const props = defineProps<{ task: MediaTask }>()
const url = ref('')
const icon = computed(() => ({ image: 'image', video: 'movie', audio: 'music_note', text: 'description', model3d: 'view_in_ar', file: 'insert_drive_file' })[props.task.type])
watch(() => [props.task.id, props.task.type, props.task.directory, props.task.projectId, props.task.projectPath, props.task.assetUri], async (_, __, onCleanup) => {
  url.value = ''
  let disposed = false
  let release: (() => void) | undefined
  onCleanup(() => { disposed = true; release?.() })
  const resource = projectResourceForMediaTask(props.task)
  if (!resource || !['image', 'video'].includes(props.task.type)) return
  try {
    if (props.task.type === 'video') {
      if (resource.runtime !== 'desktop') return
      const thumbnail = await resolveProjectVideoThumbnail(resource.owner, resource.path)
      if (!disposed) url.value = thumbnail
    } else {
      const display = await acquireProjectMediaDisplay(resource)
      if (disposed) { display.release(); return }
      release = display.release
      url.value = display.url
    }
  } catch { /* Missing historical files retain the media-type placeholder. */ }
}, { immediate: true })
</script>

<template>
  <span class="task-thumbnail" aria-hidden="true">
    <img v-if="url" :src="url" alt="" loading="lazy" @error="url = ''" />
    <JcIcon v-else :name="icon" />
  </span>
</template>

<style scoped>
.task-thumbnail { display: grid; width: 64px; height: 48px; flex: 0 0 64px; place-items: center; overflow: hidden; border: 1px solid var(--line); border-radius: 7px; background: var(--surface-alt); color: var(--ink3); }
.task-thumbnail img { width: 100%; height: 100%; object-fit: cover; }
.task-thumbnail :deep(svg) { width: 23px; height: 23px; }
</style>
