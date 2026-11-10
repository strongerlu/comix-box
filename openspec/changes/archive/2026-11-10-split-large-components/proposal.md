## Why

`CreationPanel.vue` 6699 行、`MemoryWorkbench.vue` 6147 行、`ProjectFileTree.vue` 4531 行。纯逻辑埋在组件里只能靠截取源码再 `new Function` 求值来测，组件一改测试就断，也看不清依赖。

## What Changes

- 按“一次抽一块、带行为测试”的方式渐进拆分，不做一次性大重构。
- 本次先抽出创作任务记录的筛选、搜索与分页：新增 `src/composables/useCreationTaskHistory.ts`，`CreationPanel.vue` 改为解构调用，模板不变。
- 新增 `src/composables/__tests__/useCreationTaskHistory.test.ts` 直接调用组合式函数；删除 `creationPanelContractUi.test.ts` 中截取源码求值的同名测试。

## Capabilities

### New Capabilities
- `creation-task-history`: 创作任务记录的筛选、搜索与分页行为。

### Modified Capabilities
（无）

## Impact

- `CreationPanel.vue` 减少约 25 行；新增一个组合式函数与测试文件，登记到 `scripts/run-focused-tests.mjs`。
- 不改变界面与行为；后续拆分沿用同一做法另开变更。
