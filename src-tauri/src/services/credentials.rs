use crate::error::AppError;
use crate::models::{Account, Credentials};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

const STORE_FILE: &str = "credentials.json";
const ACCOUNTS_KEY: &str = "accounts";
const VERSION_KEY: &str = "version";
const CURRENT_VERSION: u32 = 2;

/// Storage format for credential store (v2)
/// This struct documents the storage schema but is not directly constructed.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[allow(dead_code)]
pub struct CredentialStore {
    pub version: u32,
    pub accounts: HashMap<String, Account>,
}

pub struct CredentialService;

impl CredentialService {
    // =========================================================================
    // Account-based API (v2)
    // =========================================================================

    /// Ensure the store is migrated to the latest version
    pub fn ensure_migrated(app: &AppHandle) -> Result<(), AppError> {
        let store = app
            .store(STORE_FILE)
            .map_err(|e| AppError::Store(e.to_string()))?;

        // Check current version
        let version: u32 = store
            .get(VERSION_KEY)
            .and_then(|v| serde_json::from_value(v.clone()).ok())
            .unwrap_or(1);

        if version < CURRENT_VERSION {
            log::info!("Migrating credentials from v{} to v{}", version, CURRENT_VERSION);
            Self::migrate_v1_to_v2(app)?;
        }

        Ok(())
    }

    /// Migrate from v1 (flat provider credentials) to v2 (account-based)
    fn migrate_v1_to_v2(app: &AppHandle) -> Result<(), AppError> {
        let store = app
            .store(STORE_FILE)
            .map_err(|e| AppError::Store(e.to_string()))?;

        let mut accounts: HashMap<String, Account> = HashMap::new();

        // Check for existing Claude credentials in v1 format
        if let Some(v) = store.get("claude") {
            if let Ok(creds) = serde_json::from_value::<Credentials>(v.clone()) {
                // Only migrate if credentials have values
                if Self::validate_claude(&creds) {
                    let account = Account {
                        id: uuid::Uuid::new_v4().to_string(),
                        name: "Default".to_string(),
                        provider: "claude".to_string(),
                        credentials: creds,
                        created_at: Utc::now(),
                    };
                    log::info!("Migrating Claude credentials to account: {}", account.id);
                    accounts.insert(account.id.clone(), account);
                }
            }
        }

        // Save new format
        store.set(ACCOUNTS_KEY.to_string(), serde_json::to_value(&accounts)?);
        store.set(VERSION_KEY.to_string(), serde_json::to_value(CURRENT_VERSION)?);

        // Clean up old format keys
        store.delete("claude");
        store.delete("codex");
        store.delete("gemini");

        store.save().map_err(|e| AppError::Store(e.to_string()))?;
        log::info!("Migration complete. {} accounts migrated.", accounts.len());

        Ok(())
    }

    /// List all accounts for a provider
    pub fn list_accounts(app: &AppHandle, provider: &str) -> Result<Vec<Account>, AppError> {
        Self::ensure_migrated(app)?;

        let store = app
            .store(STORE_FILE)
            .map_err(|e| AppError::Store(e.to_string()))?;

        let accounts: HashMap<String, Account> = store
            .get(ACCOUNTS_KEY)
            .and_then(|v| serde_json::from_value(v.clone()).ok())
            .unwrap_or_default();

        let filtered: Vec<Account> = accounts
            .into_values()
            .filter(|a| a.provider == provider)
            .collect();

        Ok(filtered)
    }

    /// Get a specific account by ID
    pub fn get_account(app: &AppHandle, account_id: &str) -> Result<Option<Account>, AppError> {
        Self::ensure_migrated(app)?;

        let store = app
            .store(STORE_FILE)
            .map_err(|e| AppError::Store(e.to_string()))?;

        let accounts: HashMap<String, Account> = store
            .get(ACCOUNTS_KEY)
            .and_then(|v| serde_json::from_value(v.clone()).ok())
            .unwrap_or_default();

        Ok(accounts.get(account_id).cloned())
    }

    /// Save (create or update) an account
    pub fn save_account(app: &AppHandle, account: &Account) -> Result<(), AppError> {
        Self::ensure_migrated(app)?;

        let store = app
            .store(STORE_FILE)
            .map_err(|e| AppError::Store(e.to_string()))?;

        let mut accounts: HashMap<String, Account> = store
            .get(ACCOUNTS_KEY)
            .and_then(|v| serde_json::from_value(v.clone()).ok())
            .unwrap_or_default();

        accounts.insert(account.id.clone(), account.clone());

        store.set(ACCOUNTS_KEY.to_string(), serde_json::to_value(&accounts)?);
        store.save().map_err(|e| AppError::Store(e.to_string()))?;

        log::info!("Saved account: {} ({})", account.name, account.id);
        Ok(())
    }

    /// Delete an account by ID
    pub fn delete_account(app: &AppHandle, account_id: &str) -> Result<(), AppError> {
        Self::ensure_migrated(app)?;

        let store = app
            .store(STORE_FILE)
            .map_err(|e| AppError::Store(e.to_string()))?;

        let mut accounts: HashMap<String, Account> = store
            .get(ACCOUNTS_KEY)
            .and_then(|v| serde_json::from_value(v.clone()).ok())
            .unwrap_or_default();

        if accounts.remove(account_id).is_some() {
            store.set(ACCOUNTS_KEY.to_string(), serde_json::to_value(&accounts)?);
            store.save().map_err(|e| AppError::Store(e.to_string()))?;
            log::info!("Deleted account: {}", account_id);
        }

        Ok(())
    }

    /// Check if any accounts exist for a provider
    pub fn has_accounts(app: &AppHandle, provider: &str) -> Result<bool, AppError> {
        let accounts = Self::list_accounts(app, provider)?;
        Ok(!accounts.is_empty())
    }

    // =========================================================================
    // Legacy API (for backward compatibility during transition)
    // =========================================================================

    /// Get credentials for a provider (legacy - returns first account's credentials)
    pub fn get(app: &AppHandle, provider: &str) -> Result<Option<Credentials>, AppError> {
        let accounts = Self::list_accounts(app, provider)?;
        Ok(accounts.into_iter().next().map(|a| a.credentials))
    }

    /// Save credentials for a provider (legacy - creates/updates default account)
    pub fn save(app: &AppHandle, provider: &str, credentials: &Credentials) -> Result<(), AppError> {
        Self::ensure_migrated(app)?;

        // Check if there's already an account for this provider
        let accounts = Self::list_accounts(app, provider)?;

        let account = if let Some(existing) = accounts.into_iter().next() {
            // Update existing account's credentials
            Account {
                credentials: credentials.clone(),
                ..existing
            }
        } else {
            // Create new account
            Account::new("Default".to_string(), provider.to_string(), credentials.clone())
        };

        Self::save_account(app, &account)
    }

    /// Delete credentials for a provider (legacy - deletes all accounts)
    pub fn delete(app: &AppHandle, provider: &str) -> Result<(), AppError> {
        let accounts = Self::list_accounts(app, provider)?;
        for account in accounts {
            Self::delete_account(app, &account.id)?;
        }
        Ok(())
    }

    /// Check if credentials exist for a provider (legacy)
    pub fn exists(app: &AppHandle, provider: &str) -> Result<bool, AppError> {
        Self::has_accounts(app, provider)
    }

    /// Validate Claude credentials format
    pub fn validate_claude(credentials: &Credentials) -> bool {
        // Claude requires org_id and session_key
        let has_org_id = credentials
            .org_id
            .as_ref()
            .map(|s| !s.trim().is_empty())
            .unwrap_or(false);

        let has_session_key = credentials
            .session_key
            .as_ref()
            .map(|s| !s.trim().is_empty())
            .unwrap_or(false);

        has_org_id && has_session_key
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_claude_with_valid_credentials() {
        let creds = Credentials {
            org_id: Some("org-123".to_string()),
            session_key: Some("sk-ant-xxx".to_string()),
            api_key: None,
        };
        assert!(CredentialService::validate_claude(&creds));
    }

    #[test]
    fn validate_claude_missing_org_id() {
        let creds = Credentials {
            org_id: None,
            session_key: Some("sk-ant-xxx".to_string()),
            api_key: None,
        };
        assert!(!CredentialService::validate_claude(&creds));
    }

    #[test]
    fn validate_claude_missing_session_key() {
        let creds = Credentials {
            org_id: Some("org-123".to_string()),
            session_key: None,
            api_key: None,
        };
        assert!(!CredentialService::validate_claude(&creds));
    }

    #[test]
    fn validate_claude_empty_org_id() {
        let creds = Credentials {
            org_id: Some("".to_string()),
            session_key: Some("sk-ant-xxx".to_string()),
            api_key: None,
        };
        assert!(!CredentialService::validate_claude(&creds));
    }

    #[test]
    fn validate_claude_whitespace_only() {
        let creds = Credentials {
            org_id: Some("   ".to_string()),
            session_key: Some("sk-ant-xxx".to_string()),
            api_key: None,
        };
        assert!(!CredentialService::validate_claude(&creds));
    }

    #[test]
    fn validate_claude_both_missing() {
        let creds = Credentials::default();
        assert!(!CredentialService::validate_claude(&creds));
    }
}
