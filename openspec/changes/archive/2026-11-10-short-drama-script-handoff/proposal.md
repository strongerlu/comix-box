## Why

短剧改编把每集剧本写到 `剧本/第00N集/分集剧本.md`，而漫剧全自动只认 `项目资料/分集剧本/第N集分集剧本.md`。改编完的项目切到漫剧全自动时，确认卡显示"还没有分集剧本"，用户必须再走一次入稿，让模型把同样的剧本另存一份。两份剧本之后各改各的，容易不同步。

## What Changes

- 漫剧全自动识别每集剧本时，同时接受短剧剧本；同一集两处都有时，以漫剧入稿的分集剧本为准（现有行为不变）。
- 单集指令改为写明这一集实际使用的剧本路径，不再固定拼接入稿路径。
- 确认卡标出哪几集使用短剧剧本。
- `jc-manju-pipeline` 入稿：本轮没有给新剧本、项目里已有短剧剧本时，不再复制保存，只确认项目风格。

## Capabilities

### New Capabilities
- `manju-episode-source`: 漫剧全自动的每集剧本来源

### Modified Capabilities

## Impact

`autoRunner.ts`、`useManjuAuto.ts`、`ManjuAutoPanel.vue`、`jc-manju-pipeline/SKILL.md` 及相关测试。不复制、不移动、不改写任何剧本文件。
