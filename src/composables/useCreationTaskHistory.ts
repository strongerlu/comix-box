import { computed, ref, watch, type Ref } from 'vue'
import type { MediaTask } from '@/stores/mediaTaskStore'
import { creationTaskStage, matchesCreationTaskFilter, type CreationTaskFilter } from '@/utils/creationPresentation'

export const CREATION_TASK_FILTERS: { key: CreationTaskFilter; label: string }[] = [
  { key: 'all', label: '全部' }, { key: 'active', label: '进行中' },
  { key: 'saved', label: '已保存' }, { key: 'attention', label: '待处理' },
]

/** 创作任务记录的筛选、搜索与分页；只读原任务对象，不复制。 */
export function useCreationTaskHistory(creationTasks: Readonly<Ref<MediaTask[]>>) {
  const taskFilter = ref<CreationTaskFilter>('all')
  const taskSearch = ref('')
  const filteredCreationTasks = computed(() => {
    const query = taskSearch.value.trim().toLocaleLowerCase()
    return creationTasks.value.filter(task => matchesCreationTaskFilter(task, taskFilter.value)
      && (!query || [task.prompt, task.modelLabel, task.model, creationTaskStage(task)].some(value => value?.toLocaleLowerCase().includes(query))))
  })
  const creationTasksTotal = computed(() => filteredCreationTasks.value.length)

  const taskPageSize = ref(20)
  const taskPage = ref(1)
  const totalTaskPages = computed(() =>
    Math.max(1, Math.ceil(creationTasksTotal.value / taskPageSize.value)),
  )

  watch([taskFilter, taskSearch, taskPageSize], () => { taskPage.value = 1 })
  watch(creationTasksTotal, () => {
    if (taskPage.value > totalTaskPages.value) taskPage.value = totalTaskPages.value
  })

  const pagedCreationTasks = computed(() => {
    const start = (taskPage.value - 1) * taskPageSize.value
    return filteredCreationTasks.value.slice(start, start + taskPageSize.value)
  })

  return { taskFilter, taskSearch, taskPageSize, taskPage, totalTaskPages, creationTasksTotal, pagedCreationTasks }
}
