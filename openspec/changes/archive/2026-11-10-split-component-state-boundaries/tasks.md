## 1. 输入框

- [x] 1.1 先写 `useComposerMenus.test.ts`，再新增 `useComposerMenus.ts` 并接入 `MemoryWorkbench.vue`
- [x] 1.2 新增 `composerMentions.ts`，组件改为 `createMentionItems` 接线；提及相关源码正则改为行为测试

## 2. 文件树

- [x] 2.1 先写 `resourceClipboard.test.ts`，再新增 `resourceClipboard.ts` 并接入 `ProjectFileTree.vue`
- [x] 2.2 先写 `useMediaReorder.test.ts`，再新增 `useMediaReorder.ts` 并接入；旧编号源码截取测试改为接线检查

## 3. 回归

- [x] 3.1 新测试加入 `run-focused-tests.mjs`；`vue-tsc`、lint 通过
- [x] 3.2 `pnpm run verify` 通过
