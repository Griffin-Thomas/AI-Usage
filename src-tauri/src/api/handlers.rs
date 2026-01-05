//! API request handlers

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager};

use super::ApiState;
use crate::models::{HistoryQuery, UsageData, UsageHistoryEntry, UsageLimit};
use crate::providers::ProviderRegistry;
use crate::services::{CredentialService, HistoryService};

/// Health check response
#[derive(Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub version: String,
}

/// Status response containing all accounts
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusResponse {
    pub timestamp: DateTime<Utc>,
    pub accounts: Vec<AccountStatus>,
}

/// Status for a single account
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountStatus {
    pub id: String,
    pub name: String,
    pub provider: String,
    pub limits: Vec<UsageLimit>,
    pub last_updated: DateTime<Utc>,
    pub session_valid: bool,
}

/// Account info (without credentials)
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountInfo {
    pub id: String,
    pub name: String,
    pub provider: String,
    pub created_at: DateTime<Utc>,
}

/// Accounts list response
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountsResponse {
    pub accounts: Vec<AccountInfo>,
}

/// History query parameters
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryParams {
    pub provider: Option<String>,
    pub account_id: Option<String>,
    pub start_date: Option<DateTime<Utc>>,
    pub end_date: Option<DateTime<Utc>>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

/// History response
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryResponse {
    pub entries: Vec<UsageHistoryEntry>,
    pub total: usize,
}

/// Refresh response
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RefreshResponse {
    pub success: bool,
    pub message: String,
}

/// Error response
#[derive(Serialize)]
pub struct ErrorResponse {
    pub error: String,
}

/// GET /health - Health check endpoint
pub async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

/// GET /status - Get usage status for all accounts
pub async fn status(
    State(state): State<ApiState>,
) -> Result<Json<StatusResponse>, (StatusCode, Json<ErrorResponse>)> {
    let accounts = get_all_account_statuses(&state).await?;

    Ok(Json(StatusResponse {
        timestamp: Utc::now(),
        accounts,
    }))
}

/// GET /status/:account_id - Get usage status for a specific account
pub async fn status_by_account(
    State(state): State<ApiState>,
    Path(account_id): Path<String>,
) -> Result<Json<AccountStatus>, (StatusCode, Json<ErrorResponse>)> {
    let accounts = get_all_account_statuses(&state).await?;

    accounts
        .into_iter()
        .find(|a| a.id == account_id)
        .map(Json)
        .ok_or_else(|| {
            (
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: format!("Account not found: {}", account_id),
                }),
            )
        })
}

/// GET /accounts - List all accounts (without credentials)
pub async fn accounts(
    State(state): State<ApiState>,
) -> Result<Json<AccountsResponse>, (StatusCode, Json<ErrorResponse>)> {
    // Get accounts for all providers
    let mut all_accounts = Vec::new();

    let registry = ProviderRegistry::default();
    for provider_id in registry.available_ids() {
        match CredentialService::list_accounts(&state.app, provider_id) {
            Ok(accounts) => {
                for account in accounts {
                    all_accounts.push(AccountInfo {
                        id: account.id,
                        name: account.name,
                        provider: account.provider,
                        created_at: account.created_at,
                    });
                }
            }
            Err(e) => {
                log::warn!("Failed to list accounts for {}: {}", provider_id, e);
            }
        }
    }

    Ok(Json(AccountsResponse {
        accounts: all_accounts,
    }))
}

/// GET /history - Query usage history
pub async fn history(
    State(state): State<ApiState>,
    Query(params): Query<HistoryParams>,
) -> Result<Json<HistoryResponse>, (StatusCode, Json<ErrorResponse>)> {
    let query = HistoryQuery {
        provider: params.provider,
        account_id: params.account_id,
        start_date: params.start_date,
        end_date: params.end_date,
        limit: params.limit,
        offset: params.offset,
    };

    match HistoryService::query(&state.app, &query) {
        Ok(entries) => {
            let total = entries.len();
            Ok(Json(HistoryResponse { entries, total }))
        }
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("Failed to query history: {}", e),
            }),
        )),
    }
}

/// POST /refresh - Trigger an immediate usage refresh
pub async fn refresh(
    State(state): State<ApiState>,
) -> Result<Json<RefreshResponse>, (StatusCode, Json<ErrorResponse>)> {
    // Check if we can fetch (rate limiting)
    if !state.scheduler_state.can_fetch() {
        return Ok(Json(RefreshResponse {
            success: false,
            message: "Rate limited. Please wait before refreshing again.".to_string(),
        }));
    }

    // Trigger refresh by emitting event to frontend
    // The frontend will then trigger the actual refresh through the scheduler
    if let Some(window) = state.app.get_webview_window("main") {
        let _ = window.emit("tray-refresh", ());
    }

    Ok(Json(RefreshResponse {
        success: true,
        message: "Refresh triggered".to_string(),
    }))
}

/// Helper to get status for all accounts
async fn get_all_account_statuses(
    state: &ApiState,
) -> Result<Vec<AccountStatus>, (StatusCode, Json<ErrorResponse>)> {
    let mut statuses = Vec::new();

    let registry = ProviderRegistry::default();
    for provider_id in registry.available_ids() {
        let accounts = match CredentialService::list_accounts(&state.app, provider_id) {
            Ok(accounts) => accounts,
            Err(e) => {
                log::warn!("Failed to list accounts for {}: {}", provider_id, e);
                continue;
            }
        };

        for account in accounts {
            // Get session status
            let session_valid = !state.scheduler_state.is_account_paused(&account.id).await;
            let error_count = state.scheduler_state.get_account_error_count(&account.id).await;

            // Try to get cached usage from scheduler state
            let (limits, last_updated) = match state
                .scheduler_state
                .get_previous_usage(&account.id)
                .await
            {
                Some(usage) => (usage.limits, usage.timestamp),
                None => {
                    // No cached data, try to fetch fresh
                    match fetch_usage_for_account(state, &account.id).await {
                        Ok(usage) => (usage.limits, usage.timestamp),
                        Err(_) => (vec![], Utc::now()),
                    }
                }
            };

            statuses.push(AccountStatus {
                id: account.id,
                name: account.name,
                provider: account.provider,
                limits,
                last_updated,
                session_valid: session_valid && error_count == 0,
            });
        }
    }

    Ok(statuses)
}

/// Helper to fetch usage for a specific account
async fn fetch_usage_for_account(
    state: &ApiState,
    account_id: &str,
) -> Result<UsageData, String> {
    let account = CredentialService::get_account(&state.app, account_id)
        .map_err(|e| format!("Failed to get account: {}", e))?
        .ok_or_else(|| format!("Account not found: {}", account_id))?;

    let registry = ProviderRegistry::default();
    let provider = registry
        .get(&account.provider)
        .ok_or_else(|| format!("Provider not found: {}", account.provider))?;

    provider
        .fetch_usage(&account.credentials)
        .await
        .map(|mut data| {
            data.account_id = account.id.clone();
            data.account_name = account.name.clone();
            data
        })
        .map_err(|e| format!("Failed to fetch usage: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn health_response_serialization() {
        let response = HealthResponse {
            status: "ok".to_string(),
            version: "0.17.0".to_string(),
        };
        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("\"status\":\"ok\""));
        assert!(json.contains("\"version\":\"0.17.0\""));
    }

    #[test]
    fn error_response_serialization() {
        let response = ErrorResponse {
            error: "Something went wrong".to_string(),
        };
        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("\"error\":\"Something went wrong\""));
    }

    #[test]
    fn refresh_response_serialization() {
        let response = RefreshResponse {
            success: true,
            message: "Refresh triggered".to_string(),
        };
        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("\"success\":true"));
        assert!(json.contains("\"message\":\"Refresh triggered\""));
    }
}
