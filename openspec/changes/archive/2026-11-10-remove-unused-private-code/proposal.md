## Why

lint 报告若干从未被调用的模块私有函数和常量。它们误导阅读者（例如 `creationMediaRuntime.ts` 里有两套参考图读取函数，只有一套在用），也让 lint 的真实问题淹没在噪音里。

## What Changes

删除以下确认无调用者、未导出、测试也未引用的私有定义（不改变任何运行时行为）：

- `src/runtime/creation/creationMediaRuntime.ts`：`waitForCreationPoll`、`toBlob`
- `src/stores/mediaTaskStore.ts`：`isTaskSuccessful`
- `src/api/media-generation.ts`：`extractRawRhTaskId`
- `src/services/deepSeekHarness.ts`：`deepSeekMessageText`
- `src/runtime/direct/desktopProjectTools.ts`：内部函数 `readFileIfExists`
- `src/data/mediaModelCapabilities.ts`：常量 `VIDEO_RATIOS`、`LANGUAGES`、`RH_LANGUAGE_BOOSTS`
- `src/runtime/creation/creationModelRegistry.ts`：常量 `VIDEO_RATIOS`
- `src/runtime/direct/__tests__/desktopProjectTools.test.ts`：未使用的导入 `parseCreativeToolArguments`

## Capabilities

### New Capabilities
- `code-hygiene`: 创作链路模块不保留无调用者的私有代码（纯清理，不改变运行时行为）。

### Modified Capabilities
（无）

## Impact

- 仅删除私有代码；导出接口、持久化数据和界面不变。
- 不涉及 `gateway/`（服务端部署代码另行处理）。
