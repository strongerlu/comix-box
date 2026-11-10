## Context

警告分布（清理前 203 条）：未使用变量 89、无用转义 33、展开空兜底 30、无用表达式 11、控制字符正则 11、无用展开 10、可用 startsWith/endsWith 10、可疑可选链 6、其他 3。

## Decisions

- **自动修复只用 `--fix`（安全修复）**，不用 suggestion 级修复；逐行复核 diff。发现一处语义变化：`assert.deepEqual([...u8.slice()], arr)` 被改成直接比较 `Uint8Array`，严格比较会失败，改为 `Array.from`。
- **可疑项逐一核实**：`no-unsafe-optional-chaining` 6 处均在测试断言中；`assetScheduler.ts` 的 `?.image_path!` 在所有提交路径前都有就绪检查，不是缺陷；`no-unused-expressions` 是 Vue 依赖收集与三元调用写法。
- **上限而非清零**：剩余 88 条多为有意写法或需用户决定的功能代码，用 `--max-warnings 88` 锁住，后续清理时同步下调。

## Risks / Trade-offs

- [上限需手动下调] → 清理警告的变更同时修改上限；数值写在 `package.json` 一处。
