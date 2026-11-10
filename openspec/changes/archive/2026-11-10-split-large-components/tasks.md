## 1. 抽取

- [x] 1.1 先写 `useCreationTaskHistory.test.ts`（筛选、搜索、分页越界），确认模块缺失时失败
- [x] 1.2 新增 `useCreationTaskHistory.ts`，`CreationPanel.vue` 改为解构调用
- [x] 1.3 删除 `creationPanelContractUi.test.ts` 中截取源码求值的同名测试及多余 import

## 2. 回归

- [x] 2.1 新测试与 `creationPanelContractUi.test.ts` 通过
- [x] 2.2 `pnpm run verify` 通过
