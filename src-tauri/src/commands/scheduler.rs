use crate::error::AppError;
use crate::services::{SchedulerService, SchedulerState, SettingsService};
use std::sync::Arc;
use tauri::{AppHandle, State};

/// Get the current scheduler status
#[tauri::command]
pub fn get_scheduler_status(state: State<'_, Arc<SchedulerState>>) -> SchedulerStatusResponse {
    SchedulerStatusResponse {
        running: state.is_running(),
        interval_secs: state.get_interval(),
        last_fetch: state.get_last_fetch(),
    }
}

/// Start the background scheduler
#[tauri::command]
pub fn start_scheduler(app: AppHandle, state: State<'_, Arc<SchedulerState>>) {
    SchedulerService::start(app, state.inner().clone());
}

/// Stop the background scheduler
#[tauri::command]
pub fn stop_scheduler(app: AppHandle, state: State<'_, Arc<SchedulerState>>) {
    SchedulerService::stop(&app, &state);
}

/// Set the refresh interval
#[tauri::command]
pub fn set_refresh_interval(
    app: AppHandle,
    state: State<'_, Arc<SchedulerState>>,
    interval_secs: u64,
) {
    SchedulerService::set_interval(&app, &state, interval_secs);

    // Also update settings
    if let Ok(mut settings) = SettingsService::get(&app) {
        settings.refresh_interval = interval_secs as u32;
        let _ = SettingsService::save(&app, &settings);
    }
}

/// Force an immediate refresh
#[tauri::command]
pub async fn force_refresh(
    app: AppHandle,
    state: State<'_, Arc<SchedulerState>>,
) -> Result<(), AppError> {
    SchedulerService::force_refresh(&app, &state).await
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SchedulerStatusResponse {
    pub running: bool,
    pub interval_secs: u64,
    pub last_fetch: u64,
}
