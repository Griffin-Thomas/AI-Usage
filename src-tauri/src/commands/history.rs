use crate::models::{HistoryMetadata, HistoryQuery, RetentionPolicy, UsageHistoryEntry, UsageStats};
use crate::services::HistoryService;
use tauri::AppHandle;

/// Query history entries with optional filters
#[tauri::command]
pub async fn query_history(
    app: AppHandle,
    query: Option<HistoryQuery>,
) -> Result<Vec<UsageHistoryEntry>, String> {
    log::info!("Querying history with filter: {:?}", query);

    let query = query.unwrap_or(HistoryQuery {
        provider: None,
        account_id: None,
        start_date: None,
        end_date: None,
        limit: Some(1000),
        offset: None,
    });

    HistoryService::query(&app, &query).map_err(|e| e.to_string())
}

/// Get history metadata
#[tauri::command]
pub async fn get_history_metadata(app: AppHandle) -> Result<HistoryMetadata, String> {
    log::info!("Getting history metadata");
    HistoryService::get_metadata(&app).map_err(|e| e.to_string())
}

/// Get retention policy
#[tauri::command]
pub async fn get_retention_policy(app: AppHandle) -> Result<RetentionPolicy, String> {
    log::info!("Getting retention policy");
    HistoryService::get_retention_policy(&app).map_err(|e| e.to_string())
}

/// Set retention policy
#[tauri::command]
pub async fn set_retention_policy(app: AppHandle, policy: RetentionPolicy) -> Result<(), String> {
    log::info!("Setting retention policy: {:?}", policy);
    HistoryService::set_retention_policy(&app, &policy).map_err(|e| e.to_string())
}

/// Clean up old history entries
#[tauri::command]
pub async fn cleanup_history(app: AppHandle) -> Result<usize, String> {
    log::info!("Cleaning up history");
    HistoryService::cleanup(&app).map_err(|e| e.to_string())
}

/// Get usage statistics for a time period
#[tauri::command]
pub async fn get_usage_stats(
    app: AppHandle,
    provider: String,
    limit_id: String,
    start: String,
    end: String,
) -> Result<Option<UsageStats>, String> {
    log::info!(
        "Getting usage stats for {} / {} from {} to {}",
        provider,
        limit_id,
        start,
        end
    );

    let start_dt = chrono::DateTime::parse_from_rfc3339(&start)
        .map_err(|e| format!("Invalid start date: {}", e))?
        .with_timezone(&chrono::Utc);

    let end_dt = chrono::DateTime::parse_from_rfc3339(&end)
        .map_err(|e| format!("Invalid end date: {}", e))?
        .with_timezone(&chrono::Utc);

    HistoryService::get_stats(&app, &provider, &limit_id, start_dt, end_dt)
        .map_err(|e| e.to_string())
}

/// Export history to JSON
#[tauri::command]
pub async fn export_history_json(
    app: AppHandle,
    query: Option<HistoryQuery>,
) -> Result<String, String> {
    log::info!("Exporting history to JSON");
    HistoryService::export_json(&app, query.as_ref()).map_err(|e| e.to_string())
}

/// Export history to CSV
#[tauri::command]
pub async fn export_history_csv(
    app: AppHandle,
    query: Option<HistoryQuery>,
) -> Result<String, String> {
    log::info!("Exporting history to CSV");
    HistoryService::export_csv(&app, query.as_ref()).map_err(|e| e.to_string())
}

/// Clear all history data
#[tauri::command]
pub async fn clear_history(app: AppHandle) -> Result<(), String> {
    log::info!("Clearing all history");
    HistoryService::clear_all(&app).map_err(|e| e.to_string())
}
