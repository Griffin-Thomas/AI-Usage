//! HTTP client for communicating with the AI Pulse API server

use reqwest::blocking::Client;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};
use serde::de::DeserializeOwned;
use std::time::Duration;

/// API client for the AI Pulse local server
pub struct ApiClient {
    client: Client,
    base_url: String,
    token: Option<String>,
}

/// Error type for API operations
#[derive(Debug)]
pub enum ApiError {
    /// Could not connect to the API server
    ConnectionFailed(String),
    /// Server returned an error response
    ServerError(u16, String),
    /// Failed to parse response
    ParseError(String),
    /// Authentication failed
    Unauthorized,
}

impl std::fmt::Display for ApiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ApiError::ConnectionFailed(msg) => {
                write!(f, "Could not connect to AI Pulse\n\n{}\n\nTo fix this:\n1. Make sure AI Pulse is running\n2. Go to Settings > Developer and enable \"Local API Server\"\n3. Check that the port matches your CLI config", msg)
            }
            ApiError::ServerError(code, msg) => {
                write!(f, "Server error ({}): {}", code, msg)
            }
            ApiError::ParseError(msg) => {
                write!(f, "Failed to parse response: {}", msg)
            }
            ApiError::Unauthorized => {
                write!(f, "Authentication failed\n\nYour CLI token doesn't match the one configured in AI Pulse.\nCheck Settings > Developer in the app to get the correct token.")
            }
        }
    }
}

impl std::error::Error for ApiError {}

impl ApiClient {
    /// Create a new API client
    pub fn new(port: u16, token: Option<String>) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            client,
            base_url: format!("http://127.0.0.1:{}", port),
            token,
        }
    }

    /// Build headers for requests
    fn headers(&self) -> HeaderMap {
        let mut headers = HeaderMap::new();
        if let Some(ref token) = self.token {
            if !token.is_empty() {
                headers.insert(
                    AUTHORIZATION,
                    HeaderValue::from_str(&format!("Bearer {}", token))
                        .unwrap_or_else(|_| HeaderValue::from_static("")),
                );
            }
        }
        headers
    }

    /// Make a GET request
    pub fn get<T: DeserializeOwned>(&self, path: &str) -> Result<T, ApiError> {
        let url = format!("{}{}", self.base_url, path);

        let response = self
            .client
            .get(&url)
            .headers(self.headers())
            .send()
            .map_err(|e| ApiError::ConnectionFailed(e.to_string()))?;

        let status = response.status();

        if status == reqwest::StatusCode::UNAUTHORIZED {
            return Err(ApiError::Unauthorized);
        }

        if !status.is_success() {
            let body = response.text().unwrap_or_default();
            return Err(ApiError::ServerError(status.as_u16(), body));
        }

        response
            .json()
            .map_err(|e| ApiError::ParseError(e.to_string()))
    }

    /// Make a POST request
    pub fn post<T: DeserializeOwned>(&self, path: &str) -> Result<T, ApiError> {
        let url = format!("{}{}", self.base_url, path);

        let response = self
            .client
            .post(&url)
            .headers(self.headers())
            .send()
            .map_err(|e| ApiError::ConnectionFailed(e.to_string()))?;

        let status = response.status();

        if status == reqwest::StatusCode::UNAUTHORIZED {
            return Err(ApiError::Unauthorized);
        }

        if !status.is_success() {
            let body = response.text().unwrap_or_default();
            return Err(ApiError::ServerError(status.as_u16(), body));
        }

        response
            .json()
            .map_err(|e| ApiError::ParseError(e.to_string()))
    }

    /// Check if the server is healthy
    #[allow(dead_code)]
    pub fn health(&self) -> Result<HealthResponse, ApiError> {
        self.get("/health")
    }
}

/// Health check response
#[derive(Debug, serde::Deserialize)]
pub struct HealthResponse {
    pub status: String,
    pub version: String,
}

/// Status response
#[derive(Debug, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusResponse {
    pub timestamp: String,
    pub accounts: Vec<AccountStatus>,
}

/// Account status
#[derive(Debug, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AccountStatus {
    pub id: String,
    pub name: String,
    pub provider: String,
    pub limits: Vec<UsageLimit>,
    pub last_updated: String,
    pub session_valid: bool,
}

/// Usage limit
#[derive(Debug, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageLimit {
    pub id: String,
    pub label: String,
    pub utilization: f64,
    pub resets_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
}

/// History response
#[derive(Debug, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryResponse {
    pub entries: Vec<HistoryEntry>,
    pub total: usize,
}

/// History entry
#[derive(Debug, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub id: String,
    pub provider: String,
    pub account_id: String,
    pub account_name: String,
    pub timestamp: String,
    pub limits: Vec<LimitSnapshot>,
}

/// Limit snapshot in history
#[derive(Debug, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LimitSnapshot {
    pub id: String,
    pub utilization: f64,
    pub resets_at: String,
}

/// Refresh response
#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RefreshResponse {
    pub success: bool,
    pub message: String,
}
