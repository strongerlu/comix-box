use serde::Deserialize;
use std::path::PathBuf;

fn jiucaihezi_home_dir() -> Result<PathBuf, String> {
    let home = std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
        .filter(|path| path.is_dir())
        .ok_or_else(|| "无法读取用户目录".to_string())?;
    let directory = home.join(".comic-box");
    std::fs::create_dir_all(&directory).map_err(|e| format!("创建 COMIC-BOX 用户目录失败: {e}"))?;
    Ok(directory)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WriteSessionTokenInput {
    token: String,
}

/// 从 ~/.comic-box/.session 读取 session token（文件权限 0600，仅本用户可读）
#[tauri::command]
pub fn read_session_token() -> Result<String, String> {
    let path = jiucaihezi_home_dir()?.join(".session");
    if !path.exists() {
        return Ok(String::new());
    }

    std::fs::read_to_string(&path)
        .map(|s| s.trim().to_string())
        .map_err(|e| format!("读取 session token 失败: {}", e))
}

/// 将 session token 写入 ~/.comic-box/.session（文件权限 0600），原子写入
#[tauri::command]
pub fn write_session_token(input: WriteSessionTokenInput) -> Result<(), String> {
    let path = jiucaihezi_home_dir()?.join(".session");
    let token = input.token.trim().to_string();
    if token.is_empty() {
        if path.exists() {
            std::fs::remove_file(&path).map_err(|e| format!("删除 session token 失败: {}", e))?;
        }
        return Ok(());
    }
    let tmp = path.with_extension(".session.tmp");
    std::fs::write(&tmp, &token).map_err(|e| format!("写入 session token 失败: {}", e))?;

    std::fs::rename(&tmp, &path).map_err(|e| format!("保存 session token 失败: {}", e))?;
    Ok(())
}
