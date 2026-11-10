import assert from 'node:assert/strict'
import { test } from 'node:test'

import { groupChatModels, isInternalMediaModel } from '../chatModelGroups'

test('chat model families use the requested order and merge remaining suppliers', () => {
  const models = ['doubao-chat', 'gemini-pro', 'qwen-plus', 'gpt-6.1-sol', 'claude-opus', 'gpt-5.5', 'deepseek-chat', 'grok-4', 'glm-chat', 'local-chat']
    .map((id, index) => ({ id, index, providerId: index === 9 ? 'local-ollama' : 'custom:test' }))
  const groups = groupChatModels(models)
  assert.deepEqual(groups.map(group => group.key), ['anthropic', 'openai', 'google', 'deepseek', 'qwen', 'xai', 'other', 'local'])
  assert.deepEqual(groups.map(group => group.label), ['Claude', 'GPT', 'Gemini', 'DeepSeek', '千问', 'Grok', '其他', '本地模型'])
  assert.deepEqual(groups[1].models.map(model => model.index), [3, 5])
  assert.deepEqual(groups[6].models.map(model => model.index), [0, 8])
})

test('internal media and search models stay out of the chat picker', () => {
  for (const id of ['rh-flux', 'vendor/rh-upscale', 'RunningHub-x', 'jina-search', 'jina-reader']) {
    assert.equal(isInternalMediaModel(id), true, id)
  }
  assert.equal(isInternalMediaModel('gpt-5.5'), false)
})
