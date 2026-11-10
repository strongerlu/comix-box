## 1. 替换

- [x] 1.1 `documentMarkdown.test.ts` 3 个源码正则测试改为 `fetch`/`invoke` 替身的行为测试
- [x] 1.2 任务记录分页测试改为直接调用组合式函数（见 `split-large-components`）
- [x] 1.3 记录剩余源码断言清单（见 design）

## 2. 回归

- [x] 2.1 `documentMarkdown.test.ts` 通过
- [x] 2.2 `pnpm run verify` 通过
