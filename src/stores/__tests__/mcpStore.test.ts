import assert from 'node:assert/strict'
import test from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { useMcpStore, __setMcpStorageForTests } from '../mcpStore'

test('MCP configuration loads after storage is ready and concurrent callers share the load', async () => {
  let ready!: () => void
  const storageReady = new Promise<void>(resolve => { ready = resolve })
  let loads = 0
  __setMcpStorageForTests({ initialize: () => storageReady, load: async () => {
    loads++
    return [{ id: 'comfyui', name: 'Local GPU', command: 'comfy-mcp', transport: 'stdio', enabled: true, status: 'disconnected' }]
  } })
  try {
    setActivePinia(createPinia())
    const store = useMcpStore()
    const a = store.ensureLoaded(), b = store.ensureLoaded()
    await Promise.resolve()
    assert.equal(loads, 0)
    ready()
    await Promise.all([a, b])
    assert.equal(loads, 1)
    assert.equal(store.servers[0].name, 'Local GPU')
    assert.equal(store.enabledServers.length, 1)
  } finally { __setMcpStorageForTests(null) }
})
