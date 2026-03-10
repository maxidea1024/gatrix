package types

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"
	"time"
)

// SDKVersion is the current version of the SDK
const SDKVersion = "1.0.0"

// SDKName is the name of the SDK
const SDKName = "gatrix-go-server-sdk"

// --- Logger ---

// LogLevel represents the severity of a log message
type LogLevel int

const (
	LogLevelDebug LogLevel = iota
	LogLevelInfo
	LogLevelWarn
	LogLevelError
)

// Logger is the interface for SDK logging
type Logger interface {
	Debug(msg string, fields ...map[string]interface{})
	Info(msg string, fields ...map[string]interface{})
	Warn(msg string, fields ...map[string]interface{})
	Error(msg string, fields ...map[string]interface{})
}

// ParseLogLevel parses a string to LogLevel
func ParseLogLevel(level string) LogLevel {
	switch strings.ToLower(level) {
	case "debug":
		return LogLevelDebug
	case "info":
		return LogLevelInfo
	case "warn":
		return LogLevelWarn
	case "error":
		return LogLevelError
	default:
		return LogLevelInfo
	}
}

type defaultLogger struct {
	level  LogLevel
	logger *log.Logger
}

// NewDefaultLogger creates a new default logger
func NewDefaultLogger(level LogLevel) Logger {
	return &defaultLogger{
		level:  level,
		logger: log.New(os.Stdout, "", 0),
	}
}

func (l *defaultLogger) Debug(msg string, fields ...map[string]interface{}) {
	if l.level <= LogLevelDebug {
		l.logMessage("DEBUG", msg, fields...)
	}
}
func (l *defaultLogger) Info(msg string, fields ...map[string]interface{}) {
	if l.level <= LogLevelInfo {
		l.logMessage("INFO", msg, fields...)
	}
}
func (l *defaultLogger) Warn(msg string, fields ...map[string]interface{}) {
	if l.level <= LogLevelWarn {
		l.logMessage("WARN", msg, fields...)
	}
}
func (l *defaultLogger) Error(msg string, fields ...map[string]interface{}) {
	if l.level <= LogLevelError {
		l.logMessage("ERROR", msg, fields...)
	}
}
func (l *defaultLogger) logMessage(level string, msg string, fields ...map[string]interface{}) {
	timestamp := time.Now().UTC().Format(time.RFC3339)
	if len(fields) > 0 && len(fields[0]) > 0 {
		fieldsJSON, _ := json.Marshal(fields[0])
		l.logger.Printf("[%s] %s [gatrix-go-sdk] %s %s", timestamp, level, msg, string(fieldsJSON))
	} else {
		l.logger.Printf("[%s] %s [gatrix-go-sdk] %s", timestamp, level, msg)
	}
}

type noopLogger struct{}

func (l *noopLogger) Debug(_ string, _ ...map[string]interface{}) {}
func (l *noopLogger) Info(_ string, _ ...map[string]interface{})  {}
func (l *noopLogger) Warn(_ string, _ ...map[string]interface{})  {}
func (l *noopLogger) Error(_ string, _ ...map[string]interface{}) {}

// NewNoopLogger creates a logger that discards all output
func NewNoopLogger() Logger {
	return &noopLogger{}
}

// --- Errors ---

// ErrorCode represents SDK error codes
type ErrorCode string

const (
	ErrorCodeAuthFailed     ErrorCode = "AUTH_FAILED"
	ErrorCodeInvalidParams  ErrorCode = "INVALID_PARAMETERS"
	ErrorCodeAPIError       ErrorCode = "API_ERROR"
	ErrorCodeNetworkError   ErrorCode = "NETWORK_ERROR"
	ErrorCodeConfigError    ErrorCode = "CONFIGURATION_ERROR"
	ErrorCodeNotInitialized ErrorCode = "NOT_INITIALIZED"
)

// GatrixError is the base SDK error type
type GatrixError struct {
	Code       ErrorCode
	Message    string
	StatusCode int
	Details    interface{}
}

func (e *GatrixError) Error() string {
	if e.StatusCode > 0 {
		return fmt.Sprintf("[%s] %s (status: %d)", e.Code, e.Message, e.StatusCode)
	}
	return fmt.Sprintf("[%s] %s", e.Code, e.Message)
}

// NewGatrixError creates a new GatrixError
func NewGatrixError(code ErrorCode, message string, statusCode int, details interface{}) *GatrixError {
	return &GatrixError{Code: code, Message: message, StatusCode: statusCode, Details: details}
}

// FeatureFlagErrorCode represents feature flag specific error codes
type FeatureFlagErrorCode string

const (
	FlagNotFound    FeatureFlagErrorCode = "FLAG_NOT_FOUND"
	FlagNoValue     FeatureFlagErrorCode = "NO_VALUE"
	FlagInvalidType FeatureFlagErrorCode = "INVALID_VALUE_TYPE"
)

// FeatureFlagError is an error specific to feature flag operations
type FeatureFlagError struct {
	Code          FeatureFlagErrorCode
	Message       string
	FlagName      string
	EnvironmentID string
}

func (e *FeatureFlagError) Error() string {
	return fmt.Sprintf("[%s] %s (flag: %s, env: %s)", e.Code, e.Message, e.FlagName, e.EnvironmentID)
}

// CouponRedeemErrorCode represents coupon redemption error codes
type CouponRedeemErrorCode string

const (
	CouponCodeNotFound      CouponRedeemErrorCode = "COUPON_CODE_NOT_FOUND"
	CouponAlreadyUsed       CouponRedeemErrorCode = "COUPON_ALREADY_USED"
	CouponUserLimitExceeded CouponRedeemErrorCode = "COUPON_USER_LIMIT_EXCEEDED"
	CouponNotActive         CouponRedeemErrorCode = "COUPON_NOT_ACTIVE"
	CouponNotStarted        CouponRedeemErrorCode = "COUPON_NOT_STARTED"
	CouponExpired           CouponRedeemErrorCode = "COUPON_EXPIRED"
	CouponInvalidWorld      CouponRedeemErrorCode = "COUPON_INVALID_WORLD"
	CouponInvalidPlatform   CouponRedeemErrorCode = "COUPON_INVALID_PLATFORM"
	CouponInvalidChannel    CouponRedeemErrorCode = "COUPON_INVALID_CHANNEL"
	CouponInvalidSubchannel CouponRedeemErrorCode = "COUPON_INVALID_SUBCHANNEL"
	CouponInvalidUser       CouponRedeemErrorCode = "COUPON_INVALID_USER"
	CouponInvalidParams     CouponRedeemErrorCode = "COUPON_INVALID_PARAMETERS"
)

// CouponRedeemError is an error specific to coupon operations
type CouponRedeemError struct {
	Code       CouponRedeemErrorCode
	Message    string
	StatusCode int
}

func (e *CouponRedeemError) Error() string {
	return fmt.Sprintf("[%s] %s (status: %d)", e.Code, e.Message, e.StatusCode)
}
