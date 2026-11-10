//! Local private staging only. All ComfyUI network operations belong to the official MCP.
use base64::{engine::general_purpose, Engine as _};
use std::io::Write;
use std::path::{Path, PathBuf};
use tauri::Manager;

fn write_input(root: &Path, id: &str, name: &str, data: &str) -> Result<String, String> {
    uuid::Uuid::parse_str(id).map_err(|_| "ComfyUI 工作目录 ID 无效")?;
    let allowed = name == "workflow.json" || name == "result.marker" ||
        (name.starts_with("reference-") && [".png", ".jpg", ".webp"].iter().any(|ext| name.ends_with(ext)));
    if !allowed || name.contains(['/', '\\']) || name.contains("..") {
        return Err("ComfyUI 输入文件名无效".into());
    }
    let bytes = general_purpose::STANDARD.decode(data).map_err(|_| "ComfyUI 输入数据无效")?;
    if name.starts_with("reference-") && bytes.len() > 20 * 1024 * 1024 { return Err("参考图超过 20 MB 上限".into()); }
    let dir = root.join(id);
    if dir.symlink_metadata().is_ok_and(|m| m.file_type().is_symlink()) { return Err("ComfyUI 工作目录不能是符号链接".into()); }
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let path = dir.join(name);
    if name == "result.marker" && path.is_file() { return Ok(path.to_string_lossy().into_owned()); }
    let mut options = std::fs::OpenOptions::new();
    options.write(true).create_new(true);

    let mut file = options.open(&path).map_err(|e| format!("创建 ComfyUI 输入失败: {e}"))?;
    if let Err(error) = file.write_all(&bytes) {
        drop(file);
        let _ = std::fs::remove_file(&path);
        return Err(error.to_string());
    }
    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command(async)]
pub fn comfy_mcp_write_input(app: tauri::AppHandle, id: String, name: String, data_base64: String) -> Result<String, String> {
    let root: PathBuf = app.path().app_data_dir().map_err(|e| e.to_string())?.join("comfy-mcp");
    write_input(&root, &id, &name, &data_base64)
}

fn remove_workflow(root: &Path, id: &str) -> Result<(), String> {
    uuid::Uuid::parse_str(id).map_err(|_| "ComfyUI 工作目录 ID 无效")?;
    let dir = root.join(id);
    if dir.symlink_metadata().is_ok_and(|m| m.file_type().is_symlink()) { return Err("ComfyUI 工作目录不能是符号链接".into()); }
    match std::fs::remove_file(dir.join("workflow.json")) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

fn output_path(root: &Path, path: &Path) -> Result<PathBuf, String> {
    let root = root.canonicalize().map_err(|e| e.to_string())?;
    let path = path.canonicalize().map_err(|e| e.to_string())?;
    let relative = path.strip_prefix(&root).map_err(|_| "ComfyUI 结果不在私有工作目录")?;
    let mut parts = relative.components();
    let id = parts.next().and_then(|v| v.as_os_str().to_str()).ok_or("ComfyUI 结果目录无效")?;
    uuid::Uuid::parse_str(id).map_err(|_| "ComfyUI 结果目录无效")?;
    if parts.next().is_none_or(|v| v.as_os_str() != "outputs") { return Err("只能读取 ComfyUI outputs 媒体文件".into()); }
    let ext = path.extension().and_then(|v| v.to_str()).unwrap_or("").to_ascii_lowercase();
    if !["png", "jpg", "jpeg", "webp", "mp4", "webm", "mov"].contains(&ext.as_str()) { return Err("ComfyUI 结果媒体类型无效".into()); }
    Ok(path)
}

fn read_output(root: &Path, path: &Path) -> Result<String, String> {
    let bytes = std::fs::read(output_path(root, path)?).map_err(|e| e.to_string())?;
    if bytes.is_empty() { return Err("ComfyUI 输出文件为空".into()); }
    Ok(general_purpose::STANDARD.encode(bytes))
}

fn copy_output(root: &Path, path: &Path, project_root: &str, relative_path: &str) -> Result<u64, String> {
    let source = output_path(root, path)?;
    let project = crate::commands::dev::canonical_root(project_root)?;
    let target = crate::commands::dev::resolve_write_path(&project, relative_path)?;
    if target.exists() { return Err("目标文件已存在，未覆盖".into()); }
    let parent = target.parent().ok_or("写入路径无效")?;
    std::fs::create_dir_all(parent).map_err(|_| "创建媒体目录失败")?;
    let name = target.file_name().and_then(|v| v.to_str()).ok_or("媒体文件名无效")?;
    let temp = target.with_file_name(format!(".{name}.{}.part", uuid::Uuid::new_v4()));
    let copied = (|| {
        let mut input = std::fs::File::open(&source).map_err(|e| e.to_string())?;
        let mut output = std::fs::OpenOptions::new().write(true).create_new(true).open(&temp)
            .map_err(|e| format!("创建媒体临时文件失败: {e}"))?;
        let bytes = std::io::copy(&mut input, &mut output).map_err(|e| format!("复制 ComfyUI 输出失败: {e}"))?;
        output.sync_all().map_err(|e| e.to_string())?;
        drop(output);
        if bytes == 0 { return Err("ComfyUI 输出文件为空".to_string()); }
        if target.exists() { return Err("目标文件已存在，未覆盖".to_string()); }
        std::fs::rename(&temp, &target).map_err(|_| "完成媒体文件失败".to_string())?;
        Ok(bytes)
    })();
    if copied.is_err() { let _ = std::fs::remove_file(&temp); }
    copied
}

#[tauri::command]
pub fn comfy_mcp_remove_workflow(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let root = app.path().app_data_dir().map_err(|e| e.to_string())?.join("comfy-mcp");
    remove_workflow(&root, &id)
}

#[tauri::command(async)]
pub fn comfy_mcp_read_output(app: tauri::AppHandle, path: String) -> Result<String, String> {
    let root = app.path().app_data_dir().map_err(|e| e.to_string())?.join("comfy-mcp");
    read_output(&root, Path::new(&path))
}

#[tauri::command]
pub async fn comfy_mcp_copy_output_to_project(app: tauri::AppHandle, path: String, root: String, relative_path: String) -> Result<u64, String> {
    let comfy_root = app.path().app_data_dir().map_err(|e| e.to_string())?.join("comfy-mcp");
    tauri::async_runtime::spawn_blocking(move || copy_output(&comfy_root, Path::new(&path), &root, &relative_path))
        .await.map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn private_staging_rejects_escape_and_overwrite() {
        let dir = tempfile::tempdir().unwrap();
        let id = uuid::Uuid::new_v4().to_string();
        assert!(write_input(dir.path(), "../x", "workflow.json", "e30=").is_err());
        assert!(write_input(dir.path(), &id, "../workflow.json", "e30=").is_err());
        let file = write_input(dir.path(), &id, "workflow.json", "e30=").unwrap();
        assert_eq!(std::fs::read(&file).unwrap(), b"{}");
        assert!(write_input(dir.path(), &id, "workflow.json", "e30=").is_err());

    }

    #[test]
    fn cleanup_and_read_are_confined_to_private_job_files() {
        let dir = tempfile::tempdir().unwrap();
        let id = uuid::Uuid::new_v4().to_string();
        let file = write_input(dir.path(), &id, "workflow.json", "e30=").unwrap();
        assert!(remove_workflow(dir.path(), "../outside").is_err());
        assert!(std::path::Path::new(&file).exists());
        let outputs = dir.path().join(&id).join("outputs");
        std::fs::create_dir_all(&outputs).unwrap();
        let video = outputs.join("result.mp4");
        std::fs::write(&video, b"video").unwrap();
        assert_eq!(read_output(dir.path(), &video).unwrap(), "dmlkZW8=");
        assert!(read_output(dir.path(), Path::new(&file)).is_err());
        let outside = tempfile::NamedTempFile::new().unwrap();
        assert!(read_output(dir.path(), outside.path()).is_err());
        std::fs::write(outputs.join("secret.txt"), b"private").unwrap();
        assert!(read_output(dir.path(), &outputs.join("secret.txt")).is_err());
        remove_workflow(dir.path(), &id).unwrap();
        remove_workflow(dir.path(), &id).unwrap();
        assert!(video.exists());
        assert!(!Path::new(&file).exists());
    }

    #[test]
    fn outputs_copy_into_the_project_without_overwriting_or_escaping() {
        let dir = tempfile::tempdir().unwrap();
        let project = tempfile::tempdir().unwrap();
        let root = project.path().to_string_lossy().into_owned();
        let outputs = dir.path().join(uuid::Uuid::new_v4().to_string()).join("outputs");
        std::fs::create_dir_all(&outputs).unwrap();
        let video = outputs.join("result.mp4");
        std::fs::write(&video, b"video bytes").unwrap();

        assert_eq!(copy_output(dir.path(), &video, &root, ".raw/jc-media/视频/a.mp4").unwrap(), 11);
        let media = project.path().join(".raw/jc-media/视频");
        assert_eq!(std::fs::read(media.join("a.mp4")).unwrap(), b"video bytes");
        assert_eq!(std::fs::read_dir(&media).unwrap().count(), 1);

        std::fs::write(media.join("b.mp4"), b"keep").unwrap();
        assert!(copy_output(dir.path(), &video, &root, ".raw/jc-media/视频/b.mp4").is_err());
        assert_eq!(std::fs::read(media.join("b.mp4")).unwrap(), b"keep");

        assert!(copy_output(dir.path(), &video, &root, "../escape.mp4").is_err());
        let outside = tempfile::NamedTempFile::new().unwrap();
        assert!(copy_output(dir.path(), outside.path(), &root, "c.mp4").is_err());
        std::fs::write(outputs.join("secret.txt"), b"private").unwrap();
        assert!(copy_output(dir.path(), &outputs.join("secret.txt"), &root, "c.txt").is_err());
        assert!(!project.path().join("c.mp4").exists() && !project.path().join("c.txt").exists());
        assert_eq!(std::fs::read_dir(&media).unwrap().count(), 2);
    }
}
