# model-menu-grouping Specification

## Purpose
TBD - created by archiving change split-large-components-round2. Update Purpose after archive.
## Requirements
### Requirement: 对话模型按厂商分组
对话模型菜单 SHALL 按 Claude、GPT、Gemini、DeepSeek、千问、Grok、其他、本地模型的顺序分组，组内保持原顺序；内部媒体与检索模型 SHALL NOT 出现在菜单中。

#### Scenario: 混合供应商
- **WHEN** 模型列表包含各厂商模型和一个本地 Ollama 模型
- **THEN** 本地模型组排在最后，未识别厂商并入「其他」

### Requirement: 创作模型分组顺序
创作模型菜单 SHALL 按任务类型的固定顺序排列分组，「jc 本机」排在所有已知分组之后，未登记的插件分组排在最后。

#### Scenario: 生图菜单
- **WHEN** 任务类型为图片
- **THEN** FK 图片组排在灵动之前

#### Scenario: 插件新增分组
- **WHEN** 出现未登记的分组
- **THEN** 它排在「jc 本机」之后

