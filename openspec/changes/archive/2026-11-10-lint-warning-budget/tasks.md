## 1. 清理

- [x] 1.1 `oxlint --fix` 安全修复并逐行复核 diff，修正 `Uint8Array` 比较的语义变化
- [x] 1.2 删除未使用的 import、catch 参数、无调用私有函数与局部变量
- [x] 1.3 核实可疑可选链、非空断言与无用表达式，确认非缺陷

## 2. 上限

- [x] 2.1 `pnpm run lint` 改为 `oxlint --max-warnings 88`；验证 88 通过、87 失败

## 3. 回归

- [x] 3.1 `pnpm run verify` 通过
