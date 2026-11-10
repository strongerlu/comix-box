## Context

`isUncertainSubmission`（`submissionSafety.ts`）以 `error.stage` 是否为 `upload`/`validation` 作为「一定未提交」的依据，其余失败若带网络类字样则判定为待核实、阻止自动重提。`error.stage` 由 `classifyExecutionError` 按报错文字推断。现有代码已有同类做法：`terminalCreationTaskError` 在 Error 对象上挂 `terminalCreationTask` 标记。

`classifyExecutionError` 的输入来自执行器（提交后的失败也走这里）。`buildCreationRunPlan` 与 `validateTaskInputs` 的校验错误在任务创建前直接抛给调用方，不经过该函数。

## Goals / Non-Goals

**Goals:**
- 「未提交」的判定只来自抛出处的确定信息。
- 覆盖执行器内确定发生在生成请求之前的读取、上传和构建步骤。

**Non-Goals:**
- 不改造全部 throw 语句，不改变 `CreationTaskError` 结构和 UI 展示。
- 不调整 `TRANSPORT_FAILURE` 等网络判定规则。

## Decisions

- **标记放在 `submissionSafety.ts`**：该模块无外部依赖，且已是「是否已提交」规则的唯一出处；放在 `media-generation.ts` 会让 `comfyMcp.ts` 引入整个 API 模块。
- **函数边界包裹而非逐条改 throw**：`duringPreSubmitCreation(stage, run)` 捕获 `run` 内的任意错误（包括 `fetch` 网络异常）并补标，已带标记或为 `AbortError` 的错误原样抛出。逐条改 throw 会漏掉底层网络异常。
- **未标记错误阶段一律 `submit`**：类别仍按原正则推断，保留展示信息；阶段只表达「是否确定未提交」，不确定时取保守值。备选「保留正则推断阶段」无法消除误判风险。

## Risks / Trade-offs

- [遗漏的提交前位置会变为 `submit` 阶段，带网络字样时显示待核实] → 这是偏保守的结果，只会多一次核对，不会造成重复扣费；后续发现再补标。
- [包裹边界选错把提交请求包进去] → 只包裹读取/上传/构建函数本身，不包含生成请求；由测试断言 `run_workflow` 调用次数。
