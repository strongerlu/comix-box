## Why

`oxlint` 有 203 条警告且不影响退出码，新问题被淹没；本仓库删除死代码正是靠这些警告发现的，噪音越多越容易漏掉真问题。

## What Changes

- 执行 `oxlint --fix` 的安全修复（无用转义、展开中的空对象兜底、无用展开、`startsWith/endsWith`），逐处人工复核；`Uint8Array` 与数组比较处改用 `Array.from` 保持原语义。
- 删除未使用的 import、未使用的 catch 参数、确认无调用的私有辅助函数和局部变量。
- `pnpm run lint` 改为 `oxlint --max-warnings 88`，警告数只能减不能增。
- 保留有意写法：Vue 响应式依赖读取（`renderRevision.value;`）、遍历前拷贝数组、插件钩子签名参数、`server.mjs` 解构排除字段、`tts.ts` 的 GC 引用、生成图标脚本的 `finally` 目录校验，以及等待用户决定的未接线功能函数。

## Capabilities

### New Capabilities
- `lint-budget`: lint 警告数上限约定。

### Modified Capabilities
（无）

## Impact

- 约 45 个源文件的等价改写与删除；`package.json` 的 `lint` 脚本。
- 不改变运行时行为；由 `pnpm run verify` 回归。
