package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"sync"
	"time"

	"github.com/gatrix/gatrix-go-server-sdk/types"
)

// RetryConfig holds HTTP retry settings
type RetryConfig struct {
	Enabled              *bool
	MaxRetries           int
	RetryDelay           int
	RetryDelayMultiplier int
	MaxRetryDelay        int
	RetryableStatusCodes []int
}

// ApiClientConfig holds configuration for creating an ApiClient
type ApiClientConfig struct {
	BaseURL         string
	APIToken        string
	ApplicationName string
	Timeout         time.Duration
	Logger          types.Logger
	Retry           *RetryConfig
}

var defaultRetryValues = RetryConfig{
	Enabled:              boolP(true),
	MaxRetries:           10,
	RetryDelay:           2000,
	RetryDelayMultiplier: 2,
	MaxRetryDelay:        10000,
	RetryableStatusCodes: []int{408, 429, 500, 502, 503, 504},
}

func boolP(v bool) *bool { return &v }

// ApiClient is the HTTP client for Gatrix API
type ApiClient struct {
	httpClient      *http.Client
	baseURL         string
	apiToken        string
	applicationName string
	logger          types.Logger
	retryConfig     RetryConfig
	etagStore       map[string]string
	bodyCache       map[string]json.RawMessage
	mu              sync.RWMutex
}

// ApiResponse is the standard API response
type ApiResponse struct {
	Success bool            `json:"success"`
	Data    json.RawMessage `json:"data,omitempty"`
	Error   *ApiError       `json:"error,omitempty"`
}

// ApiError represents an API error
type ApiError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// NewApiClient creates a new API client
func NewApiClient(config ApiClientConfig) *ApiClient {
	timeout := config.Timeout
	if timeout == 0 {
		timeout = 30 * time.Second
	}
	logger := config.Logger
	if logger == nil {
		logger = types.NewDefaultLogger(types.LogLevelInfo)
	}

	retry := defaultRetryValues
	if config.Retry != nil {
		if config.Retry.Enabled != nil {
			retry.Enabled = config.Retry.Enabled
		}
		if config.Retry.MaxRetries > 0 {
			retry.MaxRetries = config.Retry.MaxRetries
		}
		if config.Retry.RetryDelay > 0 {
			retry.RetryDelay = config.Retry.RetryDelay
		}
		if config.Retry.RetryDelayMultiplier > 0 {
			retry.RetryDelayMultiplier = config.Retry.RetryDelayMultiplier
		}
		if config.Retry.MaxRetryDelay > 0 {
			retry.MaxRetryDelay = config.Retry.MaxRetryDelay
		}
		if len(config.Retry.RetryableStatusCodes) > 0 {
			retry.RetryableStatusCodes = config.Retry.RetryableStatusCodes
		}
	}

	return &ApiClient{
		httpClient:      &http.Client{Timeout: timeout},
		baseURL:         config.BaseURL,
		apiToken:        config.APIToken,
		applicationName: config.ApplicationName,
		logger:          logger,
		retryConfig:     retry,
		etagStore:       make(map[string]string),
		bodyCache:       make(map[string]json.RawMessage),
	}
}

// Get performs a GET request with ETag caching and retry
func (c *ApiClient) Get(path string) (*ApiResponse, error) {
	return c.doRequest("GET", path, nil)
}

// Post performs a POST request with retry
func (c *ApiClient) Post(path string, body interface{}) (*ApiResponse, error) {
	return c.doRequest("POST", path, body)
}

// Put performs a PUT request with retry
func (c *ApiClient) Put(path string, body interface{}) (*ApiResponse, error) {
	return c.doRequest("PUT", path, body)
}

// Delete performs a DELETE request with retry
func (c *ApiClient) Delete(path string) (*ApiResponse, error) {
	return c.doRequest("DELETE", path, nil)
}

// PostNoRetry performs a POST without retry (for shutdown operations)
func (c *ApiClient) PostNoRetry(path string, body interface{}) (*ApiResponse, error) {
	return c.doSingleRequest("POST", path, body)
}

// InvalidateEtagCache removes cached ETag for a URL pattern
func (c *ApiClient) InvalidateEtagCache(urlPattern string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	for key := range c.etagStore {
		if len(key) >= len(urlPattern) && key[:len(urlPattern)] == urlPattern {
			delete(c.etagStore, key)
			delete(c.bodyCache, key)
		}
	}
}

func (c *ApiClient) doRequest(method, path string, body interface{}) (*ApiResponse, error) {
	enabled := true
	if c.retryConfig.Enabled != nil {
		enabled = *c.retryConfig.Enabled
	}
	maxAttempts := c.retryConfig.MaxRetries
	if !enabled {
		maxAttempts = 0
	}

	var lastErr error
	for attempt := 0; attempt <= maxAttempts; attempt++ {
		resp, err := c.doSingleRequest(method, path, body)
		if err == nil {
			return resp, nil
		}
		lastErr = err
		if !c.isRetryableError(err) {
			return nil, err
		}
		if attempt < maxAttempts {
			delay := c.calculateRetryDelay(attempt)
			c.logger.Warn("Request failed, retrying...", map[string]interface{}{
				"method": method, "path": path, "attempt": attempt + 1,
				"retryDelay": delay, "error": err.Error(),
			})
			time.Sleep(time.Duration(delay) * time.Millisecond)
		}
	}
	return nil, lastErr
}

func (c *ApiClient) doSingleRequest(method, path string, body interface{}) (*ApiResponse, error) {
	url := c.baseURL + path
	var bodyReader io.Reader
	if body != nil {
		bodyBytes, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request body: %w", err)
		}
		bodyReader = bytes.NewReader(bodyBytes)
	}

	req, err := http.NewRequest(method, url, bodyReader)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Token", c.apiToken)
	req.Header.Set("X-Application-Name", c.applicationName)
	req.Header.Set("X-SDK-Version", fmt.Sprintf("%s/%s", types.SDKName, types.SDKVersion))

	if method == "GET" {
		c.mu.RLock()
		etag, hasEtag := c.etagStore[path]
		c.mu.RUnlock()
		if hasEtag {
			req.Header.Set("If-None-Match", etag)
		}
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, &types.GatrixError{Code: types.ErrorCodeNetworkError, Message: fmt.Sprintf("Network error: %s", err.Error())}
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotModified {
		c.mu.RLock()
		cachedBody, hasCached := c.bodyCache[path]
		c.mu.RUnlock()
		if hasCached {
			var apiResp ApiResponse
			if err := json.Unmarshal(cachedBody, &apiResp); err == nil {
				return &apiResp, nil
			}
		}
	}

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode >= 400 {
		var apiResp ApiResponse
		_ = json.Unmarshal(respBody, &apiResp)
		errMsg := "API error"
		errCode := types.ErrorCodeAPIError
		if apiResp.Error != nil {
			errMsg = apiResp.Error.Message
		}
		if resp.StatusCode == 401 {
			errCode = types.ErrorCodeAuthFailed
			errMsg = "Authentication failed. Please check your API token."
		} else if resp.StatusCode < 500 {
			errCode = types.ErrorCodeInvalidParams
		}
		return nil, &types.GatrixError{Code: errCode, Message: errMsg, StatusCode: resp.StatusCode}
	}

	if method == "GET" {
		etag := resp.Header.Get("ETag")
		if etag != "" {
			c.mu.Lock()
			c.etagStore[path] = etag
			c.bodyCache[path] = json.RawMessage(respBody)
			c.mu.Unlock()
		}
	}

	var apiResp ApiResponse
	if err := json.Unmarshal(respBody, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}
	return &apiResp, nil
}

func (c *ApiClient) isRetryableError(err error) bool {
	if gatrixErr, ok := err.(*types.GatrixError); ok {
		if gatrixErr.Code == types.ErrorCodeNetworkError {
			return true
		}
		if gatrixErr.StatusCode > 0 {
			for _, code := range c.retryConfig.RetryableStatusCodes {
				if gatrixErr.StatusCode == code {
					return true
				}
			}
		}
		return false
	}
	return true
}

func (c *ApiClient) calculateRetryDelay(attempt int) int {
	delay := float64(c.retryConfig.RetryDelay) * math.Pow(float64(c.retryConfig.RetryDelayMultiplier), float64(attempt))
	if delay > float64(c.retryConfig.MaxRetryDelay) {
		return c.retryConfig.MaxRetryDelay
	}
	return int(delay)
}
