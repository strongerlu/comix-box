## ADDED Requirements

### Requirement: 提交前错误由抛出处显式标记
系统 SHALL 只依据抛出处附加的显式标记，把失败任务的错误阶段记为 `validation` 或 `upload`。没有标记的错误 SHALL 记为 `submit` 阶段，不论其文字内容。

#### Scenario: 上游报错含校验字样
- **WHEN** 执行器在提交后抛出未标记的错误「上游不支持该分辨率，连接超时」
- **THEN** 任务错误阶段为 `submit`，且该任务被判定为「提交结果待核实」

#### Scenario: 参考素材上传失败
- **WHEN** 参考素材在生成请求发出前上传失败，错误文字包含「网络」
- **THEN** 任务错误类别为 `upload`、阶段为 `upload`，且不被判定为「提交结果待核实」

#### Scenario: 本地工作流参数无效
- **WHEN** ComfyUI 本地工作流在提交前因参数无效构建失败
- **THEN** 任务错误类别为 `plan-validation`、阶段为 `validation`，且官方 MCP 的 `run_workflow` 未被调用

### Requirement: 取消不被标记为提交前错误
系统 SHALL 在提交前阶段被取消时保留原有的取消错误，不附加提交前标记。

#### Scenario: 上传过程中取消
- **WHEN** 用户在参考素材上传期间取消任务，抛出 `AbortError`
- **THEN** 该错误不带提交前标记，取消处理逻辑与修改前一致
