# conditional-save Specification

## Purpose
TBD - created by archiving change narrow-conditional-save-window. Update Purpose after archive.
## Requirements
### Requirement: 每次替换前重新比对版本
按版本条件保存 SHALL 在每次原子替换尝试之前重新读取目标版本；与期望版本不同时 SHALL 返回 `conflict`、保留外部内容并删除临时文件。

#### Scenario: 等待读取句柄期间被外部修改
- **WHEN** 其他程序持有读取句柄使替换重试，期间目标被外部写入
- **THEN** 保存返回 `conflict`，目标内容是外部写入，目录中没有遗留临时文件

#### Scenario: 保存前版本已过期
- **WHEN** 调用时目标版本与期望版本不同
- **THEN** 不写入，返回 `conflict` 与当前版本

