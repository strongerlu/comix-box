import assert from 'node:assert/strict'
import { test } from 'node:test'
import { effectScope, nextTick, ref } from 'vue'

import type { MediaTask } from '@/stores/mediaTaskStore'
import { useCreationTaskHistory } from '../useCreationTaskHistory'

function tasks(count: number) {
  return ref(Array.from({ length: count }, (_, index) => ({
    id: `task-${index}`,
    status: index === 0 ? 'failed' : 'success',
    projectPath: index ? `图片/${index}.png` : undefined,
    prompt: index === 0 ? 'retry-me' : 'landscape',
    model: 'test-model',
  })) as unknown as MediaTask[])
}

test('history filters and search keep pagination in range and preserve original task objects', async () => {
  const list = tasks(45)
  const scope = effectScope()
  const state = scope.run(() => useCreationTaskHistory(list))!
  state.taskPage.value = 3
  assert.equal(state.pagedCreationTasks.value[0], list.value[40])

  state.taskFilter.value = 'attention'
  await nextTick()
  assert.equal(state.taskPage.value, 1)
  assert.equal(state.creationTasksTotal.value, 1)
  assert.equal(state.pagedCreationTasks.value[0], list.value[0])

  state.taskSearch.value = 'no-match'
  await nextTick()
  assert.equal(state.creationTasksTotal.value, 0)
  assert.equal(state.totalTaskPages.value, 1)

  state.taskFilter.value = 'all'
  state.taskSearch.value = ''
  state.taskPageSize.value = 10
  await nextTick()
  assert.equal(state.pagedCreationTasks.value.length, 10)
  assert.equal(list.value.length, 45)
  scope.stop()
})

test('search matches prompt and model case-insensitively', async () => {
  const list = tasks(3)
  const scope = effectScope()
  const state = scope.run(() => useCreationTaskHistory(list))!
  state.taskSearch.value = '  RETRY  '
  await nextTick()
  assert.deepEqual(state.pagedCreationTasks.value.map(task => task.id), ['task-0'])
  state.taskSearch.value = 'TEST-MODEL'
  await nextTick()
  assert.equal(state.creationTasksTotal.value, 3)
  scope.stop()
})

test('shrinking the task list pulls the current page back into range', async () => {
  const list = tasks(45)
  const scope = effectScope()
  const state = scope.run(() => useCreationTaskHistory(list))!
  state.taskPage.value = 3
  list.value = list.value.slice(0, 25)
  await nextTick()
  assert.equal(state.taskPage.value, 2)
  assert.equal(state.pagedCreationTasks.value.length, 5)
  scope.stop()
})
