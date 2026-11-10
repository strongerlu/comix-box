import assert from 'node:assert/strict'
import { test } from 'node:test'

import { groupCreationModels } from '../creationPresentation'

const families = (task: string, names: string[]) =>
  groupCreationModels(names.map(family => ({ family })), task).map(([family]) => family)

test('jc 本机 sorts after every known group and unknown plugin groups come last', () => {
  for (const task of ['image', 'video', 'audio']) {
    assert.deepEqual(families(task, ['jc 本机', '插件新组', '其他模型', '菠萝']), ['菠萝', '其他模型', 'jc 本机', '插件新组'])
  }
})

test('image menu puts FK images ahead of 灵动, video menu pins FK Seedance 2.5', () => {
  assert.deepEqual(families('image', ['灵动seedace2.5', '菠萝', 'FK-Image']), ['FK-Image', '灵动seedace2.5', '菠萝'])
  assert.deepEqual(families('video', ['FK · H3', '灵动seedace2.5', 'FK · Seedance 2.5']), ['FK · Seedance 2.5', '灵动seedace2.5', 'FK · H3'])
})

test('models of one family stay together in their original order', () => {
  const models = [{ family: 'Veo', id: 1 }, { family: '菠萝', id: 2 }, { family: 'Veo', id: 3 }]
  assert.deepEqual(groupCreationModels(models, 'video'), [['菠萝', [models[1]]], ['Veo', [models[0], models[2]]]])
})
