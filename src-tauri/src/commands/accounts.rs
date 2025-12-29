use crate::error::{AppError, ProviderError};
use crate::models::Account;
use crate::providers::ProviderRegistry;
use crate::services::CredentialService;
use tauri::AppHandle;

use super::usage::TestConnectionResult;

/// List all accounts for a provider
#[tauri::command]
pub async fn list_accounts(app: AppHandle, provider: String) -> Result<Vec<Account>, AppError> {
    log::info!("Listing accounts for provider: {}", provider);
    CredentialService::list_accounts(&app, &provider)
}

/// Get a specific account by ID
#[tauri::command]
pub async fn get_account(app: AppHandle, account_id: String) -> Result<Option<Account>, AppError> {
    log::info!("Getting account: {}", account_id);
    CredentialService::get_account(&app, &account_id)
}

/// Save (create or update) an account
#[tauri::command]
pub async fn save_account(app: AppHandle, account: Account) -> Result<(), AppError> {
    log::info!("Saving account: {} ({})", account.name, account.id);
    CredentialService::save_account(&app, &account)
}

/// Delete an account by ID
#[tauri::command]
pub async fn delete_account(app: AppHandle, account_id: String) -> Result<(), AppError> {
    log::info!("Deleting account: {}", account_id);
    CredentialService::delete_account(&app, &account_id)
}

/// Test connection for an account
#[tauri::command]
pub async fn test_account_connection(account: Account) -> Result<TestConnectionResult, AppError> {
    log::info!("Testing connection for account: {} ({})", account.name, account.id);

    let registry = ProviderRegistry::new()?;

    let provider_impl = match registry.get(&account.provider) {
        Some(p) => p,
        None => {
            return Ok(TestConnectionResult {
                success: false,
                error_code: Some("PROVIDER_UNAVAILABLE".to_string()),
                error_message: Some(format!("Provider '{}' is not available", account.provider)),
                hint: Some("This provider is currently blocked or not supported.".to_string()),
            });
        }
    };

    // First validate format
    if !provider_impl.validate_credentials(&account.credentials) {
        return Ok(TestConnectionResult {
            success: false,
            error_code: Some("INVALID_FORMAT".to_string()),
            error_message: Some("Credentials format is invalid".to_string()),
            hint: Some("Please ensure both Organization ID and Session Key are provided.".to_string()),
        });
    }

    // Try to fetch usage
    match provider_impl.fetch_usage(&account.credentials).await {
        Ok(_) => Ok(TestConnectionResult {
            success: true,
            error_code: None,
            error_message: None,
            hint: None,
        }),
        Err(ProviderError::SessionExpired) => Ok(TestConnectionResult {
            success: false,
            error_code: Some("SESSION_EXPIRED".to_string()),
            error_message: Some("Your session has expired".to_string()),
            hint: Some("Please get a fresh session key from Claude.ai. Open DevTools → Application → Cookies → copy sessionKey.".to_string()),
        }),
        Err(ProviderError::CloudflareBlocked) => Ok(TestConnectionResult {
            success: false,
            error_code: Some("CLOUDFLARE_BLOCKED".to_string()),
            error_message: Some("Request was blocked by Cloudflare".to_string()),
            hint: Some("This may be a temporary issue. Please try again in a few minutes.".to_string()),
        }),
        Err(ProviderError::RateLimited) => Ok(TestConnectionResult {
            success: false,
            error_code: Some("RATE_LIMITED".to_string()),
            error_message: Some("Too many requests".to_string()),
            hint: Some("Please wait a moment before trying again.".to_string()),
        }),
        Err(ProviderError::MissingCredentials(field)) => Ok(TestConnectionResult {
            success: false,
            error_code: Some("MISSING_CREDENTIALS".to_string()),
            error_message: Some(format!("Missing required field: {}", field)),
            hint: Some("Please provide all required credentials.".to_string()),
        }),
        Err(ProviderError::InvalidCredentials(msg)) => Ok(TestConnectionResult {
            success: false,
            error_code: Some("INVALID_CREDENTIALS".to_string()),
            error_message: Some(msg),
            hint: Some("Please check your credentials and try again.".to_string()),
        }),
        Err(ProviderError::HttpError(msg)) => {
            let hint = if msg.contains("404") {
                Some("The Organization ID may be incorrect. Check your Claude.ai URL.".to_string())
            } else if msg.contains("network") || msg.contains("connect") {
                Some("Please check your internet connection.".to_string())
            } else {
                Some("An unexpected error occurred. Please try again.".to_string())
            };

            Ok(TestConnectionResult {
                success: false,
                error_code: Some("HTTP_ERROR".to_string()),
                error_message: Some(msg),
                hint,
            })
        }
        Err(ProviderError::ParseError(msg)) => Ok(TestConnectionResult {
            success: false,
            error_code: Some("PARSE_ERROR".to_string()),
            error_message: Some("Failed to parse API response".to_string()),
            hint: Some(format!("The API response format was unexpected: {}", msg)),
        }),
    }
}
