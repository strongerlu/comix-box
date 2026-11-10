## 1. 剧本来源

- [x] 1.1 先写 `episodeScripts` 与指令路径的失败测试
- [x] 1.2 `autoRunner.ts` 新增 `episodeScripts`，`episodeInstruction` 改为接收本集剧本路径
- [x] 1.3 `useManjuAuto.ts` 准备阶段改用 `episodeScripts`，草稿带上每集剧本路径，单集指令使用它

## 2. 界面与 Skill

- [x] 2.1 确认卡标出使用短剧剧本的集，空状态提示同时提到短剧剧本
- [x] 2.2 `jc-manju-pipeline` 入稿：已有短剧剧本且本轮未给新稿时不复制，只确认风格

## 3. 回归

- [x] 3.1 相关测试、`vue-tsc`、lint 通过
- [x] 3.2 `pnpm run verify` 通过
