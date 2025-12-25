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
