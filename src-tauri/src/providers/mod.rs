mod claude;

pub use claude::ClaudeProvider;

use crate::error::ProviderError;
use crate::models::{Credentials, UsageData};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;

/// Trait for usage data providers
#[async_trait]
pub trait UsageProvider: Send + Sync {
    /// Provider identifier (e.g., "claude", "chatgpt", "gemini")
    fn id(&self) -> &'static str;

    /// Human-readable provider name (e.g., "Claude", "ChatGPT", "Gemini")
    fn name(&self) -> &'static str;

    /// Fetch current usage data
    async fn fetch_usage(&self, credentials: &Credentials) -> Result<UsageData, ProviderError>;

    /// Validate that credentials have required fields
    fn validate_credentials(&self, credentials: &Credentials) -> bool;

    /// Get metadata about this provider
    fn metadata(&self) -> ProviderMetadata {
        ProviderMetadata {
            id: self.id().to_string(),
            name: self.name().to_string(),
            status: ProviderStatus::Available,
            required_credentials: vec![],
            description: None,
        }
    }
}

/// Provider availability status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ProviderStatus {
    /// Provider is fully functional
    Available,
    /// Provider is implemented but blocked (e.g., no usage API)
    Blocked,
    /// Provider is planned but not yet implemented
    Planned,
}

/// Metadata about a provider for the UI
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderMetadata {
    pub id: String,
    pub name: String,
    pub status: ProviderStatus,
    pub required_credentials: Vec<CredentialField>,
    pub description: Option<String>,
}

/// Describes a credential field for the UI
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CredentialField {
    pub key: String,
    pub label: String,
    pub placeholder: String,
    pub is_secret: bool,
}

/// Registry of all available providers
pub struct ProviderRegistry {
    providers: HashMap<String, Arc<dyn UsageProvider>>,
    /// Metadata for blocked/planned providers (no implementation yet)
    blocked_providers: Vec<ProviderMetadata>,
}

impl ProviderRegistry {
    /// Create a new registry with all available providers
    pub fn new() -> Result<Self, ProviderError> {
        let mut providers: HashMap<String, Arc<dyn UsageProvider>> = HashMap::new();

        // Register Claude provider
        let claude = ClaudeProvider::new()?;
        providers.insert(claude.id().to_string(), Arc::new(claude));

        // Define blocked/planned providers for UI display
        let blocked_providers = vec![
            ProviderMetadata {
                id: "chatgpt".to_string(),
                name: "ChatGPT".to_string(),
                status: ProviderStatus::Blocked,
                required_credentials: vec![
                    CredentialField {
                        key: "session_token".to_string(),
                        label: "Session Token".to_string(),
                        placeholder: "__Secure-next-auth.session-token cookie".to_string(),
                        is_secret: true,
                    },
                ],
                description: Some(
                    "Blocked: OpenAI does not expose a usage tracking API. \
                     Only message cap limits are available, not current usage."
                        .to_string(),
                ),
            },
            ProviderMetadata {
                id: "gemini".to_string(),
                name: "Gemini".to_string(),
                status: ProviderStatus::Blocked,
                required_credentials: vec![
                    CredentialField {
                        key: "project_id".to_string(),
                        label: "GCP Project ID".to_string(),
                        placeholder: "my-gcp-project".to_string(),
                        is_secret: false,
                    },
                ],
                description: Some(
                    "Blocked: Requires complex Google Cloud Monitoring API setup. \
                     See docs/api-integration.md for details."
                        .to_string(),
                ),
            },
        ];

        Ok(Self {
            providers,
            blocked_providers,
        })
    }

    /// Get a provider by ID
    pub fn get(&self, id: &str) -> Option<Arc<dyn UsageProvider>> {
        self.providers.get(id).cloned()
    }

    /// Get all available (functional) provider IDs
    #[allow(dead_code)]
    pub fn available_ids(&self) -> Vec<&str> {
        self.providers.keys().map(|s| s.as_str()).collect()
    }

    /// Get metadata for all providers (including blocked ones)
    pub fn all_metadata(&self) -> Vec<ProviderMetadata> {
        let mut metadata: Vec<ProviderMetadata> = self
            .providers
            .values()
            .map(|p| {
                let mut meta = p.metadata();
                // Add required credentials for Claude
                if meta.id == "claude" {
                    meta.required_credentials = vec![
                        CredentialField {
                            key: "org_id".to_string(),
                            label: "Organization ID".to_string(),
                            placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx".to_string(),
                            is_secret: false,
                        },
                        CredentialField {
                            key: "session_key".to_string(),
                            label: "Session Key".to_string(),
                            placeholder: "sk-ant-sid01-...".to_string(),
                            is_secret: true,
                        },
                    ];
                    meta.description = Some(
                        "Monitor your Claude Pro/Max usage limits. \
                         Get credentials from claude.ai DevTools."
                            .to_string(),
                    );
                }
                meta
            })
            .collect();

        // Add blocked providers
        metadata.extend(self.blocked_providers.clone());

        // Sort: available first, then blocked, then planned
        metadata.sort_by(|a, b| {
            let order = |s: &ProviderStatus| match s {
                ProviderStatus::Available => 0,
                ProviderStatus::Blocked => 1,
                ProviderStatus::Planned => 2,
            };
            order(&a.status).cmp(&order(&b.status))
        });

        metadata
    }
}

impl Default for ProviderRegistry {
    fn default() -> Self {
        Self::new().expect("Failed to create provider registry")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_registry_creation() {
        let registry = ProviderRegistry::new().unwrap();
        assert!(registry.get("claude").is_some());
        assert!(registry.get("unknown").is_none());
    }

    #[test]
    fn test_available_ids() {
        let registry = ProviderRegistry::new().unwrap();
        let ids = registry.available_ids();
        assert!(ids.contains(&"claude"));
    }

    #[test]
    fn test_all_metadata() {
        let registry = ProviderRegistry::new().unwrap();
        let metadata = registry.all_metadata();

        // Should have Claude (available), ChatGPT (blocked), Gemini (blocked)
        assert!(metadata.len() >= 3);

        // Claude should be first (available)
        assert_eq!(metadata[0].id, "claude");
        assert_eq!(metadata[0].status, ProviderStatus::Available);

        // ChatGPT and Gemini should be blocked
        let chatgpt = metadata.iter().find(|m| m.id == "chatgpt").unwrap();
        assert_eq!(chatgpt.status, ProviderStatus::Blocked);

        let gemini = metadata.iter().find(|m| m.id == "gemini").unwrap();
        assert_eq!(gemini.status, ProviderStatus::Blocked);
    }
}
