use crate::{AppError, HealthCheck};

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
