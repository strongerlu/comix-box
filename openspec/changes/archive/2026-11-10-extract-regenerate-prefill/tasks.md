## 1. 行为测试

- [x] 1.1 在 `useCreationPlanMaterialization.test.ts` 增加回填测试：可回填判定、本地视频参数、参考素材提示、AI 应用字段

## 2. 抽取

- [x] 2.1 在 `useCreation.ts` 新增 `canRegenerateCreationTask`、`beginPlanSnapshotPrefill`、`applyPlanSnapshotParams`
- [x] 2.2 `CreationPanel.vue` 的 `canRegenerateTask`、`regenerateTask` 改为调用新函数，只保留界面步骤
- [x] 2.3 `creationPanelContractUi.test.ts` 的源码断言改为检查新调用与不提交

## 3. 验证

- [x] 3.1 相关测试通过；typecheck 与全量 focused 在 `pnpm run verify` 中执行
