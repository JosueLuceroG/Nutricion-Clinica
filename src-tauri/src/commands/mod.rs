use crate::{AppError, HealthCheck};
use std::path::Path;
use std::process::Command;
use tauri::Manager;

#[tauri::command]
pub fn health_check() -> HealthCheck {
    HealthCheck {
        status: "ok".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        database: false,
        timestamp: chrono_now(),
    }
}

#[tauri::command]
pub fn app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
pub fn save_and_open_csv(
    app: tauri::AppHandle,
    file_name: String,
    content: String,
) -> Result<String, AppError> {
    let safe_name: String = file_name
        .chars()
        .filter(|character| {
            character.is_alphanumeric() || matches!(character, '-' | '_' | '.')
        })
        .collect();
    let safe_name = if safe_name.to_lowercase().ends_with(".csv") {
        safe_name
    } else {
        format!("{safe_name}.csv")
    };
    let path = app
        .path()
        .download_dir()
        .map_err(|error| AppError::Internal(error.to_string()))?
        .join(safe_name);

    std::fs::write(&path, content.as_bytes())?;
    open_file(&path)?;
    Ok(path.to_string_lossy().into_owned())
}

fn open_file(path: &Path) -> Result<(), AppError> {
    #[cfg(target_os = "windows")]
    Command::new("explorer.exe").arg(path).spawn()?;

    #[cfg(target_os = "macos")]
    Command::new("open").arg(path).spawn()?;

    #[cfg(all(unix, not(target_os = "macos")))]
    Command::new("xdg-open").arg(path).spawn()?;

    Ok(())
}

fn chrono_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("{}s", now)
}

pub fn ping() -> Result<(), AppError> {
    Ok(())
}
