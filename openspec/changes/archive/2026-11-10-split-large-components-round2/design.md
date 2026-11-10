## Context

选块标准沿用上一轮：不依赖组件状态、已有测试在截取源码求值或断言写法的块优先。

## Decisions

- **模块放在组件旁边**：`projectTree.ts`、`chatModelGroups.ts` 只服务各自组件，放在同目录；创作模型分组与已有的 `creationModelFamily` 同属创作面板展示规则，放进 `creationPresentation.ts`。
- **排序模式改为参数**：`flattenVisible(root, filter, mode)` 原来读组件里的 `fileSortMode`，抽出后由调用方传入，测试无需注入响应式状态。
- **只保留接线检查**：组件侧的测试保留“调用了 `groupChatModels`/`flattenVisible(..., fileSortMode.value)`/两条加载路径调用 `sortTreeChildren`”，行为断言移到模块测试。
- **组件中剩余部分不在本变更内**：`MemoryWorkbench.vue` 的输入框菜单与提及加载、`ProjectFileTree.vue` 的右键菜单动作依赖大量组件状态，抽取需要先设计状态边界，另开变更。

## Risks / Trade-offs

- [移除的导入仍被模板使用] → `vue-tsc` 校验模板引用，`pnpm run verify` 回归。
