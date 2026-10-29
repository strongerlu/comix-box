<script lang="ts">
export interface ComposerSkillOption {
  type: 'skill'
  name: string
  display: string
  description: string
  source?: 'builtin' | 'custom'
  unavailableReason?: string
}
</script>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import JcIcon from '@/components/icons/JcIcon.vue'
import { searchSkills } from '@/utils/skillSearch'

const props = defineProps<{
  items: ComposerSkillOption[]
  selectedNames: string[]
  scopeNote?: string
}>()
const emit = defineEmits<{
  select: [item: ComposerSkillOption]
  close: []
}>()
const query = ref('')
const availableOnly = ref(false)
const category = ref<'all' | 'builtin' | 'custom' | 'selected'>('all')
const searchInput = ref<HTMLInputElement | null>(null)
const listEl = ref<HTMLElement | null>(null)
const activeName = ref('')
const filteredSkills = computed(() => {
  const items = props.items.filter(item => (!availableOnly.value || !item.unavailableReason) && (category.value === 'all'
    || (category.value === 'selected' ? props.selectedNames.includes(item.name) : item.source === category.value)))
  return searchSkills(query.value, items.map(item => ({
    id: `composer:${item.name}:${item.display}`, name: item.display,
    label: item.name, description: item.description, option: item,
  }))).map(result => result.option)
})
const categories = computed(() => [
  { id: 'all' as const, label: '全部', count: props.items.length },
  { id: 'builtin' as const, label: '内置', count: props.items.filter(item => item.source === 'builtin').length },
  { id: 'custom' as const, label: '自定义', count: props.items.filter(item => item.source === 'custom').length },
  { id: 'selected' as const, label: '已选', count: props.items.filter(item => props.selectedNames.includes(item.name)).length },
])

watch(filteredSkills, items => {
  activeName.value = items.find(item => !item.unavailableReason)?.name || ''
  if (listEl.value) listEl.value.scrollTop = 0
}, { immediate: true })
watch(activeName, async () => {
  await nextTick()
  listEl.value?.querySelector<HTMLElement>('.skill-picker-option.active')?.scrollIntoView({ block: 'nearest' })
})

function focusSearch() {
  searchInput.value?.focus()
}

function handleKeydown(event: KeyboardEvent) {
  if (event.isComposing || event.keyCode === 229) return
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    emit('close')
    return
  }
  if (event.key === 'Enter' && (event.target as Element | null)?.closest?.('button, input[type="checkbox"]')) return
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    event.stopPropagation()
    const item = filteredSkills.value.find(skill => skill.name === activeName.value && !skill.unavailableReason)
    if (item) emit('select', item)
    return
  }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  // Home/End retain their normal text-editing behavior inside the search field.
  if (event.target === searchInput.value && (event.key === 'Home' || event.key === 'End')) return
  const items = filteredSkills.value.filter(item => !item.unavailableReason)
  if (!items.length) return
  event.preventDefault()
  event.stopPropagation()
  const index = items.findIndex(item => item.name === activeName.value)
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
    : index < 0 ? (event.key === 'ArrowDown' ? 0 : items.length - 1)
    : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
  activeName.value = items[next]?.name || ''
}

defineExpose({ focusSearch, handleKeydown })
</script>

<template>
  <section class="skill-picker" aria-label="全部 Skill" @keydown="handleKeydown">
    <header class="skill-picker-header">
      <div><strong>全部 Skill</strong><small>{{ items.length }} 项</small></div>
      <button type="button" class="skill-picker-close" aria-label="关闭 Skill 列表" title="关闭" @click="emit('close')"><JcIcon name="close" /></button>
    </header>
    <div class="skill-picker-search">
      <JcIcon name="search" />
      <input ref="searchInput" v-model="query" type="search" aria-label="搜索全部 Skill" placeholder="搜索名称、用途或拼音" autocomplete="off" />
    </div>
    <nav class="skill-picker-categories" aria-label="Skill 分类">
      <button v-for="item in categories" :key="item.id" type="button" :aria-pressed="category === item.id" @click="category = item.id; focusSearch()">{{ item.label }}<span>{{ item.count }}</span></button>
    </nav>
    <label class="skill-picker-availability"><input v-model="availableOnly" type="checkbox" />只看当前可用</label>
    <p v-if="scopeNote" class="skill-picker-scope">{{ scopeNote }}</p>
    <div ref="listEl" class="skill-picker-list" aria-label="可用 Skill 列表">
      <p v-if="!filteredSkills.length" class="skill-picker-empty">{{ query.trim() ? '没有匹配的 Skill，试试其他关键词' : '此分类暂无可用 Skill' }}</p>
      <button
        v-for="item in filteredSkills"
        :key="item.name"
        type="button"
        class="skill-picker-option"
        :class="{ active: activeName === item.name }"
        :aria-pressed="selectedNames.includes(item.name)"
        :disabled="Boolean(item.unavailableReason)"
        :title="[item.display, item.name, item.unavailableReason, item.description].filter(Boolean).join('\n')"
        @mousedown.prevent
        @pointermove="!item.unavailableReason && (activeName = item.name)"
        @click="emit('select', item)"
      >
        <span class="skill-picker-glyph"><JcIcon name="psychology" /></span>
        <span class="skill-picker-copy"><strong>{{ item.display }}</strong><small>{{ item.description || item.name }}</small></span>
        <span v-if="item.unavailableReason" class="skill-picker-lock" :title="item.unavailableReason" aria-label="当前创作路线不可用"><JcIcon name="lock" /></span>
        <span class="skill-picker-source">{{ selectedNames.includes(item.name) ? '已选' : item.source === 'builtin' ? '内置' : '自定义' }}</span>
      </button>
    </div>
    <footer>显示 {{ filteredSkills.length }} / {{ items.length }} 项<span>↑↓ 选择 · Enter 添加</span></footer>
  </section>
</template>

<style scoped>
.skill-picker-availability { display: flex; align-items: center; gap: 6px; flex: 0 0 auto; margin: 8px 16px; font-size: 12px; color: var(--ink2); cursor: pointer; }
.skill-picker-availability input { accent-color: var(--olive); }
.skill-picker-lock { flex: 0 0 14px; color: var(--ink3); }
.skill-picker-lock :deep(svg) { width: 14px; height: 14px; }
.skill-picker { display: flex; flex-direction: column; min-height: 0; max-height: inherit; color: var(--ink1); }
.skill-picker-header { display: flex; flex: 0 0 auto; align-items: center; justify-content: space-between; gap: 8px; padding: 12px 14px 8px; }
.skill-picker-header > div { display: flex; align-items: baseline; gap: 8px; }
.skill-picker-header strong { font-size: 14px; font-weight: 600; }
.skill-picker-header small, .skill-picker-source { color: var(--ink3); font-size: 11px; }
.skill-picker-close { display: grid; width: 28px; height: 28px; padding: 0; place-items: center; border: 0; border-radius: 6px; background: transparent; color: var(--ink2); cursor: pointer; }
.skill-picker-close:hover { background: var(--surface-alt); }
.skill-picker-close > svg { width: 16px; height: 16px; }
.skill-picker-search { display: flex; flex: 0 0 auto; align-items: center; gap: 7px; margin: 0 14px 10px; padding: 0 9px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface-alt); }
.skill-picker-search:focus-within { border-color: var(--olive); }
.skill-picker-search > svg { width: 16px; height: 16px; flex: 0 0 16px; color: var(--ink3); }
.skill-picker-search input { width: 100%; min-width: 0; height: 34px; padding: 0; border: 0; outline: 0; background: transparent; color: var(--ink1); font: inherit; font-size: 13px; }
.skill-picker-categories { display: flex; flex: 0 0 auto; flex-wrap: wrap; gap: 4px; padding: 0 14px 10px; border-bottom: 1px solid var(--line); }
.skill-picker-categories button { display: inline-flex; align-items: center; gap: 4px; min-height: 28px; padding: 0 7px; border: 1px solid transparent; border-radius: 6px; background: transparent; color: var(--ink2); font: inherit; font-size: 12px; cursor: pointer; }
.skill-picker-categories button[aria-pressed="true"] { border-color: color-mix(in srgb, var(--olive) 25%, var(--line)); background: var(--olive-pale); color: var(--olive); }
.skill-picker-categories span { font-size: 10px; font-variant-numeric: tabular-nums; opacity: .8; }
.skill-picker-scope { flex: 0 0 auto; margin: 0; padding: 7px 14px; color: var(--ink3); font-size: 11px; line-height: 1.5; background: var(--surface-alt); }
.skill-picker-list { flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-gutter: stable; padding: 5px; }
.skill-picker-option { display: flex; align-items: flex-start; width: 100%; gap: 9px; padding: 10px 8px; border: 0; border-radius: 8px; background: transparent; color: var(--ink1); cursor: pointer; font: inherit; text-align: left; }
.skill-picker-option:not(:disabled):hover, .skill-picker-option.active:not(:disabled) { background: var(--surface-alt); }
.skill-picker-option[aria-pressed="true"] .skill-picker-source { color: var(--olive); }
.skill-picker-option:disabled { opacity: .55; cursor: not-allowed; }
.skill-picker-glyph { position: relative; display: grid; width: 25px; height: 25px; flex: 0 0 25px; place-items: center; border: 1px solid color-mix(in srgb, var(--olive) 24%, var(--line)); border-radius: 6px; background: var(--olive-pale); color: var(--olive); }
.skill-picker-glyph::after { content: ''; position: absolute; top: -2px; right: -2px; width: 4px; height: 4px; border: 1px solid var(--paper); border-radius: 1px; background: currentColor; transform: rotate(45deg); }
.skill-picker-glyph > svg { width: 16px; height: 16px; }
.skill-picker-copy { display: grid; flex: 1; min-width: 0; gap: 4px; }
.skill-picker-copy strong { overflow-wrap: anywhere; font-size: 13px; font-weight: 500; line-height: 1.4; }
.skill-picker-copy small { display: -webkit-box; overflow: hidden; -webkit-line-clamp: 2; -webkit-box-orient: vertical; color: var(--ink3); font-size: 12px; line-height: 1.5; }
.skill-picker-source { flex-shrink: 0; padding-top: 2px; }
.skill-picker-empty { margin: 0; padding: 26px 12px; text-align: center; color: var(--ink3); font-size: 12px; }
.skill-picker footer { display: flex; flex: 0 0 auto; justify-content: space-between; gap: 10px; padding: 8px 14px; border-top: 1px solid var(--line); color: var(--ink3); font-size: 11px; }
.skill-picker footer span { white-space: nowrap; }
.skill-picker button:focus-visible { outline: 2px solid var(--jc-focus-ring); outline-offset: -2px; }
</style>
