## Context

`replace_file_atomically_with_check` 在重试循环中每次先调用版本检查，再调用 `MoveFileExW(REPLACE_EXISTING | WRITE_THROUGH)`；共享冲突（5/32/33）最多重试 1 秒。同进程内的条件保存由 `CONDITIONAL_TEXT_WRITE` 互斥锁串行。

## Decisions

- **不持有目标句柄**：实测以 `FILE_SHARE_READ | FILE_SHARE_DELETE` 打开目标后，同一时刻 `MoveFileExW` 替换失败（拒绝访问）。即使改造成功，它也只能挡住原地写入，挡不住同样用改名替换的外部程序。
- **不改用 POSIX 语义改名**：`SetFileInformationByHandle(FileRenameInfoEx, POSIX_SEMANTICS)` 允许替换已打开的目标，但 FAT/exFAT 与部分网络盘不支持，需要额外回退路径；为微秒级窗口引入两条替换路径不划算。
- **保留现状并写入规格**：版本检查与替换紧邻执行，每次重试重新检查。

## Risks / Trade-offs

- [已知限制] 外部程序恰好在版本检查之后、替换之前写入，该写入会被覆盖；窗口为一次系统调用的间隔。若出现真实案例，再评估 POSIX 语义改名加回退路径。
