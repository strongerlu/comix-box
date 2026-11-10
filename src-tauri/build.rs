fn main() {
    // ponytail: 只有一个 C 文件，用 cc crate 默认行为即可，不写自定义链接逻辑。
    cc::Build::new()
        .file("vendor/compositor-heal/HealPixels.c")
        .warnings(false)
        .compile("compositor_heal");
    println!("cargo:rerun-if-changed=vendor/compositor-heal/HealPixels.c");
    let mut attributes = tauri_build::Attributes::new();
    if std::env::var("TARGET").is_ok_and(|target| target.ends_with("-windows-msvc")) {
        // Tauri only links its resource manifest into bin targets. The lib
        // test executable also imports Common Controls v6 through Tauri.
        let manifest =
            std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("windows-app.manifest");
        println!("cargo:rerun-if-changed=windows-app.manifest");
        println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
        println!("cargo:rustc-link-arg=/MANIFESTUAC:NO");
        println!("cargo:rustc-link-arg=/MANIFESTINPUT:{}", manifest.display());
        attributes = attributes
            .windows_attributes(tauri_build::WindowsAttributes::new_without_app_manifest());
    }
    tauri_build::try_build(attributes).expect("failed to prepare Tauri resources");
}
