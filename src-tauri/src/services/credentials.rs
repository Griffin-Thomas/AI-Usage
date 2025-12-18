use crate::error::AppError;
use crate::models::Credentials;
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

const STORE_FILE: &str = "credentials.json";

pub struct CredentialService;

impl CredentialService {
    /// Get credentials for a provider
    pub fn get(app: &AppHandle, provider: &str) -> Result<Option<Credentials>, AppError> {
        let store = app
            .store(STORE_FILE)
            .map_err(|e| AppError::Store(e.to_string()))?;

        let value = store.get(provider);

        match value {
            Some(v) => {
                let creds: Credentials = serde_json::from_value(v.clone())?;
                Ok(Some(creds))
            }
            None => Ok(None),
        }
    }

    /// Save credentials for a provider
    pub fn save(app: &AppHandle, provider: &str, credentials: &Credentials) -> Result<(), AppError> {
        let store = app
            .store(STORE_FILE)
            .map_err(|e| AppError::Store(e.to_string()))?;

        let value = serde_json::to_value(credentials)?;
        store.set(provider.to_string(), value);
        store.save().map_err(|e| AppError::Store(e.to_string()))?;

        log::info!("Saved credentials for provider: {}", provider);
        Ok(())
    }

    /// Delete credentials for a provider
    pub fn delete(app: &AppHandle, provider: &str) -> Result<(), AppError> {
        let store = app
            .store(STORE_FILE)
            .map_err(|e| AppError::Store(e.to_string()))?;

        store.delete(provider);
        store.save().map_err(|e| AppError::Store(e.to_string()))?;

        log::info!("Deleted credentials for provider: {}", provider);
        Ok(())
    }

    /// Check if credentials exist for a provider
    pub fn exists(app: &AppHandle, provider: &str) -> Result<bool, AppError> {
        let store = app
            .store(STORE_FILE)
            .map_err(|e| AppError::Store(e.to_string()))?;

        Ok(store.has(provider))
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
