// Gatrix Rust Server SDK
// HTTP API Client with retry and exponential backoff

use std::time::Duration;

use log::{debug, warn};
use reqwest::header::{HeaderMap, HeaderValue};
use serde::de::DeserializeOwned;

use crate::config::RetryConfig;
use crate::types::api::ApiResponse;

/// SDK version constant
pub const SDK_VERSION: &str = "gatrix-rust-server-sdk/0.1.0";

/// API client configuration
#[derive(Debug, Clone)]
pub struct ApiClientConfig {
    pub base_url: String,
    pub api_token: String,
    pub app_name: String,
    pub retry: RetryConfig,
}

/// HTTP API client with automatic retry and standard headers
pub struct ApiClient {
    client: reqwest::Client,
    config: ApiClientConfig,
}

impl ApiClient {
    pub fn new(config: ApiClientConfig) -> Self {
        let mut default_headers = HeaderMap::new();
        default_headers.insert(
            "X-API-Token",
            HeaderValue::from_str(&config.api_token).unwrap_or_else(|_| HeaderValue::from_static("")),
        );
        default_headers.insert(
            "X-Application-Name",
            HeaderValue::from_str(&config.app_name).unwrap_or_else(|_| HeaderValue::from_static("")),
        );
        default_headers.insert(
            "X-SDK-Version",
            HeaderValue::from_static(SDK_VERSION),
        );

        let client = reqwest::Client::builder()
            .default_headers(default_headers)
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to build HTTP client");

        Self { client, config }
    }

    /// Build full URL from endpoint
    fn url(&self, endpoint: &str) -> String {
        format!(
            "{}{}",
            self.config.base_url.trim_end_matches('/'),
            endpoint
        )
    }

    /// GET request with retry
    pub async fn get<T: DeserializeOwned>(&self, endpoint: &str) -> Result<ApiResponse<T>, crate::error::GatrixError> {
        self.request_with_retry(reqwest::Method::GET, endpoint, None::<&()>).await
    }

    /// POST request with retry
    pub async fn post<B: serde::Serialize, T: DeserializeOwned>(
        &self,
        endpoint: &str,
        body: &B,
    ) -> Result<ApiResponse<T>, crate::error::GatrixError> {
        self.request_with_retry(reqwest::Method::POST, endpoint, Some(body)).await
    }

    /// PUT request with retry
    pub async fn put<B: serde::Serialize, T: DeserializeOwned>(
        &self,
        endpoint: &str,
        body: &B,
    ) -> Result<ApiResponse<T>, crate::error::GatrixError> {
        self.request_with_retry(reqwest::Method::PUT, endpoint, Some(body)).await
    }

    /// DELETE request with retry
    pub async fn delete<T: DeserializeOwned>(&self, endpoint: &str) -> Result<ApiResponse<T>, crate::error::GatrixError> {
        self.request_with_retry(reqwest::Method::DELETE, endpoint, None::<&()>).await
    }

    /// Execute HTTP request with exponential backoff retry
    async fn request_with_retry<B: serde::Serialize, T: DeserializeOwned>(
        &self,
        method: reqwest::Method,
        endpoint: &str,
        body: Option<&B>,
    ) -> Result<ApiResponse<T>, crate::error::GatrixError> {
        let url = self.url(endpoint);
        let retry = &self.config.retry;
        let max_retries = if retry.enabled { retry.max_retries } else { 0 };
        let mut attempt = 0;
        let mut delay = retry.retry_delay;

        loop {
            let mut request = self.client.request(method.clone(), &url);
            if let Some(b) = body {
                request = request.json(b);
            }

            match request.send().await {
                Ok(response) => {
                    let status = response.status().as_u16();

                    // Non-retryable error codes — fail immediately
                    if !response.status().is_success()
                        && !retry.retryable_status_codes.contains(&status)
                    {
                        let text = response.text().await.unwrap_or_default();
                        // Try to parse as ApiResponse
                        if let Ok(api_resp) = serde_json::from_str::<ApiResponse<T>>(&text) {
                            return Ok(api_resp);
                        }
                        return Err(crate::error::GatrixError::new(
                            crate::error::ErrorCode::ApiError,
                            format!("HTTP {} - {}", status, text),
                        ));
                    }

                    // Retryable status code
                    if !response.status().is_success() {
                        if attempt >= max_retries && max_retries >= 0 {
                            let text = response.text().await.unwrap_or_default();
                            return Err(crate::error::GatrixError::new(
                                crate::error::ErrorCode::NetworkError,
                                format!(
                                    "HTTP {} after {} retries - {}",
                                    status,
                                    attempt,
                                    text
                                ),
                            ));
                        }
                        warn!(
                            "Retryable HTTP error {} on {} (attempt {}/{})",
                            status, endpoint, attempt + 1, max_retries
                        );
                    } else {
                        // Success
                        let text = response.text().await.map_err(|e| {
                            crate::error::GatrixError::new(
                                crate::error::ErrorCode::NetworkError,
                                format!("Failed to read response body: {}", e),
                            )
                        })?;

                        let api_resp: ApiResponse<T> = serde_json::from_str(&text).map_err(|e| {
                            crate::error::GatrixError::new(
                                crate::error::ErrorCode::ApiError,
                                format!("Failed to parse response: {}", e),
                            )
                        })?;

                        return Ok(api_resp);
                    }
                }
                Err(e) => {
                    if attempt >= max_retries && max_retries >= 0 {
                        return Err(crate::error::GatrixError::new(
                            crate::error::ErrorCode::NetworkError,
                            format!("Request failed after {} retries: {}", attempt, e),
                        ));
                    }
                    warn!(
                        "Network error on {} (attempt {}/{}): {}",
                        endpoint,
                        attempt + 1,
                        max_retries,
                        e
                    );
                }
            }

            // Exponential backoff
            debug!("Retrying in {}ms...", delay);
            tokio::time::sleep(Duration::from_millis(delay)).await;
            delay = (delay as f64 * retry.retry_delay_multiplier) as u64;
            if delay > retry.max_retry_delay {
                delay = retry.max_retry_delay;
            }
            attempt += 1;
        }
    }

    /// Get a reference to the underlying reqwest client (for advanced use cases)
    pub fn inner(&self) -> &reqwest::Client {
        &self.client
    }

    /// Get API token being used
    pub fn api_token(&self) -> &str {
        &self.config.api_token
    }

    /// Create a new API client with a different token (for multi-environment mode)
    pub fn with_token(&self, token: &str) -> Self {
        let mut config = self.config.clone();
        config.api_token = token.to_string();
        Self::new(config)
    }
}
