use tauri::Monitor;

// ponytail: 一个目标屏最大 256 MiB RGBA；更大屏需要调整资源预算，不无限解码。
pub const MAX_RGBA: usize = 256 * 1024 * 1024;
pub struct Frame {
    pub width: u32,
    pub height: u32,
    pub rgba: Vec<u8>,
}
impl Frame {
    pub fn validate(&self) -> Result<(), String> {
        let size = (self.width as usize)
            .checked_mul(self.height as usize)
            .and_then(|n| n.checked_mul(4));
        if self.width == 0
            || self.height == 0
            || size != Some(self.rgba.len())
            || self.rgba.len() > MAX_RGBA
        {
            return Err("截图尺寸或数据无效（单屏上限 256 MiB）".into());
        }
        Ok(())
    }
    pub fn png(&self) -> Result<Vec<u8>, String> {
        self.validate()?;
        let mut bytes = Vec::new();
        let mut encoder = png::Encoder::new(&mut bytes, self.width, self.height);
        encoder.set_color(png::ColorType::Rgba);
        encoder.set_depth(png::BitDepth::Eight);
        encoder
            .write_header()
            .map_err(|e| e.to_string())?
            .write_image_data(&self.rgba)
            .map_err(|e| e.to_string())?;
        Ok(bytes)
    }
    pub fn crop(&self, [x, y, w, h]: [u32; 4]) -> Self {
        let mut rgba = Vec::with_capacity(w as usize * h as usize * 4);
        for row in y..y + h {
            let start = (row as usize * self.width as usize + x as usize) * 4;
            rgba.extend_from_slice(&self.rgba[start..start + w as usize * 4]);
        }
        Self {
            width: w,
            height: h,
            rgba,
        }
    }
}

#[cfg(target_os = "windows")]
pub fn capture(monitor: &Monitor) -> Result<Frame, String> {
    // Windows 使用物理桌面坐标；匹配 Tauri 选中的同一屏。
    let target = xcap::Monitor::all()
        .map_err(|e| e.to_string())?
        .into_iter()
        .find(|m| {
            m.x().ok() == Some(monitor.position().x) && m.y().ok() == Some(monitor.position().y)
        })
        .ok_or("目标显示器已拔出")?;
    let size = (target.width().map_err(|e| e.to_string())? as usize)
        .checked_mul(target.height().map_err(|e| e.to_string())? as usize)
        .and_then(|n| n.checked_mul(4));
    if size.is_none_or(|n| n > MAX_RGBA) {
        return Err("目标屏幕超过 256 MiB 捕获上限".into());
    }
    let image = target.capture_image().map_err(|e| e.to_string())?;
    let frame = Frame {
        width: image.width(),
        height: image.height(),
        rgba: image.into_raw(),
    };
    frame.validate()?;
    Ok(frame)
}

pub fn permission(_request: bool) -> bool {
    true
}

pub fn target_monitor(app: &tauri::AppHandle) -> Result<Monitor, String> {
    #[cfg(target_os = "windows")]
    let point = app.cursor_position().map_err(|e| e.to_string())?;
    app.monitor_from_point(point.x, point.y)
        .map_err(|e| e.to_string())?
        .ok_or("鼠标不在可用显示器上".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn png_and_crop_preserve_exact_pixels() {
        let frame = Frame {
            width: 3,
            height: 2,
            rgba: (0..24).collect(),
        };
        let cropped = frame.crop([1, 0, 2, 2]);
        assert_eq!(
            cropped.rgba,
            [&frame.rgba[4..12], &frame.rgba[16..24]].concat()
        );
        let bytes = cropped.png().unwrap();
        let mut reader = png::Decoder::new(std::io::Cursor::new(bytes))
            .read_info()
            .unwrap();
        let mut output = vec![0; reader.output_buffer_size()];
        let info = reader.next_frame(&mut output).unwrap();
        assert_eq!((info.width, info.height), (2, 2));
        assert_eq!(&output[..info.buffer_size()], cropped.rgba.as_slice());
        assert!(
            Frame {
                width: 2,
                height: 2,
                rgba: vec![0; 3]
            }
            .png()
            .is_err()
        );
    }
}
