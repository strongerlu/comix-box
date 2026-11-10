## Context

原测试截取 `const taskFilter =` 到 `function pad(` 之间的源码，用 esbuild 转译后以 `new Function` 注入 `computed/ref/watch` 求值。任何相邻代码的移动都会让截取范围失效。

## Decisions

- **先选依赖最少的块**：筛选分页只依赖任务列表和两个纯函数，抽出后无需注入组件状态。
- **组合式函数只接收 `Ref<MediaTask[]>`**：不复制任务对象，分页结果仍是原对象引用（测试断言 `===`）。
- **筛选项常量单独导出**：`CREATION_TASK_FILTERS` 是静态数据，组件以 `taskFilters` 别名使用，模板不改。
- **后续拆分不在本变更内**：`MemoryWorkbench.vue`、`ProjectFileTree.vue` 及 `CreationPanel.vue` 其他块，每次抽取都需要先有对应行为测试，另开变更。

## Risks / Trade-offs

- [组件内其他代码引用了被移走的中间值] → 已确认 `filteredCreationTasks` 只在被抽出的块内使用；`vue-tsc` 校验模板引用。
