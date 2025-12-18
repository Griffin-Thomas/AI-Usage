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
