## Why

上一轮拆分后，`MemoryWorkbench.vue` 与 `ProjectFileTree.vue` 里剩下的大块（输入框菜单、@ 提及候选加载、资源剪贴板、媒体排序编号）都直接读写组件状态，只能通过源码正则测试，改一处就要改一串断言。

## What Changes

- 先划分状态：纯规则不碰 Vue；交互状态归各自的组合式函数，外部状态只通过传入的读取函数读、通过回调写；会话、选区、项目和错误/成功提示仍归组件。
- 新增 `useComposerMenus.ts`：权限、Skill、漫剧三个输入框菜单的开关、定位、焦点与键盘导航，以及按钮提示。
- 新增 `composerMentions.ts`：@ 提及候选（对话、Skill、MCP、文件）的加载规则。
- 新增 `resourceClipboard.ts`：项目资源剪贴板的生成、剪切判断，以及随文件删除/改名更新。
- 新增 `useMediaReorder.ts`：媒体排序编号的预演、模式切换、确认改名和右键菜单可用性计数。
- 对应的源码正则测试改为行为测试，组件只保留接线检查。

## Capabilities

### New Capabilities
- `composer-interaction`: 输入框菜单与 @ 提及候选的行为

### Modified Capabilities
- `project-tree-view`: 增加资源剪贴板跟随与媒体排序编号的行为要求

## Impact

`MemoryWorkbench.vue`、`ProjectFileTree.vue` 及其测试；用户可见行为不变。
