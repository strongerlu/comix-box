# manju-episode-source Specification

## Purpose
TBD - created by archiving change short-drama-script-handoff. Update Purpose after archive.
## Requirements
### Requirement: 短剧剧本可直接作为漫剧全自动的本集剧本
漫剧全自动识别集数时 SHALL 同时接受 `项目资料/分集剧本/第N集分集剧本.md` 与短剧改编的 `剧本/第00N集/分集剧本.md`；同一集两处都有时 SHALL 使用前者。系统 SHALL NOT 复制或改写剧本文件。

#### Scenario: 只有短剧剧本
- **WHEN** 项目里只有 `wiki/剧本/第001集/分集剧本.md` 和 `wiki/剧本/第002集/分集剧本.md`
- **THEN** 确认卡列出第 1、2 集，Wiki 根为 `wiki`

#### Scenario: 两处都有
- **WHEN** 第 1 集同时有入稿分集剧本和短剧剧本
- **THEN** 第 1 集使用入稿分集剧本

### Requirement: 单集指令写明实际剧本路径
全自动单集指令 SHALL 写明该集实际使用的剧本路径。

#### Scenario: 使用短剧剧本的集
- **WHEN** 第 2 集来源为 `wiki/剧本/第002集/分集剧本.md`
- **THEN** 第 2 集指令要求按该路径读取剧本

### Requirement: 确认卡标出剧本来源
确认卡 SHALL 标出使用短剧剧本的集。

#### Scenario: 混合来源
- **WHEN** 第 1 集来自入稿、第 2 集来自短剧剧本
- **THEN** 确认卡说明第 2 集使用短剧剧本

