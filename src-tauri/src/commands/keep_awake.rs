//! 远程控制会话期间阻止 Windows 闲置睡眠，屏幕照常熄灭。

/// 持有期间阻止闲置睡眠。
pub struct KeepAwake {

    /// Windows 的执行状态按线程生效：专门一条线程设好后等着，放下时让它复位退出。
    #[cfg(windows)]
    release: Option<std::sync::mpsc::Sender<()>>,
}

#[cfg(windows)]
pub fn hold() -> Result<KeepAwake, String> {
    use windows_sys::Win32::System::Power::{
        ES_CONTINUOUS, ES_SYSTEM_REQUIRED, SetThreadExecutionState,
    };
    let (release, wait) = std::sync::mpsc::channel::<()>();
    std::thread::spawn(move || {
        unsafe { SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED) };
        let _ = wait.recv();
        unsafe { SetThreadExecutionState(ES_CONTINUOUS) };
    });
    Ok(KeepAwake {
        release: Some(release),
    })
}

impl Drop for KeepAwake {
    fn drop(&mut self) {

        #[cfg(windows)]
        if let Some(release) = self.release.take() {
            let _ = release.send(());
        }
    }
}
