use serde::{Deserialize, Serialize};
use thiserror::Error;

mod commands;
mod db;

pub use db::DbState;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Error de base de datos: {0}")]
    Database(#[from] rusqlite::Error),
    #[error("Error de serialización: {0}")]
    Serialization(#[from] serde_json::Error),
    #[error("Entidad no encontrada: {0}")]
    NotFound(String),
    #[error("Validación: {0}")]
    Validation(String),
    #[error("Error interno: {0}")]
    Internal(String),
}

impl Serialize for AppError {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HealthCheck {
    pub status: String,
    pub version: String,
    pub database: bool,
    pub timestamp: String,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .manage(db::DbState::default())
        .invoke_handler(tauri::generate_handler![
            commands::health_check,
            commands::app_version,
        ])
        .run(tauri::generate_context!())
        .expect("Error fatal al iniciar la aplicación");
}
