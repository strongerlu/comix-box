## Context

剩余大块与组件状态交织：菜单需要输入框焦点，提及需要当前项目、会话、MCP 与路线选择，剪贴板需要文件变更流，媒体编号需要文件服务、任务记录和右键菜单目标。

## Goals / Non-Goals

**Goals:** 每块能脱离组件挂载单独测试；组件只负责接线。

**Non-Goals:** 不改界面与文案；不拆跨领域动作。

## Decisions

状态分三层：

1. **纯规则**（无 Vue）：`resourceClipboard.ts`、`composerMentions.ts` 的候选规则。输入输出都是普通数据。
2. **交互组合式函数**：`useComposerMenus`、`useMediaReorder`。自有 ref；外部状态通过读取函数获取（如 `owner()`、`isMenuTarget(path)`），写回只通过回调（如 `setError`、`setStatus`），不直接引用组件 ref 或 store。
3. **组件**：持有共享状态（会话、选区、项目、`errorMsg`/`statusMsg`），以及跨领域动作。下列动作留在组件：`selectMention`（改输入框文本和附件）、`choosePermission`、`chooseManjuMode`、`chooseComposerSkill`（改会话与路线）、`handleGlobalKeydown`（全局快捷键）、`ctxPasteResources`（涉及画布保存生命周期）。

选择读取函数而不是传 ref：调用方可在测试里直接传普通值，项目切换等竞态也能由组合式函数在 await 之后重新读取判断。

## Risks / Trade-offs

- 组件内仍有接线代码，靠少量接线断言防止漏接。
- `focusComposerMenu` 在 `nextTick` 后访问 `document`，测试需等待 `nextTick` 后再恢复全局对象。
