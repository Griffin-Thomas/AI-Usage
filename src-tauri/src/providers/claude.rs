use async_trait::async_trait;
use chrono::{DateTime, Utc};
use reqwest::header::{HeaderMap, HeaderValue, COOKIE, ORIGIN, REFERER, USER_AGENT};

use crate::error::ProviderError;
use crate::models::{ClaudeUsageResponse, Credentials, UsageData, UsageLimit};
use crate::providers::UsageProvider;

const CLAUDE_API_BASE: &str = "https://claude.ai/api";

pub struct ClaudeProvider {
    client: reqwest::Client,
    base_url: String,
}

impl ClaudeProvider {
    pub fn new() -> Result<Self, ProviderError> {
        Self::with_base_url(CLAUDE_API_BASE)
    }

    /// Create a provider with a custom base URL (for testing)
    pub fn with_base_url(base_url: &str) -> Result<Self, ProviderError> {
        let client = reqwest::Client::builder()
            .build()
            .map_err(|e| ProviderError::HttpError(e.to_string()))?;

        Ok(Self {
            client,
            base_url: base_url.to_string(),
        })
    }

    /// Build browser-like headers for Cloudflare bypass
    fn build_headers(&self, session_key: &str) -> HeaderMap {
        let mut headers = HeaderMap::new();

        // Session cookie
        headers.insert(
            COOKIE,
            HeaderValue::from_str(&format!("sessionKey={}", session_key)).unwrap(),
        );

        // Required headers for Cloudflare bypass
        headers.insert(
            USER_AGENT,
            HeaderValue::from_static(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            ),
        );
        headers.insert(ORIGIN, HeaderValue::from_static("https://claude.ai"));
        headers.insert(REFERER, HeaderValue::from_static("https://claude.ai/"));

        // Anthropic-specific header
        headers.insert(
            "anthropic-client-platform",
            HeaderValue::from_static("web_claude_ai"),
        );

        // Sec-Fetch headers (mimic browser behavior)
        headers.insert("sec-fetch-dest", HeaderValue::from_static("empty"));
        headers.insert("sec-fetch-mode", HeaderValue::from_static("cors"));
        headers.insert("sec-fetch-site", HeaderValue::from_static("same-origin"));
        headers.insert("sec-ch-ua-platform", HeaderValue::from_static("\"macOS\""));
        headers.insert(
            "sec-ch-ua",
            HeaderValue::from_static(
                "\"Google Chrome\";v=\"131\", \"Chromium\";v=\"131\", \"Not_A Brand\";v=\"24\"",
            ),
        );
        headers.insert("sec-ch-ua-mobile", HeaderValue::from_static("?0"));

        // Accept headers
        headers.insert(
            "accept",
            HeaderValue::from_static("application/json, text/plain, */*"),
        );
        headers.insert(
            "accept-language",
            HeaderValue::from_static("en-US,en;q=0.9"),
        );

        headers
    }

    /// Parse API response into UsageData
    fn parse_response(&self, response: ClaudeUsageResponse) -> Result<UsageData, ProviderError> {
        let mut limits = Vec::new();

        // 5-hour limit (may be absent when no usage)
        if let Some(ref limit) = response.five_hour {
            if let Some(parsed) = self.parse_limit("five_hour", "5-Hour Limit", limit, None)? {
                limits.push(parsed);
            }
        }

        // Weekly limit (optional)
        if let Some(ref limit) = response.seven_day {
            if let Some(parsed) = self.parse_limit("seven_day", "Weekly Limit", limit, None)? {
                limits.push(parsed);
            }
        }

        // Opus limit (optional)
        if let Some(ref limit) = response.seven_day_opus {
            if let Some(parsed) = self.parse_limit(
                "seven_day_opus",
                "Weekly Opus",
                limit,
                Some("opus"),
            )? {
                limits.push(parsed);
            }
        }

        // Sonnet limit (optional)
        if let Some(ref limit) = response.seven_day_sonnet {
            if let Some(parsed) = self.parse_limit(
                "seven_day_sonnet",
                "Weekly Sonnet",
                limit,
                Some("sonnet"),
            )? {
                limits.push(parsed);
            }
        }

        // OAuth apps limit (optional)
        if let Some(ref limit) = response.seven_day_oauth_apps {
            if let Some(parsed) = self.parse_limit(
                "seven_day_oauth_apps",
                "Weekly OAuth Apps",
                limit,
                Some("oauth"),
            )? {
                limits.push(parsed);
            }
        }

        Ok(UsageData {
            provider: "claude".to_string(),
            timestamp: Utc::now(),
            limits,
            raw: Some(serde_json::to_value(&response).unwrap_or_default()),
        })
    }

    /// Parse a limit, returning None if resets_at is missing (0% usage)
    fn parse_limit(
        &self,
        id: &str,
        label: &str,
        usage: &crate::models::LimitUsage,
        category: Option<&str>,
    ) -> Result<Option<UsageLimit>, ProviderError> {
        // When utilization is 0%, resets_at is null - skip this limit
        let resets_at_str = match &usage.resets_at {
            Some(s) => s,
            None => return Ok(None),
        };

        let resets_at = DateTime::parse_from_rfc3339(resets_at_str)
            .map(|dt| dt.with_timezone(&Utc))
            .map_err(|e| ProviderError::ParseError(format!("Invalid date format: {}", e)))?;

        Ok(Some(UsageLimit {
            id: id.to_string(),
            label: label.to_string(),
            utilization: usage.utilization,
            resets_at,
            category: category.map(String::from),
        }))
    }
}

impl Default for ClaudeProvider {
    fn default() -> Self {
        Self::new().expect("Failed to create Claude provider")
    }
}

#[async_trait]
impl UsageProvider for ClaudeProvider {
    fn id(&self) -> &'static str {
        "claude"
    }

    fn name(&self) -> &'static str {
        "Claude"
    }

    async fn fetch_usage(&self, credentials: &Credentials) -> Result<UsageData, ProviderError> {
        let org_id = credentials
            .org_id
            .as_ref()
            .ok_or_else(|| ProviderError::MissingCredentials("org_id".to_string()))?;

        let session_key = credentials
            .session_key
            .as_ref()
            .ok_or_else(|| ProviderError::MissingCredentials("session_key".to_string()))?;

        let url = format!("{}/organizations/{}/usage", self.base_url, org_id);
        let headers = self.build_headers(session_key);

        log::info!("Fetching Claude usage from: {}", url);

        let response = self
            .client
            .get(&url)
            .headers(headers)
            .send()
            .await
            .map_err(|e| ProviderError::HttpError(e.to_string()))?;

        let status = response.status();
        log::info!("Claude API response status: {}", status);

        match status.as_u16() {
            200 => {
                let text = response
                    .text()
                    .await
                    .map_err(|e| ProviderError::HttpError(e.to_string()))?;

                log::info!("Claude API raw response: {}", &text[..text.len().min(1000)]);

                let body: ClaudeUsageResponse = serde_json::from_str(&text)
                    .map_err(|e| {
                        log::error!("Failed to parse Claude response: {}. Body: {}", e, text);
                        ProviderError::ParseError(format!("{} - Response: {}", e, &text[..text.len().min(500)]))
                    })?;

                self.parse_response(body)
            }
            401 => Err(ProviderError::SessionExpired),
            403 => Err(ProviderError::CloudflareBlocked),
            429 => Err(ProviderError::RateLimited),
            _ => {
                let body = response.text().await.unwrap_or_default();
                Err(ProviderError::HttpError(format!(
                    "Unexpected status {}: {}",
                    status, body
                )))
            }
        }
    }

    fn validate_credentials(&self, credentials: &Credentials) -> bool {
        credentials.org_id.as_ref().map(|s| !s.is_empty()).unwrap_or(false)
            && credentials
                .session_key
                .as_ref()
                .map(|s| !s.is_empty())
                .unwrap_or(false)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use wiremock::matchers::{header, method, path};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    fn make_credentials() -> Credentials {
        Credentials {
            org_id: Some("test-org-123".to_string()),
            session_key: Some("sk-test-session-key".to_string()),
            api_key: None,
        }
    }

    fn make_usage_response() -> serde_json::Value {
        serde_json::json!({
            "five_hour": {
                "utilization": 0.45,
                "resets_at": "2025-01-15T17:00:00Z"
            },
            "seven_day": {
                "utilization": 0.25,
                "resets_at": "2025-01-20T00:00:00Z"
            },
            "seven_day_opus": null,
            "seven_day_sonnet": null,
            "seven_day_oauth_apps": null,
            "iguana_necktie": null,
            "extra_usage": null
        })
    }

    // ============================================================================
    // Integration tests with mocked HTTP
    // ============================================================================

    #[tokio::test]
    async fn test_fetch_usage_success() {
        let mock_server = MockServer::start().await;

        Mock::given(method("GET"))
            .and(path("/organizations/test-org-123/usage"))
            .and(header("cookie", "sessionKey=sk-test-session-key"))
            .respond_with(ResponseTemplate::new(200).set_body_json(make_usage_response()))
            .expect(1)
            .mount(&mock_server)
            .await;

        let provider = ClaudeProvider::with_base_url(&mock_server.uri()).unwrap();
        let credentials = make_credentials();

        let result = provider.fetch_usage(&credentials).await;

        assert!(result.is_ok());
        let usage = result.unwrap();
        assert_eq!(usage.provider, "claude");
        assert_eq!(usage.limits.len(), 2);

        let five_hour = usage.limits.iter().find(|l| l.id == "five_hour").unwrap();
        assert!((five_hour.utilization - 0.45).abs() < 0.001);

        let seven_day = usage.limits.iter().find(|l| l.id == "seven_day").unwrap();
        assert!((seven_day.utilization - 0.25).abs() < 0.001);
    }

    #[tokio::test]
    async fn test_fetch_usage_401_session_expired() {
        let mock_server = MockServer::start().await;

        Mock::given(method("GET"))
            .and(path("/organizations/test-org-123/usage"))
            .respond_with(ResponseTemplate::new(401))
            .expect(1)
            .mount(&mock_server)
            .await;

        let provider = ClaudeProvider::with_base_url(&mock_server.uri()).unwrap();
        let credentials = make_credentials();

        let result = provider.fetch_usage(&credentials).await;

        assert!(result.is_err());
        match result.unwrap_err() {
            ProviderError::SessionExpired => {}
            err => panic!("Expected SessionExpired, got {:?}", err),
        }
    }

    #[tokio::test]
    async fn test_fetch_usage_403_cloudflare_blocked() {
        let mock_server = MockServer::start().await;

        Mock::given(method("GET"))
            .and(path("/organizations/test-org-123/usage"))
            .respond_with(ResponseTemplate::new(403))
            .expect(1)
            .mount(&mock_server)
            .await;

        let provider = ClaudeProvider::with_base_url(&mock_server.uri()).unwrap();
        let credentials = make_credentials();

        let result = provider.fetch_usage(&credentials).await;

        assert!(result.is_err());
        match result.unwrap_err() {
            ProviderError::CloudflareBlocked => {}
            err => panic!("Expected CloudflareBlocked, got {:?}", err),
        }
    }

    #[tokio::test]
    async fn test_fetch_usage_429_rate_limited() {
        let mock_server = MockServer::start().await;

        Mock::given(method("GET"))
            .and(path("/organizations/test-org-123/usage"))
            .respond_with(ResponseTemplate::new(429))
            .expect(1)
            .mount(&mock_server)
            .await;

        let provider = ClaudeProvider::with_base_url(&mock_server.uri()).unwrap();
        let credentials = make_credentials();

        let result = provider.fetch_usage(&credentials).await;

        assert!(result.is_err());
        match result.unwrap_err() {
            ProviderError::RateLimited => {}
            err => panic!("Expected RateLimited, got {:?}", err),
        }
    }

    #[tokio::test]
    async fn test_fetch_usage_500_server_error() {
        let mock_server = MockServer::start().await;

        Mock::given(method("GET"))
            .and(path("/organizations/test-org-123/usage"))
            .respond_with(ResponseTemplate::new(500).set_body_string("Internal Server Error"))
            .expect(1)
            .mount(&mock_server)
            .await;

        let provider = ClaudeProvider::with_base_url(&mock_server.uri()).unwrap();
        let credentials = make_credentials();

        let result = provider.fetch_usage(&credentials).await;

        assert!(result.is_err());
        match result.unwrap_err() {
            ProviderError::HttpError(msg) => {
                assert!(msg.contains("500"));
            }
            err => panic!("Expected HttpError, got {:?}", err),
        }
    }

    #[tokio::test]
    async fn test_fetch_usage_invalid_json() {
        let mock_server = MockServer::start().await;

        Mock::given(method("GET"))
            .and(path("/organizations/test-org-123/usage"))
            .respond_with(ResponseTemplate::new(200).set_body_string("not valid json"))
            .expect(1)
            .mount(&mock_server)
            .await;

        let provider = ClaudeProvider::with_base_url(&mock_server.uri()).unwrap();
        let credentials = make_credentials();

        let result = provider.fetch_usage(&credentials).await;

        assert!(result.is_err());
        match result.unwrap_err() {
            ProviderError::ParseError(msg) => {
                assert!(msg.contains("not valid json"));
            }
            err => panic!("Expected ParseError, got {:?}", err),
        }
    }

    #[tokio::test]
    async fn test_fetch_usage_missing_org_id() {
        let provider = ClaudeProvider::new().unwrap();
        let credentials = Credentials {
            org_id: None,
            session_key: Some("sk-test".to_string()),
            api_key: None,
        };

        let result = provider.fetch_usage(&credentials).await;

        assert!(result.is_err());
        match result.unwrap_err() {
            ProviderError::MissingCredentials(field) => {
                assert_eq!(field, "org_id");
            }
            err => panic!("Expected MissingCredentials, got {:?}", err),
        }
    }

    #[tokio::test]
    async fn test_fetch_usage_missing_session_key() {
        let provider = ClaudeProvider::new().unwrap();
        let credentials = Credentials {
            org_id: Some("org-123".to_string()),
            session_key: None,
            api_key: None,
        };

        let result = provider.fetch_usage(&credentials).await;

        assert!(result.is_err());
        match result.unwrap_err() {
            ProviderError::MissingCredentials(field) => {
                assert_eq!(field, "session_key");
            }
            err => panic!("Expected MissingCredentials, got {:?}", err),
        }
    }

    #[tokio::test]
    async fn test_fetch_usage_zero_utilization() {
        // When utilization is 0%, resets_at is null and the limit should be skipped
        let mock_server = MockServer::start().await;

        let response = serde_json::json!({
            "five_hour": {
                "utilization": 0.0,
                "resets_at": null
            },
            "seven_day": {
                "utilization": 0.25,
                "resets_at": "2025-01-20T00:00:00Z"
            },
            "seven_day_opus": null,
            "seven_day_sonnet": null,
            "seven_day_oauth_apps": null,
            "iguana_necktie": null,
            "extra_usage": null
        });

        Mock::given(method("GET"))
            .and(path("/organizations/test-org-123/usage"))
            .respond_with(ResponseTemplate::new(200).set_body_json(response))
            .expect(1)
            .mount(&mock_server)
            .await;

        let provider = ClaudeProvider::with_base_url(&mock_server.uri()).unwrap();
        let credentials = make_credentials();

        let result = provider.fetch_usage(&credentials).await;

        assert!(result.is_ok());
        let usage = result.unwrap();
        // five_hour should be skipped since resets_at is null
        assert_eq!(usage.limits.len(), 1);
        assert_eq!(usage.limits[0].id, "seven_day");
    }

    #[tokio::test]
    async fn test_fetch_usage_all_limit_types() {
        let mock_server = MockServer::start().await;

        let response = serde_json::json!({
            "five_hour": {
                "utilization": 0.5,
                "resets_at": "2025-01-15T17:00:00Z"
            },
            "seven_day": {
                "utilization": 0.3,
                "resets_at": "2025-01-20T00:00:00Z"
            },
            "seven_day_opus": {
                "utilization": 0.8,
                "resets_at": "2025-01-20T00:00:00Z"
            },
            "seven_day_sonnet": {
                "utilization": 0.2,
                "resets_at": "2025-01-20T00:00:00Z"
            },
            "seven_day_oauth_apps": {
                "utilization": 0.1,
                "resets_at": "2025-01-20T00:00:00Z"
            },
            "iguana_necktie": null,
            "extra_usage": null
        });

        Mock::given(method("GET"))
            .and(path("/organizations/test-org-123/usage"))
            .respond_with(ResponseTemplate::new(200).set_body_json(response))
            .expect(1)
            .mount(&mock_server)
            .await;

        let provider = ClaudeProvider::with_base_url(&mock_server.uri()).unwrap();
        let credentials = make_credentials();

        let result = provider.fetch_usage(&credentials).await;

        assert!(result.is_ok());
        let usage = result.unwrap();
        assert_eq!(usage.limits.len(), 5);

        // Check categories are set correctly
        let opus = usage.limits.iter().find(|l| l.id == "seven_day_opus").unwrap();
        assert_eq!(opus.category, Some("opus".to_string()));

        let sonnet = usage.limits.iter().find(|l| l.id == "seven_day_sonnet").unwrap();
        assert_eq!(sonnet.category, Some("sonnet".to_string()));

        let oauth = usage.limits.iter().find(|l| l.id == "seven_day_oauth_apps").unwrap();
        assert_eq!(oauth.category, Some("oauth".to_string()));
    }

    #[tokio::test]
    async fn test_headers_are_browser_like() {
        let mock_server = MockServer::start().await;

        // Verify key browser-like headers are sent (using header_exists for flexibility)
        Mock::given(method("GET"))
            .and(path("/organizations/test-org-123/usage"))
            .and(header("origin", "https://claude.ai"))
            .and(header("referer", "https://claude.ai/"))
            .respond_with(ResponseTemplate::new(200).set_body_json(make_usage_response()))
            .expect(1)
            .mount(&mock_server)
            .await;

        let provider = ClaudeProvider::with_base_url(&mock_server.uri()).unwrap();
        let credentials = make_credentials();

        let result = provider.fetch_usage(&credentials).await;
        assert!(result.is_ok());
    }

    // ============================================================================
    // Unit tests for validate_credentials
    // ============================================================================

    #[test]
    fn test_validate_credentials_valid() {
        let provider = ClaudeProvider::new().unwrap();
        let credentials = make_credentials();
        assert!(provider.validate_credentials(&credentials));
    }

    #[test]
    fn test_validate_credentials_missing_org_id() {
        let provider = ClaudeProvider::new().unwrap();
        let credentials = Credentials {
            org_id: None,
            session_key: Some("sk-test".to_string()),
            api_key: None,
        };
        assert!(!provider.validate_credentials(&credentials));
    }

    #[test]
    fn test_validate_credentials_missing_session_key() {
        let provider = ClaudeProvider::new().unwrap();
        let credentials = Credentials {
            org_id: Some("org-123".to_string()),
            session_key: None,
            api_key: None,
        };
        assert!(!provider.validate_credentials(&credentials));
    }

    #[test]
    fn test_validate_credentials_empty_strings() {
        let provider = ClaudeProvider::new().unwrap();
        let credentials = Credentials {
            org_id: Some("".to_string()),
            session_key: Some("".to_string()),
            api_key: None,
        };
        assert!(!provider.validate_credentials(&credentials));
    }

    #[test]
    fn test_provider_id_and_name() {
        let provider = ClaudeProvider::new().unwrap();
        assert_eq!(provider.id(), "claude");
        assert_eq!(provider.name(), "Claude");
    }

    #[test]
    fn test_default_provider() {
        let provider = ClaudeProvider::default();
        assert_eq!(provider.id(), "claude");
    }
}
