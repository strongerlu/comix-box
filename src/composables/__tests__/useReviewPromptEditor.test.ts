import assert from 'node:assert/strict'
import { test } from 'node:test'
import { useReviewPromptEditor } from '../useReviewPromptEditor'

test('failed reads never become generation input and can be retried', async () => {
  let fail = true
  const editor = useReviewPromptEditor(async () => { if (fail) throw new Error('offline'); return 'actual prompt' })
  await editor.open('asset')
  assert.equal(editor.text.value, '')
  assert.match(editor.error.value, /offline/)
  editor.text.value = 'typed while failed'
  assert.equal(editor.save(() => assert.fail('must not submit')), false)
  fail = false
  await editor.open('asset')
  const submitted: unknown[] = []
  assert.equal(editor.save((id, text) => submitted.push([id, text])), true)
  assert.deepEqual(submitted, [['asset', 'actual prompt']])
})

test('loading, blank content, stale reads and closing cannot submit', async () => {
  const pending = new Map<number, (text: string) => void>()
  const editor = useReviewPromptEditor((id: number) => new Promise<string>(resolve => pending.set(id, resolve)))
  const first = editor.open(1)
  assert.equal(editor.save(() => assert.fail()), false)
  const second = editor.open(2)
  pending.get(2)!('new prompt')
  await second
  pending.get(1)!('old prompt')
  await first
  assert.equal(editor.target.value, 2)
  assert.equal(editor.text.value, 'new prompt')
  editor.text.value = '  '
  assert.equal(editor.canSave.value, false)
  const third = editor.open(3)
  editor.close()
  pending.get(3)!('cancelled prompt')
  await third
  assert.equal(editor.target.value, null)
  assert.equal(editor.text.value, '')
  assert.equal(editor.canSave.value, false)
})
