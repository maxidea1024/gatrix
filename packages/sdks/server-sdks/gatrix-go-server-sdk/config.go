package gatrix

import "github.com/gatrix/gatrix-go-server-sdk/client"

// RefreshMethod types
const (
	RefreshMethodPolling = "polling"
	RefreshMethodEvent   = "event"
	RefreshMethodManual  = "manual"
)

// GatrixSDKConfig is the top-level configuration for the SDK
type GatrixSDKConfig struct {
	APIURL          string            `json:"apiUrl"`
	APIToken        string            `json:"apiToken"`
	ApplicationName string            `json:"applicationName"`
	Service         string            `json:"service,omitempty"`
	Group           string            `json:"group,omitempty"`
	Environment     string            `json:"environment,omitempty"`
	WorldID         string            `json:"worldId,omitempty"`
	Redis           *RedisConfig      `json:"redis,omitempty"`
	Cache           *CacheConfig      `json:"cache,omitempty"`
	Logger          *LoggerConfig     `json:"logger,omitempty"`
	Retry           *client.RetryConfig `json:"retry,omitempty"`
	Uses            *UsesConfig       `json:"uses,omitempty"`
	FeatureFlags    *FeatureFlagConfig `json:"featureFlags,omitempty"`
	CustomLogger    interface{}       `json:"-"` // Will be set programmatically
}

// RedisConfig configures the Redis connection for event-based refresh
type RedisConfig struct {
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Password string `json:"password,omitempty"`
	DB       int    `json:"db,omitempty"`
}

// CacheConfig configures cache behavior
type CacheConfig struct {
	TTL           int    `json:"ttl,omitempty"`           // Seconds
	RefreshMethod string `json:"refreshMethod,omitempty"` // polling, event, manual
}

// LoggerConfig configures logging
type LoggerConfig struct {
	Level string `json:"level,omitempty"` // debug, info, warn, error
}

// UsesConfig specifies which services to enable caching for
type UsesConfig struct {
	GameWorld          *bool `json:"gameWorld,omitempty"`
	PopupNotice        *bool `json:"popupNotice,omitempty"`
	Survey             *bool `json:"survey,omitempty"`
	Whitelist          *bool `json:"whitelist,omitempty"`
	ServiceMaintenance *bool `json:"serviceMaintenance,omitempty"`
	StoreProduct       *bool `json:"storeProduct,omitempty"`
	FeatureFlag        *bool `json:"featureFlag,omitempty"`
}

// FeatureFlagConfig contains feature-flag-specific settings
type FeatureFlagConfig struct {
	Compact *bool `json:"compact,omitempty"`
}

// getBool returns the value of a *bool or the default
func getBool(p *bool, defaultVal bool) bool {
	if p != nil {
		return *p
	}
	return defaultVal
}

// BoolPtrExported returns a pointer to a bool (exported for user code)
func BoolPtrExported(v bool) *bool {
	return &v
}
