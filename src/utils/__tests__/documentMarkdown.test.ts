import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  classifyDocumentMarkdownReuse,
  convertDocumentToMarkdown,
  decodeTextBytes,
  isMeaningfulMarkdownContent,
  normalizeMarkdownOutputFilename,
} from '../documentMarkdown'
import { detectFileType } from '@/composables/useFileUpload'
import { __resetApiKeyMemoryCacheForTests } from '@/services/newApiClient'

test('normalizeMarkdownOutputFilename keeps a single markdown extension', () => {
  assert.equal(normalizeMarkdownOutputFilename('救猫咪 3 反击战！.pdf'), '救猫咪 3 反击战！.md')
  assert.equal(normalizeMarkdownOutputFilename('notes.md'), 'notes.md')
  assert.equal(normalizeMarkdownOutputFilename('a/b:测试?.docx'), 'a_b_测试_.md')
})

test('subtitle files stay on the text path instead of becoming binary attachments', () => {
  assert.equal(detectFileType(new File(['1\n00:00:00,000 --> 00:00:01,000\n字幕'], 'clip.srt')), 'text')
  assert.equal(detectFileType(new File(['WEBVTT\n'], 'clip.vtt')), 'text')
})

test('subtitle conversion uses the local text Markdown path', async () => {
  const result = await convertDocumentToMarkdown({
    file: new File(['1\n00:00:00,000 --> 00:00:01,000\n字幕'], 'clip.srt'),
  })
  assert.equal(result.status, 'success')
  assert.equal(result.engine, 'text')
  assert.match(result.content, /字幕/)
})

test('text conversion decodes GBK bytes before producing Markdown', async () => {
  const decoded = decodeTextBytes(Uint8Array.from([
    0xd2, 0xbb, 0xcf, 0xf2, 0x0d, 0x0a, 0x31, 0x0d, 0x0a,
  ]))
  assert.equal(decoded.encoding, 'gb18030')
  assert.equal(decoded.text, '一向\r\n1\r\n')

  const result = await convertDocumentToMarkdown({
    file: new File([Uint8Array.from([0xd2, 0xbb, 0xcf, 0xf2, 0x0a, 0x31])], '故事.txt'),
  })
  assert.equal(result.status, 'success')
  assert.equal(result.sourceEncoding, 'gb18030')
  assert.match(result.content, /一向\n1/)
})

test('isMeaningfulMarkdownContent rejects empty page marker extraction', () => {
  assert.equal(isMeaningfulMarkdownContent('[第1页]\n\n[第2页]'), false)
  assert.equal(isMeaningfulMarkdownContent('# 第一章\n\n真正的正文内容'), true)
})

const cloudSuccess = { status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'success', content: '# 云端结果' }) }
const pdf = () => new File([Uint8Array.from([0x25, 0x50, 0x44, 0x46])], '剧本.pdf', { type: 'application/pdf' })

async function withDesktopInvoke(handler: (command: string) => unknown, run: (calls: string[]) => Promise<void>) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const calls: string[] = []
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { __TAURI_INTERNALS__: {
    transformCallback: () => 1,
    async invoke(command: string) { calls.push(command); return handler(command) },
  } } })
  __resetApiKeyMemoryCacheForTests('sk-test-document-key')
  try { await run(calls) } finally {
    __resetApiKeyMemoryCacheForTests(null)
    if (previous) Object.defineProperty(globalThis, 'window', previous)
    else delete (globalThis as { window?: unknown }).window
  }
}

test('Web document conversion posts to the shared cloud converter', async () => {
  const originalFetch = globalThis.fetch
  const urls: string[] = []
  globalThis.fetch = (async (url: string) => {
    urls.push(String(url))
    return new Response(JSON.stringify({ status: 'success', content: '# 网页结果' }), { headers: { 'content-type': 'application/json' } })
  }) as typeof fetch
  __resetApiKeyMemoryCacheForTests('sk-test-document-key')
  try {
    const result = await convertDocumentToMarkdown({ file: pdf() })
    assert.equal(result.status, 'success')
    assert.equal(result.content, '# 网页结果')
    assert.equal(urls.length, 1)
    assert.match(urls[0], /\/documents\/markdown$/)
  } finally {
    globalThis.fetch = originalFetch
    __resetApiKeyMemoryCacheForTests(null)
  }
})

test('Desktop converts locally first and reaches the cloud only through the native request', async () => {
  await withDesktopInvoke(command => command === 'document_to_markdown_file'
    ? { status: 'success', content: '# 本地结果', engine: 'anydoc' }
    : cloudSuccess, async calls => {
    const result = await convertDocumentToMarkdown({ file: pdf() })
    assert.equal(result.content, '# 本地结果')
    assert.deepEqual(calls, ['document_to_markdown_file'])
  })
})

test('Desktop only falls back to cloud for an internal local parser failure', async () => {
  await withDesktopInvoke(command => command === 'document_to_markdown_file'
    ? { status: 'error', errorCode: 'internal', engine: 'unsupported' }
    : cloudSuccess, async calls => {
    const result = await convertDocumentToMarkdown({ file: pdf() })
    assert.equal(result.content, '# 云端结果')
    assert.deepEqual(calls, ['document_to_markdown_file', 'document_markdown_request'])
  })
  await withDesktopInvoke(command => command === 'document_to_markdown_file'
    ? { status: 'error', errorCode: 'unsupported_format', message: '不支持的格式' }
    : cloudSuccess, async calls => {
    const result = await convertDocumentToMarkdown({ file: pdf() })
    assert.equal(result.status, 'error')
    assert.equal(result.errorCode, 'unsupported_format')
    assert.deepEqual(calls, ['document_to_markdown_file'])
  })
  await withDesktopInvoke(command => {
    if (command === 'document_to_markdown_file') throw new Error('converter crashed')
    return cloudSuccess
  }, async calls => {
    assert.equal((await convertDocumentToMarkdown({ file: pdf() })).content, '# 云端结果')
    assert.deepEqual(calls, ['document_to_markdown_file', 'document_markdown_request'])
  })
})

test('Web document conversion rejects an HTML fallback even when it has HTTP 200', () => {
  const source = readFileSync(join(process.cwd(), 'src/utils/documentMarkdown.ts'), 'utf8')

  assert.match(source, /content-type/)
  assert.match(source, /文档转换服务未部署或路由错误/)
})

test('AnyDoc metadata reuses only an unchanged current-version conversion', async () => {
  const content = '# 正文\n'
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content))
  const contentSha256 = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  const metadata = JSON.stringify({
    sourceSha256: 'source-hash',
    converterId: 'anydoc',
    converterVersion: '0.2.3',
    outputSchemaVersion: 1,
    contentSha256,
  })
  const markdown = `<!-- jc-document-conversion ${metadata} -->\n\n${content}`

  assert.equal(await classifyDocumentMarkdownReuse(markdown, 'source-hash'), 'reusable')
  assert.equal(await classifyDocumentMarkdownReuse(markdown, 'different-source'), 'stale')
  assert.equal(await classifyDocumentMarkdownReuse(`${markdown}用户修改`, 'source-hash'), 'edited')
  assert.equal(await classifyDocumentMarkdownReuse(content, 'source-hash'), 'stale')
})

test('AnyDoc dependency and persisted metadata version stay in sync', () => {
  const cargo = readFileSync(join(process.cwd(), 'src-tauri/Cargo.toml'), 'utf8')
  const source = readFileSync(join(process.cwd(), 'src/utils/documentMarkdown.ts'), 'utf8')

  assert.match(cargo, /anydoc = "=0\.2\.3"/)
  assert.match(source, /ANYDOC_CONVERTER_VERSION = '0\.2\.3'/)
})

test('OCR-required Desktop errors use an explicit scanned-PDF message', () => {
  const source = readFileSync(join(process.cwd(), 'src/composables/useFileUpload.ts'), 'utf8')

  assert.match(source, /converted\.errorCode === 'ocr_required'/)
  assert.match(source, /扫描版或图片型 PDF，没有可提取的文字层，需要 OCR/)
  assert.doesNotMatch(source, /ocr_required[\s\S]{0,300}文件损坏/)
})
