## Why

`CreationPanel.vue` 有 6463 行，界面和业务逻辑混在一起。「重新生成」的参数回填逻辑只能通过正则匹配组件源码来测试（`creationPanelContractUi.test.ts`），函数换个写法测试就失败，而真实的回填结果（模型、参数、提示词是否恢复正确）反而没有被验证。

## What Changes

- 把「用任务快照回填创作面板」的纯逻辑从 `CreationPanel.vue` 移到 `useCreation.ts`：`canRegenerateCreationTask`、`beginPlanSnapshotPrefill`、`applyPlanSnapshotParams`。
- 面板的 `regenerateTask` 只保留界面相关步骤：AI 应用节点发现、任务摘要、取消画布选择、关闭任务记录、提示文字。
- 新增行为测试直接调用这些函数，断言回填后的状态；源码正则测试改为只检查面板调用了这些函数、且不触发提交。
- 不改变回填行为。

## Capabilities

### New Capabilities
- `creation-task-prefill`: 已结束的创作任务回填到面板、且不重新提交的行为。

### Modified Capabilities
（无）

## Impact

- `src/composables/useCreation.ts`、`src/components/creation/CreationPanel.vue`、`src/composables/__tests__/useCreationPlanMaterialization.test.ts`、`src/components/__tests__/creationPanelContractUi.test.ts`。
- 这是拆分 `CreationPanel.vue` 的第一步，范围只限这一块；后续拆分另开变更。
