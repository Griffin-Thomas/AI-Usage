use crate::error::{AppError, ProviderError};
use crate::models::{Credentials, UsageData};
use crate::providers::{ProviderMetadata, ProviderRegistry};
use crate::services::CredentialService;
use tauri::AppHandle;

/// Get metadata for all providers (including blocked/planned ones)
#[tauri::command]
pub fn list_providers() -> Result<Vec<ProviderMetadata>, AppError> {
    let registry = ProviderRegistry::new()?;
    Ok(registry.all_metadata())
}

/// Fetch usage data for a specific provider
#[tauri::command]
pub async fn fetch_usage(app: AppHandle, provider: String) -> Result<UsageData, AppError> {
    log::info!("Fetching usage for provider: {}", provider);

    // Get the provider from registry
    let registry = ProviderRegistry::new()?;
    let provider_impl = registry
        .get(&provider)
        .ok_or_else(|| ProviderError::HttpError(format!("Unknown or unavailable provider: {}", provider)))?;

    // Get credentials
    let credentials = CredentialService::get(&app, &provider)?
        .ok_or_else(|| ProviderError::MissingCredentials(provider.clone()))?;

    // Validate credentials
    if !provider_impl.validate_credentials(&credentials) {
        return Err(ProviderError::InvalidCredentials(
            format!("Invalid credentials for {}", provider),
        )
        .into());
    }

    // Fetch usage
    let usage = provider_impl.fetch_usage(&credentials).await?;
    Ok(usage)
}

/// Validate credentials for a specific provider
#[tauri::command]
pub async fn validate_credentials(
    provider: String,
    credentials: Credentials,
) -> Result<bool, AppError> {
    log::info!("Validating credentials for provider: {}", provider);

    let registry = ProviderRegistry::new()?;

    match registry.get(&provider) {
        Some(provider_impl) => Ok(provider_impl.validate_credentials(&credentials)),
        None => {
            // For blocked providers, just check if credentials are non-empty
            log::warn!("Provider {} is not available, skipping validation", provider);
            Ok(false)
        }
    }
}

/// Test connection result with detailed status
#[derive(serde::Serialize)]
pub struct TestConnectionResult {
    pub success: bool,
    pub error_code: Option<String>,
    pub error_message: Option<String>,
    pub hint: Option<String>,
}

/// Test connection by making an actual API request
#[tauri::command]
pub async fn test_connection(
    provider: String,
    credentials: Credentials,
) -> Result<TestConnectionResult, AppError> {
    log::info!("Testing connection for provider: {}", provider);

    let registry = ProviderRegistry::new()?;

    let provider_impl = match registry.get(&provider) {
        Some(p) => p,
        None => {
            return Ok(TestConnectionResult {
                success: false,
                error_code: Some("PROVIDER_UNAVAILABLE".to_string()),
                error_message: Some(format!("Provider '{}' is not available", provider)),
                hint: Some("This provider is currently blocked or not supported.".to_string()),
            });
        }
    };

    // First validate format
    if !provider_impl.validate_credentials(&credentials) {
        return Ok(TestConnectionResult {
            success: false,
            error_code: Some("INVALID_FORMAT".to_string()),
            error_message: Some("Credentials format is invalid".to_string()),
            hint: Some("Please ensure both Organization ID and Session Key are provided.".to_string()),
        });
    }

    // Try to fetch usage
    match provider_impl.fetch_usage(&credentials).await {
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
            // Parse for common issues
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
