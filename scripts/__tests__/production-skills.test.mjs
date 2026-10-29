import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'node:http'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { DeepSeekHarness } from '../../src-tauri/resources/deepseek-harness/node_modules/@deepseek-ai/dsh-sdk-client/lib/index.js'

async function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'jc-production-scope-'))
  const groups = { manju: ['jc-seedance', 'h3-prompt-writing'], 'short-drama': ['jc-duanju-xiezuo'], novel: ['jc-novel'] }
  writeFileSync(join(root, 'production-skills.json'), JSON.stringify(groups))
  cpSync('public/skills/wiki-native', join(root, 'wiki-native'), { recursive: true })
  cpSync('public/skills/wiki-artifacts.json', join(root, 'wiki-artifacts.json'))
  for (const name of Object.values(groups).flat()) {
    mkdirSync(join(root, name))
    writeFileSync(join(root, name, 'SKILL.md'), `---\nname: ${name}\ndescription: Use ${name} for its business task.\n---\nBODY_${name}\n`)
  }
  const local = join(root, '.dsh/skills/outside')
  mkdirSync(local, { recursive: true })
  writeFileSync(join(local, 'SKILL.md'), '---\nname: outside\ndescription: OUTSIDE_CATALOG\n---\nOUTSIDE_BODY\n')
  const requests = []
  let callSkill
  let onRequest
  const http = createServer(async (req, res) => {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const body = JSON.parse(Buffer.concat(chunks).toString())
    requests.push(body)
    res.writeHead(200, { 'Content-Type': 'text/event-stream' })
    if (onRequest && await onRequest(body, res, requests.length)) return
    const delta = callSkill ? { role: 'assistant', tool_calls: [{ index: 0, id: 'load-skill', type: 'function', function: { name: 'skill', arguments: JSON.stringify({ name: callSkill }) } }] } : { role: 'assistant', content: 'OK' }
    const finish = callSkill ? 'tool_calls' : 'stop'
    callSkill = undefined
    for (const [d, f] of [[delta, null], [{}, finish]]) res.write(`data: ${JSON.stringify({ id: 'test', object: 'chat.completion.chunk', model: 'test', choices: [{ index: 0, delta: d, finish_reason: f }] })}\n\n`)
    res.end('data: [DONE]\n\n')
  })
  await new Promise(resolve => http.listen(0, '127.0.0.1', resolve))
  const patch = join(root, 'route.yml')
  writeFileSync(patch, `- id: llm-pi-ai\n  config:\n    providers:\n      jiucaihezi:\n        apiKeyEnv: JIUCAIHEZI_DH_API_KEY\n        api: openai-completions\n        baseURL: http://127.0.0.1:${http.address().port}/v1\n        models:\n          - id: test\n            contextWindow: 262144\n            maxTokens: 1024\n`)
  const options = { cwd: root, processCwd: root, dshHome: join(root, 'home'), patches: [patch], provider: 'jiucaihezi', model: 'test', env: { ...process.env, DSH_BUNDLED_SKILL_DIR: root, DSH_AGENTS_HOME: join(root, 'agents'), DSH_PRIMARY_RUNTIME: '', JIUCAIHEZI_DH_API_KEY: 'local-test' } }
  let harness = new DeepSeekHarness(options)
  t.after(async () => { await harness.close(); http.closeAllConnections(); await new Promise(resolve => http.close(resolve)); rmSync(root, { recursive: true, force: true }) })
  return {
    root, requests, groups, options,
    set skill(value) { callSkill = value },
    set onRequest(value) { onRequest = value },
    get harness() { return harness },
    async restart() { await harness.close(); harness = new DeepSeekHarness(options) },
    async run(sessionId, mode, text = 'do the current task', skill) {
      await harness.start()
      callSkill = skill
      const { messageId } = await harness.client.request('session/prompt', { sessionId, productionMode: mode, contentBlocks: [{ type: 'text', text }] })
      await harness.client.request('session/wait', { sessionId })
      return messageId
    },
  }
}

const catalog = request => request.messages.filter(m => typeof m.content === 'string' && m.content.includes('<available_skills>')).at(-1)?.content || ''

test('first request keeps the actual user task after the skill catalog instead of asking the model to acknowledge guidance', { timeout: 30000 }, async t => {
  const f = await fixture(t)
  const task = 'FIRST_REAL_TASK: read the current project and complete the requested artifact'
  await f.run('fresh-task', 'manju', task)
  const request = f.requests[0]
  const users = request.messages.filter(message => message.role === 'user')
  const lastUser = typeof users.at(-1)?.content === 'string' ? users.at(-1).content : JSON.stringify(users.at(-1)?.content)
  assert.match(lastUser, /FIRST_REAL_TASK:/)
  assert.match(catalog(request), /jc-seedance/)
  assert.ok(request.tools.some(tool => tool.function.name === 'skill'))
})

test('catalog replacement, cold recovery and explicit Skill loading preserve the current task as the final user input', { timeout: 60000 }, async t => {
  const f = await fixture(t)
  for (const [mode, marker] of [['none', 'ORDINARY_TASK'], ['manju', 'MANJU_TASK'], ['novel', 'NOVEL_TASK']]) {
    const index = f.requests.length
    await f.run('scope-order', mode, `${marker}: complete this task`)
    const last = f.requests[index].messages.filter(message => message.role === 'user').at(-1)
    assert.match(JSON.stringify(last.content), new RegExp(marker))
  }
  await f.restart()
  await f.run('scope-order', 'short-drama', 'RECOVERED_TASK: continue from saved project files')
  assert.match(JSON.stringify(f.requests.at(-1).messages.filter(message => message.role === 'user').at(-1).content), /RECOVERED_TASK/)
  await f.run('explicit-task', 'manju', '/jc-seedance EXPLICIT_TASK: write the requested scene')
  const users = f.requests.at(-1).messages.filter(message => message.role === 'user')
  assert.match(JSON.stringify(users.at(-1).content), /EXPLICIT_TASK/)
  assert.match(JSON.stringify(users.slice(0, -1)), /BODY_jc-seedance/)
  const { events } = await f.harness.client.request('session/read', { sessionId: 'explicit-task' })
  assert.equal(events.filter(event => event.type === 'user/message' && event.data.source.kind === 'skill-invocation').length, 1)
})

test('production buttons expose only the whitelist through the official catalog and loader, without invoking a router', { timeout: 30000 }, async t => {
  const f = await fixture(t)
  await f.run('creative', 'manju')
  assert.doesNotMatch(catalog(f.requests.at(-1)), /outside/)
  assert.match(catalog(f.requests.at(-1)), /jc-seedance/)
  assert.doesNotMatch(JSON.stringify(f.requests.at(-1).messages), /BODY_|jc-manju-zhizuo|\/jc-duanju/)
  assert.ok(f.requests.at(-1).tools.some(tool => tool.function.name === 'skill'))
  await f.run('creative', 'manju', 'load the required skill', 'jc-seedance')
  assert.match(JSON.stringify(f.requests.at(-1).messages.filter(m => m.role === 'tool')), /BODY_jc-seedance/)
  await f.run('creative', 'manju', 'try an unavailable skill', 'outside')
  assert.doesNotMatch(JSON.stringify(f.requests.at(-1).messages.filter(m => m.role === 'tool')), /OUTSIDE_BODY/)
  await f.run('ordinary', 'none')
  assert.match(catalog(f.requests.at(-1)), /outside/)
  await f.restart()
  await f.run('creative', 'novel')
  assert.match(catalog(f.requests.at(-1)), /jc-novel/)
  assert.doesNotMatch(catalog(f.requests.at(-1)), /jc-seedance|outside/)
})

async function waitFor(predicate) {
  const deadline = Date.now() + 10000
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('timed out waiting for production-scope trace')
    await new Promise(resolve => setTimeout(resolve, 10))
  }
}

for (const individual of [false, true]) {
  test(`queued scope survives edit, cancellation and cold restart without following later UI state (${individual ? 'individual' : 'production'})`, { timeout: 30000 }, async t => {
    const f = await fixture(t)
    const gate = Promise.withResolvers()
    f.onRequest = async (_request, res, count) => {
      if (count === 1) { res.flushHeaders(); await gate.promise }
      return false
    }
    await f.harness.start()
    const client = f.harness.client
    assert.deepEqual(await client.request('session/runtime-busy', {}), { busy: false })
    const send = (mode, text) => client.request('session/prompt', { sessionId: 'queue', productionMode: mode, contentBlocks: [{ type: 'text', text }] })
    try {
      await send((individual ? 'skills:jc-seedance' : 'manju'), 'first task')
      await waitFor(() => f.requests.length === 1)
      assert.deepEqual(await client.request('session/runtime-busy', {}), { busy: true })
      const queued = await send((individual ? 'skills:jc-novel' : 'novel'), 'queued novel')
      const discarded = await send('short-drama', 'discard me')
      await client.request('session/update-queue', { sessionId: 'queue', itemId: discarded.messageId, action: { kind: 'remove' } })
      await client.request('session/update-queue', { sessionId: 'queue', itemId: queued.messageId, action: { kind: 'edit', content: [{ type: 'text', text: 'edited queued novel' }] } })
      await assert.rejects(client.request('session/update-queue', { sessionId: 'queue', itemId: queued.messageId, action: { kind: 'steer' } }), /不同的创作能力范围/)
      await client.request('session/cancel', { sessionId: 'queue' })
      const before = (await client.request('session/read', { sessionId: 'queue' })).events
      const pending = before.filter(e => e.type === 'agent/inbox/spliced').flatMap(e => e.data.inserted).findLast(m => m.id === queued.messageId)
      assert.equal(pending.source.productionMode, (individual ? 'skills:jc-novel' : 'novel'))
      gate.resolve()
      await f.restart()
      await f.run('queue', 'short-drama', 'later task')
      const novel = f.requests.find(r => JSON.stringify(r.messages).includes('edited queued novel'))
      assert.match(catalog(novel), /jc-novel/)
      assert.doesNotMatch(catalog(novel), /jc-seedance|outside/)
      await waitFor(() => f.requests.length === 3)
      assert.match(catalog(f.requests.at(-1)), /jc-duanju-xiezuo/)
      assert.equal(f.requests.length, 3)
      const after = (await f.harness.client.request('session/read', { sessionId: 'queue' })).events
      assert.deepEqual(after.slice(0, before.length), before, 'restart must preserve every accepted historical event')
    } finally { gate.resolve() }
  })

  test(`simultaneous sessions isolate Skill circles and only ordinary scopes can delegate (${individual ? 'individual' : 'production'})`, { timeout: 30000 }, async t => {
    const f = await fixture(t)
    const gate = Promise.withResolvers()
    let delegated = false
    f.onRequest = async (request, res, count) => {
      if (count === 1) { res.flushHeaders(); await gate.promise }
      const lastUser = request.messages.filter(m => m.role === 'user').at(-1)
      if (!delegated && JSON.stringify(lastUser).includes('DELEGATE_CURRENT')) {
        delegated = true
        const delta = { role: 'assistant', tool_calls: [{ index: 0, id: 'delegate', type: 'function', function: { name: 'subagent', arguments: JSON.stringify({ description: 'Check child scope', prompt: 'CHILD_SCOPE_CHECK' }) } }] }
        res.end(`data: ${JSON.stringify({ id: 'delegate', object: 'chat.completion.chunk', model: 'test', choices: [{ index: 0, delta, finish_reason: 'tool_calls' }] })}\n\ndata: [DONE]\n\n`)
        return true
      }
      return false
    }
    const first = f.run('one', (individual ? 'skills:jc-seedance' : 'manju'), 'first parallel task')
    try {
      await waitFor(() => f.requests.length === 1)
      await f.run('two', (individual ? 'skills:jc-novel' : 'novel'), 'second parallel task')
      assert.match(catalog(f.requests.at(-1)), /jc-novel/)
      gate.resolve()
      await first
      assert.match(catalog(f.requests[0]), /jc-seedance/)
      await f.run('one', (individual ? 'skills:jc-seedance' : 'manju'), 'DELEGATE_CURRENT')
      const child = f.requests.find(r => r.messages.some(m => m.role === 'user' && JSON.stringify(m.content).includes('CHILD_SCOPE_CHECK')))
      if (individual) {
        assert.ok(child, 'the official subagent must actually issue a child model request')
        assert.match(catalog(child), /jc-seedance/)
        assert.doesNotMatch(catalog(child), /outside|jc-novel|h3-prompt-writing/)
      } else {
        assert.equal(child, undefined, 'production must reject delegation before creating a child')
        assert.ok(!f.requests.at(-1).tools.some(t => t.function.name === 'subagent'))
        assert.match(JSON.stringify(f.requests.at(-1).messages.filter(m => m.role === 'tool')), /Error:/)
      }
    } finally { gate.resolve(); await first }
  })

}

test('repeated mode selection does not invoke routers or republish an unchanged official catalog', { timeout: 30000 }, async t => {
  const f = await fixture(t)
  for (let i = 0; i < 15; i++) await f.run('long', 'manju', `turn ${i}`)
  const { events } = await f.harness.client.request('session/read', { sessionId: 'long' })
  assert.equal(events.filter(e => e.type === 'user/message' && e.data.source.kind === 'skill-catalog').length, 1)
  assert.equal(events.filter(e => e.type === 'user/message' && e.data.source.kind === 'skill-invocation').length, 0)
  assert.equal(f.requests.length, 15)
  assert.doesNotMatch(JSON.stringify(f.requests.at(-1)), /BODY_|cua_driver_native__/)
  await assert.rejects(f.harness.client.request('session/prompt', { sessionId: 'long', productionMode: 'invalid', contentBlocks: [{ type: 'text', text: 'never send' }] }), /未知创作/)
  assert.equal(f.requests.length, 15)
})


test('official discovery and loading observe updated bundled metadata and body without loading others', { timeout: 30000 }, async t => {
  const f = await fixture(t)
  await f.run('edits', 'manju')
  const file = join(f.root, 'jc-seedance', 'SKILL.md')
  writeFileSync(file, readFileSync(file, 'utf8').replace('Use jc-seedance for its business task.', 'UPDATED_DISCOVERY').replace('BODY_jc-seedance', 'UPDATED_BODY'))
  // The official filesystem watcher owns its invalidation/debounce, not an App content cache.
  await new Promise(resolve => setTimeout(resolve, 700))
  await f.run('edits', 'manju', 'use the edited skill', 'jc-seedance')
  assert.match(catalog(f.requests.at(-1)), /UPDATED_DISCOVERY/)
  assert.match(JSON.stringify(f.requests.at(-1).messages.filter(m => m.role === 'tool')), /UPDATED_BODY/)
  assert.doesNotMatch(JSON.stringify(f.requests.at(-1).messages), /BODY_h3-prompt-writing/)
})


test('the original official loader and production whitelist keep identical tool schema, catalog and Skill body', { timeout: 30000 }, async t => {
  const official = process.env.DSH_OFFICIAL_CONTROL_SERVER
  if (!official) return t.skip('set DSH_OFFICIAL_CONTROL_SERVER to the pristine pinned SDK module')
  const f = await fixture(t)
  await f.run('app-comparison', 'manju', 'load the requested skill', 'jc-seedance')
  const appFirst = f.requests[0], appLast = f.requests.at(-1)
  const directory = join(f.root, 'official-skills')
  mkdirSync(directory)
  for (const name of f.groups.manju) cpSync(join(f.root, name), join(directory, name), { recursive: true })
  const controlPatch = join(f.root, 'official.yml')
  writeFileSync(controlPatch, `- id: sdk-jsonrpc-server\n  name: ${JSON.stringify(official)}\n- id: skill-filesystem\n  config:\n    includeDefaultRoots: false\n    bundledSkillDir: ${JSON.stringify(directory)}\n`)
  const control = new DeepSeekHarness({ ...f.options, dshHome: join(f.root, 'official-home'), patches: [...f.options.patches, controlPatch] })
  try {
    f.skill = 'jc-seedance'
    const start = f.requests.length
    await control.session('official-comparison').run('load the requested skill')
    const controlFirst = f.requests[start], controlLast = f.requests.at(-1)
    assert.deepEqual(appFirst.tools.find(t => t.function.name === 'skill'), controlFirst.tools.find(t => t.function.name === 'skill'))
    assert.equal(catalog(appFirst), catalog(controlFirst))
    const body = request => request.messages.filter(m => m.role === 'tool').map(m => typeof m.content === 'string' ? m.content : JSON.stringify(m.content)).join('\n')
    assert.match(body(appLast), /BODY_jc-seedance/)
    assert.match(body(controlLast), /BODY_jc-seedance/)
    assert.equal(body(appLast).replaceAll(f.root, '<ROOT>').replaceAll('jiucaihezi-production', '<PROVIDER>'), body(controlLast).replaceAll(directory, '<ROOT>').replaceAll('filesystem', '<PROVIDER>'))
  } finally { await control.close() }
})


test('individual Skill selection is a singleton whitelist with official lazy loading and cold recovery', { timeout: 30000 }, async t => {
  const f = await fixture(t)
  await f.run('single', 'skills:jc-seedance')
  assert.match(catalog(f.requests.at(-1)), /jc-seedance/)
  assert.doesNotMatch(catalog(f.requests.at(-1)), /h3-prompt-writing|outside|jc-novel/)
  assert.doesNotMatch(JSON.stringify(f.requests.at(-1).messages), /BODY_|\/jc-seedance/)
  await f.run('single', 'skills:jc-seedance', 'load this skill', 'jc-seedance')
  assert.match(JSON.stringify(f.requests.at(-1).messages.filter(m => m.role === 'tool')), /BODY_jc-seedance/)
  await f.run('single', 'skills:jc-seedance', 'try another skill', 'h3-prompt-writing')
  assert.doesNotMatch(JSON.stringify(f.requests.at(-1).messages.filter(m => m.role === 'tool')), /BODY_h3-prompt-writing/)
  await f.restart()
  await f.harness.start()
  await f.harness.client.request('session/resume', { sessionId: 'single' })
  await f.harness.client.request('session/prompt', { sessionId: 'single', contentBlocks: [{ type: 'text', text: 'continue recovered task' }] })
  await f.harness.client.request('session/wait', { sessionId: 'single' })
  assert.match(catalog(f.requests.at(-1)), /jc-seedance/)
  assert.doesNotMatch(catalog(f.requests.at(-1)), /h3-prompt-writing|outside/)
  await f.run('personal', 'skills:outside', 'load selected project skill', 'outside')
  assert.match(catalog(f.requests.at(-1)), /outside/)
  assert.doesNotMatch(catalog(f.requests.at(-1)), /jc-seedance|jc-novel/)
  assert.match(JSON.stringify(f.requests.at(-1).messages.filter(m => m.role === 'tool')), /OUTSIDE_BODY/)
  await f.run('single', 'none')
  assert.match(catalog(f.requests.at(-1)), /outside/)
})

test('creative tools cannot overwrite computed pipeline checkpoints, while manuscript edits remain allowed', { timeout: 30000 }, async t => {
  const f = await fixture(t)
  const workspace = mkdtempSync(join(tmpdir(), 'jc-checkpoint-guard-'))
  t.after(() => rmSync(workspace, { recursive: true, force: true }))
  f.options.cwd = workspace
  f.options.processCwd = workspace
  await f.restart()
  await f.harness.start()
  for (const [index, scenario] of [
    { path: 'wiki/制作流水线/H3/第1集进度.json', tool: 'write', protected: true },
    { path: 'wiki/改编方案/执行进度.json', tool: 'edit', protected: true },
    { path: 'wiki/剧本/第一集.md', tool: 'write', protected: false },
  ].entries()) {
    const target = join(workspace, scenario.path)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, 'original')
    const sessionId = 'computed-progress-' + index
    await f.harness.client.request('session/permission', { sessionId, preset: 'workspace-write' })
    let step = 0
    f.onRequest = async (_request, res) => {
      if (++step > 2) return false
      const name = step === 1 ? 'read' : scenario.tool
      const args = step === 1 ? { file_path: target }
        : scenario.tool === 'write' ? { file_path: target, content: 'changed' }
          : { file_path: target, old_string: 'original', new_string: 'changed' }
      const delta = { role: 'assistant', tool_calls: [{ index: 0, id: 'guard-' + step, type: 'function', function: { name, arguments: JSON.stringify(args) } }] }
      res.end(`data: ${JSON.stringify({ id: 'guard', object: 'chat.completion.chunk', model: 'test', choices: [{ index: 0, delta, finish_reason: 'tool_calls' }] })}\n\ndata: [DONE]\n\n`)
      return true
    }
    const start = f.requests.length
    await f.run(sessionId, 'manju', 'update this project file')
    assert.equal(readFileSync(target, 'utf8'), scenario.protected ? 'original' : 'changed')
    const results = JSON.stringify(f.requests.slice(start).flatMap(r => r.messages.filter(m => m.role === 'tool')))
    if (scenario.protected) assert.match(results, /进度文件.*wiki_save_artifact/)
  }
})
