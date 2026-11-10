# creation-task-prefill Specification

## Purpose
从历史创作任务把模型与参数回填到创作面板，只预填不重新提交。
## Requirements
### Requirement: 已结束任务可回填面板
系统 SHALL 允许来源为创作面板、状态为成功、失败或已取消、且带有计划快照的任务回填到创作面板；其他任务 SHALL NOT 提供回填。

#### Scenario: 可回填的任务
- **WHEN** 任务来源为 `creation`、状态为 `failed`，且有计划快照
- **THEN** 该任务可回填

#### Scenario: 运行中的任务
- **WHEN** 任务状态为 `running`
- **THEN** 该任务不可回填

### Requirement: 回填恢复模型、参数与提示词且不提交
回填 SHALL 切换到快照中的任务类型与模型，恢复快照中的时长、尺寸、比例、分辨率、模型字段值和提示词，清空已选参考文件，并且 SHALL NOT 提交新任务。

#### Scenario: 本地视频工作流任务回填
- **WHEN** 回填一个本地 ComfyUI 视频任务，快照参数为宽 960、种子 7、时长 8 秒、提示词「旧提示词」
- **THEN** 面板模型为该本地模型，当前参数宽为 960、种子为 7、时长为 8，提示词为「旧提示词」，已选文件为空

#### Scenario: 快照含参考素材
- **WHEN** 回填的快照参数包含参考图片
- **THEN** 回填结果标记为需要重新选择参考素材，已选文件为空

#### Scenario: AI 应用任务回填
- **WHEN** 回填的快照 `apiStyle` 为 `rh-aiapp`，参数含 `webappId`、`outputType` 和节点字段 `12:text`
- **THEN** 面板切换到 AI 应用任务，恢复应用 ID、输出类型，并把 `12:text` 写入字段值

