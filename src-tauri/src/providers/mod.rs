mod claude;

pub use claude::ClaudeProvider;

use crate::error::ProviderError;
use crate::models::{Credentials, UsageData};
use async_trait::async_trait;

/// Trait for usage data providers (id/name used in Phase 4 multi-provider support)
#[async_trait]
#[allow(dead_code)]
pub trait UsageProvider: Send + Sync {
    /// Provider identifier
    fn id(&self) -> &'static str;

    /// Human-readable provider name
    fn name(&self) -> &'static str;

    /// Fetch current usage data
    async fn fetch_usage(&self, credentials: &Credentials) -> Result<UsageData, ProviderError>;

    /// Validate that credentials have required fields
    fn validate_credentials(&self, credentials: &Credentials) -> bool;
}
