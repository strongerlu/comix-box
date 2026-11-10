## 1. 抽取

- [x] 1.1 先写 `projectTree.test.ts`、`chatModelGroups.test.ts`、`creationModelGroups.test.ts`，确认模块缺失时失败
- [x] 1.2 新增 `projectTree.ts`，`ProjectFileTree.vue` 改为导入
- [x] 1.3 新增 `chatModelGroups.ts`，`MemoryWorkbench.vue` 改为导入并删除无用 `providerConfig` 导入
- [x] 1.4 `creationPresentation.ts` 新增 `groupCreationModels`，`CreationPanel.vue` 改为调用
- [x] 1.5 删除或收窄原组件测试中的源码截取与写法断言

## 2. 回归

- [x] 2.1 新测试与相关组件测试、`vue-tsc`、lint 通过
- [x] 2.2 `pnpm run verify` 通过
