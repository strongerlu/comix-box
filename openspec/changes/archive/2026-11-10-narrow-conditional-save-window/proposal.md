## Why

`dev_write_file_if_revision` 先比对版本再 `MoveFileExW` 替换，两步之间外部程序写入目标会被覆盖。需要判断能否在不增加复杂度的前提下关闭这个窗口。

## What Changes

- 实测“替换期间持有目标句柄、拒绝共享写入”的方案：Windows 上持有目标句柄时 `MoveFileExW` 替换返回拒绝访问，现有 6 个替换测试全部失败，方案不可行，代码已回退。
- 不改代码；把现有保证写入规格：每次替换尝试前重新比对版本，版本变化返回冲突且不留临时文件。
- 剩余窗口记为已知限制，写入 design。

## Capabilities

### New Capabilities
- `conditional-save`: 按版本条件保存的冲突检测保证与已知限制。

### Modified Capabilities
（无）

## Impact

- 无运行时代码改动；由既有 Rust 测试 `conditional_save_rechecks_revision_after_waiting_for_a_windows_reader` 等覆盖。
