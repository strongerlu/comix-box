# creation-task-history Specification

## Purpose
TBD - created by archiving change split-large-components. Update Purpose after archive.
## Requirements
### Requirement: 任务记录筛选与搜索
任务记录 SHALL 按所选状态筛选，并按提示词、模型名称和阶段文字做不区分大小写、忽略首尾空白的搜索；结果 SHALL 是原任务对象。

#### Scenario: 按待处理筛选
- **WHEN** 45 条任务中只有 1 条失败，选择“待处理”
- **THEN** 总数为 1，结果就是那条原任务对象

#### Scenario: 搜索无结果
- **WHEN** 搜索词不匹配任何任务
- **THEN** 总数为 0，总页数仍为 1

### Requirement: 分页保持在有效范围
分页 SHALL 在筛选、搜索或每页条数变化时回到第 1 页；任务总数减少使当前页越界时 SHALL 退回最后一页。

#### Scenario: 列表缩短
- **WHEN** 每页 20 条、位于第 3 页，任务从 45 条减为 25 条
- **THEN** 当前页变为第 2 页，显示 5 条

