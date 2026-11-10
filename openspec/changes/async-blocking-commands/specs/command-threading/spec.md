## ADDED Requirements

### Requirement: 重 I/O 命令不在主线程执行
读取项目或外部文件内容、列举与搜索目录、计算差异与哈希，以及写入调用方唯一路径的大文件的桌面命令 SHALL 在后台线程执行，SHALL NOT 阻塞窗口事件循环。

#### Scenario: 读取大文件
- **WHEN** 前端调用 `dev_read_file` 读取一个大文件
- **THEN** 命令在后台线程执行，窗口在读取期间仍响应输入

#### Scenario: 写入媒体字节
- **WHEN** 前端调用 `dev_write_file_bytes` 写入生成的媒体
- **THEN** 命令在后台线程执行，返回值与修改前一致

### Requirement: 依赖顺序的写操作保持串行
普通文本写入、条件保存、改名、删除与批量项目操作 SHALL 继续以同步命令执行，保持按调用顺序串行生效。

#### Scenario: 连续保存同一文件
- **WHEN** 前端连续两次调用 `dev_write_file` 写同一路径
- **THEN** 文件内容为第二次写入的内容
