## Why

上一轮只从 `CreationPanel.vue` 抽出了任务记录分页。`MemoryWorkbench.vue`、`ProjectFileTree.vue` 里同样有纯逻辑被测试截取源码求值或用正则断言写法，组件一改就断。

## What Changes

- `ProjectFileTree.vue` 的建树、搜索树、拼音模糊筛选、展开视图与排序移到 `src/components/filetree/projectTree.ts`；`flattenVisible` 改为显式接收排序模式，不再读组件状态。
- `MemoryWorkbench.vue` 的对话模型分组与内部媒体模型过滤移到 `src/components/memory/chatModelGroups.ts`；删除已无调用的 `providerConfig` 导入。
- `CreationPanel.vue` 的创作模型分组排序表移到 `creationPresentation.ts` 的 `groupCreationModels`。
- 为三个模块新增行为测试；删除或收窄对应的源码截取与写法正则断言，只保留“组件调用了模块”的接线检查。

## Capabilities

### New Capabilities
- `project-tree-view`: 文件树建树、筛选与显示排序。
- `model-menu-grouping`: 对话与创作模型菜单的分组顺序。

### Modified Capabilities
（无）

## Impact

- 三个组件共减少约 390 行；新增 3 个模块与 3 个测试文件，登记到 `scripts/run-focused-tests.mjs`。
- 不改变界面与行为。
