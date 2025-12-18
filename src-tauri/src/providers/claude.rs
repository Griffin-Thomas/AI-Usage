use async_trait::async_trait;
use chrono::{DateTime, Utc};
use reqwest::header::{HeaderMap, HeaderValue, COOKIE, ORIGIN, REFERER, USER_AGENT};

use crate::error::ProviderError;
use crate::models::{ClaudeUsageResponse, Credentials, UsageData, UsageLimit};
use crate::providers::UsageProvider;

const CLAUDE_API_BASE: &str = "https://claude.ai/api";

pub struct ClaudeProvider {
    client: reqwest::Client,
}

impl ClaudeProvider {
    pub fn new() -> Result<Self, ProviderError> {
        let client = reqwest::Client::builder()
            .build()
            .map_err(|e| ProviderError::HttpError(e.to_string()))?;

        Ok(Self { client })
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
            limits.push(self.parse_limit("five_hour", "5-Hour Limit", limit, None)?);
        }

        // Weekly limit (optional)
        if let Some(ref limit) = response.seven_day {
            limits.push(self.parse_limit("seven_day", "Weekly Limit", limit, None)?);
        }

        // Opus limit (optional)
        if let Some(ref limit) = response.seven_day_opus {
            limits.push(self.parse_limit(
                "seven_day_opus",
                "Weekly Opus",
                limit,
                Some("opus"),
            )?);
        }

        // Sonnet limit (optional)
        if let Some(ref limit) = response.seven_day_sonnet {
            limits.push(self.parse_limit(
                "seven_day_sonnet",
                "Weekly Sonnet",
                limit,
                Some("sonnet"),
            )?);
        }

        // OAuth apps limit (optional)
        if let Some(ref limit) = response.seven_day_oauth_apps {
            limits.push(self.parse_limit(
                "seven_day_oauth_apps",
                "Weekly OAuth Apps",
                limit,
                Some("oauth"),
            )?);
        }

        Ok(UsageData {
            provider: "claude".to_string(),
            timestamp: Utc::now(),
            limits,
            raw: Some(serde_json::to_value(&response).unwrap_or_default()),
        })
    }

    fn parse_limit(
        &self,
        id: &str,
        label: &str,
        usage: &crate::models::LimitUsage,
        category: Option<&str>,
    ) -> Result<UsageLimit, ProviderError> {
        let resets_at = DateTime::parse_from_rfc3339(&usage.resets_at)
            .map(|dt| dt.with_timezone(&Utc))
            .map_err(|e| ProviderError::ParseError(format!("Invalid date format: {}", e)))?;

        Ok(UsageLimit {
            id: id.to_string(),
            label: label.to_string(),
            utilization: usage.utilization,
            resets_at,
            category: category.map(String::from),
        })
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

        let url = format!("{}/organizations/{}/usage", CLAUDE_API_BASE, org_id);
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
