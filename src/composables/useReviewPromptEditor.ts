import { computed, ref, shallowRef, type Ref, type ShallowRef, type ComputedRef } from 'vue'

interface ReviewPromptEditor<Key> {
  target: ShallowRef<Key | null>
  text: Ref<string>
  loading: Ref<boolean>
  error: Ref<string>
  canSave: ComputedRef<boolean>
  open(id: Key): Promise<void>
  close(): void
  save(submit: (id: Key, prompt: string) => void): boolean
}

/** 审图、审片共用：读取错误与正文分离，过期响应不能覆盖当前编辑目标。 */
export function useReviewPromptEditor<Key extends string | number>(load: (target: Key) => Promise<string>): ReviewPromptEditor<Key> {
  const target: ShallowRef<Key | null> = shallowRef(null)
  const text = ref('')
  const loading = ref(false)
  const error = ref('')
  let version = 0
  const canSave = computed(() => target.value !== null && !loading.value && !error.value && Boolean(text.value.trim()))
  function close() {
    version++
    target.value = null
    text.value = ''
    error.value = ''
    loading.value = false
  }
  async function open(id: Key) {
    const request = ++version
    target.value = id
    text.value = ''
    error.value = ''
    loading.value = true
    try {
      const content = await load(id)
      if (request === version) text.value = content
    } catch (cause) {
      if (request === version) error.value = `读取提示词失败：${cause instanceof Error ? cause.message : String(cause)}`
    } finally {
      if (request === version) loading.value = false
    }
  }
  function save(submit: (id: Key, prompt: string) => void) {
    if (!canSave.value || target.value === null) return false
    submit(target.value, text.value)
    close()
    return true
  }
  return { target, text, loading, error, canSave, open, close, save }
}
