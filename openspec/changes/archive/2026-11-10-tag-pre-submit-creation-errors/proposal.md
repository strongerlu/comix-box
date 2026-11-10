## Why

`mediaTaskStore.classifyExecutionError` 用正则匹配报错文字来判断错误阶段。阶段为 `validation` 或 `upload` 时，`isUncertainSubmission` 认定「请求肯定未提交」，不再提示用户核对、允许直接重提。上游报错里只要出现「不支持」「校验」「必须是」「上传失败」等字样，就会被误判为提交前错误；如果请求其实已被受理，用户重提就会重复扣费。

## What Changes

- 新增提交前错误标记：在错误对象上记录 `creationStage: 'validation' | 'upload'`，沿用现有 `terminalCreationTask` 的标记方式。
- 在执行器中确定发生于提交请求之前的位置打标：参考素材读取与 R2 上传、GPT Image/Veo 参考图读取、ComfyUI 参考图上传与本地工作流构建。
- `classifyExecutionError` 优先使用标记；没有标记的错误仍按正则推断类别用于展示，但阶段一律记为 `submit`，不再仅凭文字认定「未提交」。
- 取消（`AbortError`）不打标，保持现有取消语义。

## Capabilities

### New Capabilities
- `creation-submission-safety`: 创作任务失败时「是否可能已提交」的判定规则。

### Modified Capabilities
（无）

## Impact

- `src/runtime/creation/submissionSafety.ts`（新增标记函数）、`src/stores/mediaTaskStore.ts`（分类）、`src/api/media-generation.ts`、`src/runtime/creation/creationMediaRuntime.ts`、`src/services/comfyMcp.ts`（打标）。
- 行为变化：未打标、文字像校验或上传错误的失败任务，若同时带有网络类字样，将显示「提交结果待核实」而不是允许直接重提。这是有意的保守变化。
- 不改变持久化格式；`CreationTaskError` 结构不变。
