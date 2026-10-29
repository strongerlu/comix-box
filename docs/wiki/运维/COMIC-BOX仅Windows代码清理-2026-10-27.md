# COMIC-BOX 仅 Windows 代码清理（2026-10-27）

## 授权与恢复

用户明确要求清理非 Windows 平台和不再使用的代码，并确认保留当前未提交改动。本次在 main 工作区内修改，没有提交、推送、部署或修改用户应用数据。

清理前所有受 Git 管理的文件与非忽略的未跟踪文件已逐文件保存：`F:\code\ComicGen-before-windows-cleanup-20261027-212419.zip`。快照包含原有品牌、界面、功能与平台资源改动；删除的平台文件也可从中恢复。node_modules、target 等忽略的构建缓存不属于此源码快照。

## 清理结果

相对清理前快照，删除 **98 个文件，约 831 KiB 原始文件内容**：

- 移动客户端：`mobile/`、`src/mobile/`、MobileRemote TypeScript 客户端、Rust remote_client、扫码插件和对应测试/权限。
- 非 Windows 打包：iOS 配置、启动屏、移动图标、macOS 图标/entitlements、DMG/签名/公证/Monterey 补丁脚本及对应入口。
- iOS 专用 Tauri runtime 副本与 Tao Git 补丁：恢复依赖发布版，Windows cargo check 验证通过。依赖自身的跨平台代码不作人为裁剪。
- 共享 Rust 文件中的非 Windows 条件分支：移除 macOS 菜单、截图、凭据/进程/路径/防睡眠分支及移动专属实现；保留 Windows 实现。
- 无调用者旧代码：useNotebook、mediaAssetStore、GalleryLightbox、GalleryLoadingCard、GallerySizeControl、旧 McpSettings。已经被测试、桌面入口或共享链路引用的模块不按名字删除。

桌面直接以根 `index.html` 构建工作台，保留独立截图入口；删除 `/try/` 中转和网站构建后再替换入口的步骤。Vite 固定 Windows WebView2 的 Chromium 目标。默认与截图权限限定 windows，NSIS 为唯一安装包目标。pnpm/Cargo 锁文件同步更新。

官网下载页仍被 Gateway 使用，已移动到 `gateway/site/index.html` 并调整同步脚本。Gateway、模型适配服务、Windows 远程控制服务端、共享协议与历史文档保留。Windows 开发预览、自动化测试仍可达的浏览器回退与共享界面适配没有仅凭 Web/mobile 命名删除。

CI 仅保留 Windows 构建、启动检查、安装器与便携 ZIP；移除 macOS jobs 和原版生产下载/OTA 推广 jobs。COMIC-BOX 独立 identifier、凭据服务、私有目录、回调协议及空更新源保持原合同。现存更新与服务端发布辅助模块仍有测试/运维使用，本次不以停止某项 CI 为由一并删除。

类型检查增加 noEmit，防止在 src 中生成 JS/声明副本；本次检查曾生成的 630 个文件已按快照逐项排除用户原有文件后清除。Node 配置显式声明 node 类型。

## 验证与限制

- 清理边界先执行红测：3 项均失败，证明原始入口、平台资源与权限不符合 Windows 范围；实施后通过。
- `pnpm build:desktop:quick`、桌面产物审计通过；构建含 vue-tsc 类型检查。
- 后续工作台、Windows 凭据、MCP、截图、权限、产品隔离、平台清理及测试注册专项 **177/177 通过**。
- 最终默认目标 `cargo check --manifest-path src-tauri/Cargo.toml` 通过；Git 差异空白检查通过。
- 最近一次全量 Node 回归：2303 项，2276 通过、22 失败、5 跳过。其间两项因清理后的条件属性/换行而失效的源码断言已修正，后续包含它们的 177 项专项通过；未再次将整套回归宣称为通过。
- 剩余 19 项确定性失败在清理前 ZIP 解出的源码上复现：Harness 新 SDK 夹具 1、native tools 的 Windows ESM 路径 1、旧 bash/R2 发布环境 6、production capabilities 10、creation MCP 固定 `/tmp` 路径 1。原始源码测试复用当前已安装依赖；不等同于独立生产环境验收。
- 另有 SDK idle-timeout 测试在并发全量运行时出现计时断言不稳定，本次没有修改该链路。
- Rust lib 测试已编译，执行被本机 `0xc0000139 / STATUS_ENTRYPOINT_NOT_FOUND` 阻断。尝试现有隔离测试宿主清单脚本，但 Windows SDK `mt.exe` 缺失，未完成原生单测执行；该加载器限制也见先前 Windows 全局审查记录。
- 未重新打包安装器、启动真实安装版、验证生产浏览器授权或操作生产更新源，不宣称这些验收通过。构建输出仍有原有 toolbar-actions 图标缺失与 node:fs 浏览器外置提示。

## 删除文件清单

- `mobile/index.html`
- `scripts/__tests__/create-official-dmg.test.mjs`
- `scripts/__tests__/mobile-controller-dist.test.mjs`
- `scripts/apple-stapler.mjs`
- `scripts/apply-ios-branding.mjs`
- `scripts/audit-ios-app.mjs`
- `scripts/audit-ios-dist.mjs`
- `scripts/audit-web-dist.mjs`
- `scripts/create-official-dmg.mjs`
- `scripts/fix-macos-app.mjs`
- `scripts/patch-monterey-compat.mjs`
- `scripts/prune-ios-dist.mjs`
- `scripts/prune-web-dist.mjs`
- `src-tauri/Info.ios.plist`
- `src-tauri/capabilities/mobile.json`
- `src-tauri/entitlements.plist`
- `src-tauri/icons/android/mipmap-anydpi-v26/ic_launcher.xml`
- `src-tauri/icons/android/mipmap-hdpi/ic_launcher.png`
- `src-tauri/icons/android/mipmap-hdpi/ic_launcher_foreground.png`
- `src-tauri/icons/android/mipmap-hdpi/ic_launcher_round.png`
- `src-tauri/icons/android/mipmap-mdpi/ic_launcher.png`
- `src-tauri/icons/android/mipmap-mdpi/ic_launcher_foreground.png`
- `src-tauri/icons/android/mipmap-mdpi/ic_launcher_round.png`
- `src-tauri/icons/android/mipmap-xhdpi/ic_launcher.png`
- `src-tauri/icons/android/mipmap-xhdpi/ic_launcher_foreground.png`
- `src-tauri/icons/android/mipmap-xhdpi/ic_launcher_round.png`
- `src-tauri/icons/android/mipmap-xxhdpi/ic_launcher.png`
- `src-tauri/icons/android/mipmap-xxhdpi/ic_launcher_foreground.png`
- `src-tauri/icons/android/mipmap-xxhdpi/ic_launcher_round.png`
- `src-tauri/icons/android/mipmap-xxxhdpi/ic_launcher.png`
- `src-tauri/icons/android/mipmap-xxxhdpi/ic_launcher_foreground.png`
- `src-tauri/icons/android/mipmap-xxxhdpi/ic_launcher_round.png`
- `src-tauri/icons/android/values/ic_launcher_background.xml`
- `src-tauri/icons/icon.icns`
- `src-tauri/icons/ios/AppIcon-20x20@1x.png`
- `src-tauri/icons/ios/AppIcon-20x20@2x-1.png`
- `src-tauri/icons/ios/AppIcon-20x20@2x.png`
- `src-tauri/icons/ios/AppIcon-20x20@3x.png`
- `src-tauri/icons/ios/AppIcon-29x29@1x.png`
- `src-tauri/icons/ios/AppIcon-29x29@2x-1.png`
- `src-tauri/icons/ios/AppIcon-29x29@2x.png`
- `src-tauri/icons/ios/AppIcon-29x29@3x.png`
- `src-tauri/icons/ios/AppIcon-40x40@1x.png`
- `src-tauri/icons/ios/AppIcon-40x40@2x-1.png`
- `src-tauri/icons/ios/AppIcon-40x40@2x.png`
- `src-tauri/icons/ios/AppIcon-40x40@3x.png`
- `src-tauri/icons/ios/AppIcon-512@2x.png`
- `src-tauri/icons/ios/AppIcon-60x60@2x.png`
- `src-tauri/icons/ios/AppIcon-60x60@3x.png`
- `src-tauri/icons/ios/AppIcon-76x76@1x.png`
- `src-tauri/icons/ios/AppIcon-76x76@2x.png`
- `src-tauri/icons/ios/AppIcon-83.5x83.5@2x.png`
- `src-tauri/ios/LaunchLogo.Contents.json`
- `src-tauri/ios/LaunchScreen.storyboard`
- `src-tauri/node-entitlements.plist`
- `src-tauri/src/commands/remote_client.rs`
- `src-tauri/tauri.ios.conf.json`
- `src-tauri/vendor/tauri-runtime-wry/Cargo.toml`
- `src-tauri/vendor/tauri-runtime-wry/LICENSE_APACHE-2.0`
- `src-tauri/vendor/tauri-runtime-wry/LICENSE_MIT`
- `src-tauri/vendor/tauri-runtime-wry/README.md`
- `src-tauri/vendor/tauri-runtime-wry/build.rs`
- `src-tauri/vendor/tauri-runtime-wry/src/dialog/mod.rs`
- `src-tauri/vendor/tauri-runtime-wry/src/dialog/windows.rs`
- `src-tauri/vendor/tauri-runtime-wry/src/lib.rs`
- `src-tauri/vendor/tauri-runtime-wry/src/monitor/linux.rs`
- `src-tauri/vendor/tauri-runtime-wry/src/monitor/macos.rs`
- `src-tauri/vendor/tauri-runtime-wry/src/monitor/mod.rs`
- `src-tauri/vendor/tauri-runtime-wry/src/monitor/windows.rs`
- `src-tauri/vendor/tauri-runtime-wry/src/undecorated_resizing.rs`
- `src-tauri/vendor/tauri-runtime-wry/src/util.rs`
- `src-tauri/vendor/tauri-runtime-wry/src/webview.rs`
- `src-tauri/vendor/tauri-runtime-wry/src/window/linux.rs`
- `src-tauri/vendor/tauri-runtime-wry/src/window/macos.rs`
- `src-tauri/vendor/tauri-runtime-wry/src/window/mod.rs`
- `src-tauri/vendor/tauri-runtime-wry/src/window/windows.rs`
- `src/components/creation/GalleryLightbox.vue`
- `src/components/creation/GalleryLoadingCard.vue`
- `src/components/creation/GallerySizeControl.vue`
- `src/components/settings/McpSettings.vue`
- `src/composables/useNotebook.ts`
- `src/mobile/MobileController.vue`
- `src/mobile/MobileConversationList.vue`
- `src/mobile/MobileFileBrowser.vue`
- `src/mobile/MobileManjuAutoPanel.vue`
- `src/mobile/MobilePairingView.vue`
- `src/mobile/MobileSessionView.vue`
- `src/mobile/__tests__/describeRemoteError.test.ts`
- `src/mobile/__tests__/mobileControllerUi.test.ts`
- `src/mobile/describeRemoteError.ts`
- `src/mobile/main.ts`
- `src/mobile/useMobileRemote.ts`
- `src/services/__tests__/mobileRemoteClient.test.ts`
- `src/services/__tests__/mobileRemoteTransport.test.ts`
- `src/services/mobileRemoteClient.ts`
- `src/services/mobileRemoteTransport.ts`
- `src/stores/mediaAssetStore.ts`
- `try/index.html`
