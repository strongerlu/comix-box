# document-markdown-routing Specification

## Purpose
TBD - created by archiving change behavior-tests-for-source-asserts. Update Purpose after archive.
## Requirements
### Requirement: 桌面优先本地转换
桌面端文档转 Markdown SHALL 先调用本地 `document_to_markdown_file`；本地成功时 SHALL NOT 请求云端。

#### Scenario: 本地成功
- **WHEN** 桌面端本地转换返回成功
- **THEN** 只调用一次 `document_to_markdown_file`，没有云端请求

### Requirement: 只有本地内部故障才回退云端
桌面端 SHALL 仅在本地解析器内部故障或调用异常时回退云端；格式不支持时 SHALL NOT 回退。

#### Scenario: 内部故障
- **WHEN** 本地转换返回 `internal` 错误或调用抛错
- **THEN** 请求云端 `/documents/markdown`

#### Scenario: 格式不支持
- **WHEN** 本地转换返回 `unsupported_format`
- **THEN** 不请求云端

### Requirement: Web 走云端
Web 端文档转 Markdown SHALL 请求共享云端转换接口。

#### Scenario: Web 转换
- **WHEN** 非 Tauri 环境转换 PDF
- **THEN** 请求 `/documents/markdown`

