use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Provider error: {0}")]
    Provider(#[from] ProviderError),

    #[error("Store error: {0}")]
    Store(String),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("Tauri error: {0}")]
    Tauri(#[from] tauri::Error),

    #[error("Rate limited: {0}")]
    RateLimit(String),
}

#[derive(Debug, Error)]
pub enum ProviderError {
    #[error("HTTP request failed: {0}")]
    HttpError(String),

    #[error("Session expired - please update your credentials")]
    SessionExpired,

    #[error("Access blocked by Cloudflare - try again later")]
    CloudflareBlocked,

    #[error("Rate limited - please wait before retrying")]
    RateLimited,

    #[error("Invalid response format: {0}")]
    ParseError(String),

    #[error("Missing credentials for provider: {0}")]
    MissingCredentials(String),

    #[error("Invalid credentials: {0}")]
    InvalidCredentials(String),
}

// Make errors serializable for Tauri commands
impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

impl Serialize for ProviderError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn provider_error_messages() {
        assert_eq!(
            ProviderError::SessionExpired.to_string(),
            "Session expired - please update your credentials"
        );
        assert_eq!(
            ProviderError::CloudflareBlocked.to_string(),
            "Access blocked by Cloudflare - try again later"
        );
        assert_eq!(
            ProviderError::RateLimited.to_string(),
            "Rate limited - please wait before retrying"
        );
    }

    #[test]
    fn provider_error_http() {
        let err = ProviderError::HttpError("connection refused".to_string());
        assert_eq!(err.to_string(), "HTTP request failed: connection refused");
    }

    #[test]
    fn provider_error_missing_credentials() {
        let err = ProviderError::MissingCredentials("claude".to_string());
        assert_eq!(err.to_string(), "Missing credentials for provider: claude");
    }

    #[test]
    fn app_error_from_provider_error() {
        let provider_err = ProviderError::SessionExpired;
        let app_err: AppError = provider_err.into();
        assert!(app_err.to_string().contains("Session expired"));
    }

    #[test]
    fn provider_error_serialization() {
        let err = ProviderError::SessionExpired;
        let json = serde_json::to_string(&err).unwrap();
        assert!(json.contains("Session expired"));
    }
}
