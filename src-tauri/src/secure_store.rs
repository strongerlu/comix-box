use keyring::Entry;

const KEYCHAIN_SERVICE: &str = "com.comicbox.app";
const KEYCHAIN_ACCOUNT: &str = "primary-api-key";
const GATEWAY_SESSION_ACCOUNT: &str = "gateway-session-token";
const COMFY_WORKFLOW_ACCOUNT: &str = "comfy-workflow-api-key";
const REMOTE_BRIDGE_IDENTITY_ACCOUNT: &str = "remote-bridge-identity-v1";
const REMOTE_BRIDGE_DEVICES_ACCOUNT: &str = "remote-bridge-devices-v1";
const REMOTE_BRIDGE_RELAY_ACCOUNT: &str = "remote-bridge-relay-v1";

/// CLI tools (jc_media.py etc.) 读取 Key 的文件路径
fn cli_key_file_path() -> std::path::PathBuf {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string());
    std::path::PathBuf::from(home)
        .join(".comic-box")
        .join(".jc_api_key")
}

/// 将 Key 同步写入 ~/.comic-box/.jc_api_key，供 CLI 工具读取
fn sync_key_to_cli_file(key: &str) -> Result<(), String> {
    let path = cli_key_file_path();
    sync_key_file(&path, key)
}

fn sync_key_file(path: &std::path::Path, key: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| format!("创建 API Key 目录失败: {error}"))?;
    }
    let temporary = path.with_extension(format!("tmp-{}", uuid::Uuid::new_v4()));
    let result: Result<(), String> = (|| {
        use std::io::Write;
        let mut file = std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)
            .map_err(|error| format!("创建 API Key 临时文件失败: {error}"))?;
        file.write_all(key.trim().as_bytes())
            .and_then(|()| file.sync_all())
            .map_err(|error| format!("写入 API Key 文件失败: {error}"))?;
        std::fs::rename(&temporary, &path).map_err(|error| format!("替换 API Key 文件失败: {error}"))?;
        Ok(())
    })();
    if result.is_err() { let _ = std::fs::remove_file(&temporary); }
    result?;
    // 设置权限 600（仅 owner 可读写）

    Ok(())
}

#[cfg(test)]
mod cli_key_file_tests {
    use super::*;

    #[test]
    fn atomically_replaces_the_existing_key_file() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join(".jc_api_key");
        std::fs::write(&path, "old-key").unwrap();

        sync_key_file(&path, "  new-key  ").unwrap();

        assert_eq!(std::fs::read_to_string(&path).unwrap(), "new-key");
        assert_eq!(std::fs::read_dir(directory.path()).unwrap().count(), 1);
    }

    #[test]
    fn reports_a_directory_creation_failure() {
        let directory = tempfile::tempdir().unwrap();
        let parent_file = directory.path().join("not-a-directory");
        std::fs::write(&parent_file, "occupied").unwrap();

        let error = sync_key_file(&parent_file.join(".jc_api_key"), "key").unwrap_err();

        assert!(error.contains("创建 API Key 目录失败"));
    }
}

#[cfg(all(test, target_os = "windows"))]
mod windows_keyring_tests {
    use super::*;

    const SERVICE: &str = "com.comicbox.windows-keyring-test";
    const SERVICE_ENV: &str = "COMICBOX_KEYRING_TEST_SERVICE";
    const ACCOUNT_ENV: &str = "COMICBOX_KEYRING_TEST_ACCOUNT";
    const PASSWORD_ENV: &str = "COMICBOX_KEYRING_TEST_PASSWORD";

    #[test]
    fn credential_reader_process() {
        let (Ok(service), Ok(account), Ok(password)) = (
            std::env::var(SERVICE_ENV),
            std::env::var(ACCOUNT_ENV),
            std::env::var(PASSWORD_ENV),
        ) else { return };
        let entry = Entry::new(&service, &account).unwrap();
        assert_eq!(entry.get_password().unwrap(), password);
    }

    #[test]
    fn credential_survives_entry_recreation_and_process_restart() {
        let account = format!("probe-{}", uuid::Uuid::new_v4());
        let password = format!("test-only-{}", uuid::Uuid::new_v4());
        Entry::new(SERVICE, &account).unwrap().set_password(&password).unwrap();

        let mut child = std::process::Command::new(std::env::current_exe().unwrap());
        super::super::commands::tools::configure_background_command(&mut child);
        let result = child
            .args(["--exact", "secure_store::windows_keyring_tests::credential_reader_process"])
            .env(SERVICE_ENV, SERVICE)
            .env(ACCOUNT_ENV, &account)
            .env(PASSWORD_ENV, &password)
            .output();
        let _ = Entry::new(SERVICE, &account).unwrap().delete_credential();
        let output = result.unwrap();
        assert!(output.status.success(), "child keyring read failed: {}", String::from_utf8_lossy(&output.stderr));
    }
}

/// 删除 CLI Key 文件（清除 Key 时）
fn clear_cli_key_file() -> Result<(), String> {
    let path = cli_key_file_path();
    match std::fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("删除 API Key 文件失败: {error}")),
    }
}

fn entry() -> Result<Entry, String> {
    Entry::new(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT).map_err(|error| error.to_string())
}

fn gateway_session_entry() -> Result<Entry, String> {
    Entry::new(KEYCHAIN_SERVICE, GATEWAY_SESSION_ACCOUNT).map_err(|error| error.to_string())
}

fn comfy_workflow_entry() -> Result<Entry, String> {
    Entry::new(KEYCHAIN_SERVICE, COMFY_WORKFLOW_ACCOUNT).map_err(|error| error.to_string())
}

fn remote_bridge_entry(account: &str) -> Result<Entry, String> {
    Entry::new(KEYCHAIN_SERVICE, account).map_err(|error| error.to_string())
}

pub(crate) fn get_remote_bridge_identity() -> Result<Option<String>, String> {
    get_entry_value(remote_bridge_entry(REMOTE_BRIDGE_IDENTITY_ACCOUNT)?)
}

pub(crate) fn set_remote_bridge_identity(value: &str) -> Result<(), String> {
    remote_bridge_entry(REMOTE_BRIDGE_IDENTITY_ACCOUNT)?
        .set_password(value)
        .map_err(|error| error.to_string())
}

pub(crate) fn get_remote_bridge_devices() -> Result<Option<String>, String> {
    get_entry_value(remote_bridge_entry(REMOTE_BRIDGE_DEVICES_ACCOUNT)?)
}

pub(crate) fn set_remote_bridge_devices(value: &str) -> Result<(), String> {
    remote_bridge_entry(REMOTE_BRIDGE_DEVICES_ACCOUNT)?
        .set_password(value)
        .map_err(|error| error.to_string())
}

/// 手机控制器中继的房间号与密钥（M3b），与 Desktop 的 Noise 身份同级保管。
pub(crate) fn get_remote_bridge_relay() -> Result<Option<String>, String> {
    get_entry_value(remote_bridge_entry(REMOTE_BRIDGE_RELAY_ACCOUNT)?)
}

pub(crate) fn set_remote_bridge_relay(value: &str) -> Result<(), String> {
    remote_bridge_entry(REMOTE_BRIDGE_RELAY_ACCOUNT)?
        .set_password(value)
        .map_err(|error| error.to_string())
}

fn mcp_oauth_entry(server_id: &str) -> Result<Entry, String> {
    let id = server_id.trim();
    if id.is_empty()
        || !id
            .chars()
            .all(|char| char.is_ascii_alphanumeric() || char == '-' || char == '_')
    {
        return Err("无效的 MCP server id".to_string());
    }
    Entry::new(KEYCHAIN_SERVICE, &format!("mcp-oauth-{id}")).map_err(|error| error.to_string())
}

fn mcp_server_secret_entry(server_id: &str) -> Result<Entry, String> {
    let id = server_id.trim();
    if id.is_empty()
        || !id
            .chars()
            .all(|char| char.is_ascii_alphanumeric() || char == '-' || char == '_')
    {
        return Err("无效的 MCP server id".to_string());
    }
    Entry::new(KEYCHAIN_SERVICE, &format!("mcp-server-secret-{id}"))
        .map_err(|error| error.to_string())
}

fn get_entry_value(entry: Entry) -> Result<Option<String>, String> {
    match entry.get_password() {
        Ok(value) if !value.trim().is_empty() => Ok(Some(value)),
        Ok(_) => Ok(None),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

fn set_entry_value(
    entry: Entry,
    value: String,
    clear: fn() -> Result<(), String>,
) -> Result<(), String> {
    let clean = value.trim();
    if clean.is_empty() {
        return clear();
    }
    entry.set_password(clean).map_err(|error| error.to_string())
}

fn clear_entry_value(entry: Entry) -> Result<(), String> {
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
pub fn get_api_key() -> Result<Option<String>, String> {
    get_entry_value(entry()?)
}

/// 兜底：直接从 CLI 文件读取 Key（Skill 同款路径）
/// 用于 Keychain 不可用时的降级方案
#[tauri::command]
pub fn get_cli_api_key() -> Result<Option<String>, String> {

    {
        let path = cli_key_file_path();
        match std::fs::read_to_string(&path) {
            Ok(content) => {
                let trimmed = content.trim().to_string();
                if trimmed.is_empty() {
                    Ok(None)
                } else {
                    Ok(Some(trimmed))
                }
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
            Err(e) => Err(e.to_string()),
        }
    }
}

#[tauri::command]
pub fn set_api_key(api_key: String) -> Result<(), String> {
    if api_key.trim().is_empty() {
        return clear_api_key();
    }
    entry()?
        .set_password(api_key.trim())
        .map_err(|error| error.to_string())?;
    sync_key_to_cli_file(&api_key)
}

#[tauri::command]
pub fn clear_api_key() -> Result<(), String> {
    clear_entry_value(entry()?)?;
    clear_cli_key_file()
}

#[tauri::command]
pub fn get_gateway_session_token() -> Result<Option<String>, String> {
    get_entry_value(gateway_session_entry()?)
}

#[tauri::command]
pub fn set_gateway_session_token(token: String) -> Result<(), String> {
    set_entry_value(gateway_session_entry()?, token, clear_gateway_session_token)
}

#[tauri::command]
pub fn clear_gateway_session_token() -> Result<(), String> {
    clear_entry_value(gateway_session_entry()?)
}

#[tauri::command]
pub fn get_comfy_service_credential() -> Result<Option<String>, String> {
    get_entry_value(remote_bridge_entry("comfy-service-credential")?)
}

#[tauri::command]
pub fn get_comfy_workflow_api_key() -> Result<Option<String>, String> {
    get_entry_value(comfy_workflow_entry()?)
}

#[tauri::command]
pub fn set_comfy_workflow_api_key(value: String) -> Result<(), String> {
    set_entry_value(comfy_workflow_entry()?, value, clear_comfy_workflow_api_key)
}

#[tauri::command]
pub fn clear_comfy_workflow_api_key() -> Result<(), String> {
    clear_entry_value(comfy_workflow_entry()?)
}

#[tauri::command]
pub fn get_mcp_oauth_credential(server_id: String) -> Result<Option<String>, String> {
    get_entry_value(mcp_oauth_entry(&server_id)?)
}

#[tauri::command]
pub fn set_mcp_oauth_credential(server_id: String, value: String) -> Result<(), String> {
    let entry = mcp_oauth_entry(&server_id)?;
    let clean = value.trim();
    if clean.is_empty() {
        return clear_entry_value(entry);
    }
    entry.set_password(clean).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn clear_mcp_oauth_credential(server_id: String) -> Result<(), String> {
    clear_entry_value(mcp_oauth_entry(&server_id)?)
}

#[tauri::command]
pub fn get_mcp_server_secret(server_id: String) -> Result<Option<String>, String> {
    get_entry_value(mcp_server_secret_entry(&server_id)?)
}

#[tauri::command]
pub fn set_mcp_server_secret(server_id: String, value: String) -> Result<(), String> {
    let entry = mcp_server_secret_entry(&server_id)?;
    let clean = value.trim();
    if clean.is_empty() {
        return clear_entry_value(entry);
    }
    entry.set_password(clean).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn clear_mcp_server_secret(server_id: String) -> Result<(), String> {
    clear_entry_value(mcp_server_secret_entry(&server_id)?)
}

/// Reuse the durable CLI credential location; task JSON contains only a digest reference.
fn media_key_directory() -> std::path::PathBuf {
    cli_key_file_path().parent().unwrap().join("download-keys")
}

fn retain_download_key_at(root: &std::path::Path, key: &str) -> Result<String, String> {
    use sha2::{Digest, Sha256};
    let key = key.trim();
    if key.is_empty() { return Err("缺少任务提交密钥".into()); }
    if std::fs::symlink_metadata(root).is_ok_and(|m| m.file_type().is_symlink()) { return Err("下载凭据目录不能是符号链接".into()); }
    std::fs::create_dir_all(root).map_err(|_| "创建下载凭据目录失败")?;

    let reference = format!("{:x}", Sha256::digest(key.as_bytes()));
    let path = root.join(&reference);
    if path.exists() { read_download_key_at(root, &reference)?; return Ok(reference); }
    let staged = root.join(format!(".{reference}.{}.tmp", uuid::Uuid::new_v4()));
    let mut options = std::fs::OpenOptions::new();
    options.write(true).create_new(true);

    let mut file = options.open(&staged).map_err(|_| "保存任务下载密钥失败")?;
    use std::io::Write;
    file.write_all(key.as_bytes()).and_then(|_| file.sync_all()).map_err(|_| "保存任务下载密钥失败")?;
    drop(file);
    // Link publishes a fully written credential without replacing an existing file.
    let result = std::fs::hard_link(&staged, &path);
    let _ = std::fs::remove_file(staged);
    if result.is_err() { read_download_key_at(root, &reference)?; }
    Ok(reference)
}

#[tauri::command]
pub fn retain_media_download_key(api_key: String) -> Result<String, String> {
    retain_download_key_at(&media_key_directory(), &api_key)
}

pub(crate) fn media_download_key(reference: &str) -> Result<String, String> {
    read_download_key_at(&media_key_directory(), reference)
}

fn read_download_key_at(root: &std::path::Path, reference: &str) -> Result<String, String> {
    use sha2::{Digest, Sha256};
    if reference.len() != 64 || !reference.bytes().all(|byte| byte.is_ascii_hexdigit()) { return Err("无效的下载密钥引用".into()); }
    let path = root.join(reference);
    if std::fs::symlink_metadata(&path).is_ok_and(|m| m.file_type().is_symlink()) { return Err("下载凭据不能是符号链接".into()); }
    let key = std::fs::read_to_string(path).map_err(|_| "任务提交密钥已不可用，请恢复对应密钥后重试下载")?;
    if format!("{:x}", Sha256::digest(key.as_bytes())) != reference { return Err("任务下载密钥校验失败".into()); }
    Ok(key)
}

#[cfg(test)]
mod download_key_tests {
    use super::*;
    #[test]
    fn references_survive_a_key_switch_without_putting_credentials_in_tasks() {
        let root = tempfile::TempDir::new().unwrap();
        let first = retain_download_key_at(root.path(), "local-first").unwrap();
        let second = retain_download_key_at(root.path(), "local-second").unwrap();
        assert_ne!(first, second);
        assert_eq!(read_download_key_at(root.path(), &first).unwrap(), "local-first");
        assert_eq!(retain_download_key_at(root.path(), "local-first").unwrap(), first);
        assert!(read_download_key_at(root.path(), "../escape").is_err());

    }
}

#[tauri::command]
pub fn get_media_download_key(reference: String) -> Result<String, String> {
    media_download_key(&reference)
}
