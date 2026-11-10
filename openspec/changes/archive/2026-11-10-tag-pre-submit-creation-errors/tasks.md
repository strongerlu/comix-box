## 1. 先写失败测试

- [x] 1.1 `mediaTaskStore.test.ts`：未标记的「不支持…连接超时」错误阶段为 `submit` 且判定为待核实；带 `upload` 标记的网络错误阶段为 `upload` 且不待核实
- [x] 1.2 `mediaTaskStore.test.ts`：`duringPreSubmitCreation` 不给 `AbortError` 和已标记错误补标
- [x] 1.3 `comfyMcp.test.ts`：工作流构建失败带 `validation` 标记且未调用 `run_workflow`；参考图写入失败带 `upload` 标记

## 2. 实现

- [x] 2.1 `submissionSafety.ts` 新增 `preSubmitCreationError`、`duringPreSubmitCreation`、`preSubmitCreationStage`
- [x] 2.2 `classifyExecutionError` 优先读取标记；正则兜底的阶段改为 `submit`
- [x] 2.3 打标：`uploadCreationAsset`、`imageReferenceToBlob`、GPT Image 与 Veo 参考图读取、`runComfyWorkflow` 参考图上传、`buildWorkflow` 与工作流写入

## 3. 验证

- [x] 3.1 相关测试文件（comfyMcp、mediaTaskStore、creationMediaRuntime）通过；全量 focused 与 typecheck 在 `pnpm run verify` 中统一执行
