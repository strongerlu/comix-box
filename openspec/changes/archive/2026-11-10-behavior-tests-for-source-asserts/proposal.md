## Why

测试中有约 186 处读取源码再用正则断言实现细节。`oxlint --fix` 做等价改写时就打断了 4 个这类测试，而真实行为错了它们却未必发现。

## What Changes

- 本次把 `documentMarkdown.test.ts` 中 3 个源码正则测试改为行为测试：模拟 `fetch` 与 Tauri `invoke`，断言 Web 走云端、桌面先本地转换、只有本地内部故障才回退云端。
- 其余源码断言按文件渐进替换，每次替换随相关改动或单独变更进行；本变更记录清单，不一次性改完。

## Capabilities

### New Capabilities
- `document-markdown-routing`: 文档转 Markdown 的本地与云端路由行为。

### Modified Capabilities
（无）

## Impact

- 仅改测试文件；不改变运行时代码。
