## Context

`regenerateTask`（`CreationPanel.vue`）直接操作 `useCreation.ts` 导出的 `cpState`、`switchTask`、`switchModel`、`setAspect` 等。其中只有 AI 应用节点发现（`handleDiscoverAiApp`）、任务摘要变量、画布选择和任务记录弹层属于面板自身。`useCreation.ts` 不依赖 `mediaTaskStore`，只需类型导入。

## Goals / Non-Goals

**Goals:**
- 回填逻辑可在 Node 测试中直接调用并断言结果。
- 行为与拆分前一致。

**Non-Goals:**
- 不拆分面板其他部分，不调整 UI。
- 不改变 AI 应用节点发现的实现。

## Decisions

- **分两步函数而非一个函数**：AI 应用必须先写入应用 ID 和输出类型，再由面板异步发现节点，之后才能写入节点字段值。`beginPlanSnapshotPrefill` 负责第一段并返回是否为 AI 应用，`applyPlanSnapshotParams` 负责其余参数；面板在两者之间调用节点发现。备选「传入回调」会让组合式函数依赖面板实现。
- **放在 `useCreation.ts`**：所有被操作的状态都在这里定义；新建文件只会增加跨文件依赖。
- **保存时机不变**：`saveCpState()` 仍由面板在处理完画布选择后调用一次。

## Risks / Trade-offs

- [源码正则测试与新结构不一致] → 同步改为检查面板调用新函数、且仍不包含 `submitTask`。
- [移动时遗漏某个字段] → 行为测试覆盖本地视频、参考素材与 AI 应用三条路径，全量 focused 回归兜底。
