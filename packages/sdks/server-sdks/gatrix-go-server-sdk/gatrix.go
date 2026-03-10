package gatrix

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/gatrix/gatrix-go-server-sdk/cache"
	"github.com/gatrix/gatrix-go-server-sdk/client"
	"github.com/gatrix/gatrix-go-server-sdk/events"
	"github.com/gatrix/gatrix-go-server-sdk/services"
	"github.com/gatrix/gatrix-go-server-sdk/types"
)

// GatrixServerSDK is the main entry point for the Gatrix Go Server SDK
type GatrixServerSDK struct {
	config        GatrixSDKConfig
	logger        types.Logger
	apiClient     *client.ApiClient
	cacheManager  *cache.CacheManager
	eventEmitter  *events.EventEmitter
	eventListener *events.EventListener
	initialized   bool

	FeatureFlag        *services.FeatureFlagService
	GameWorld          *services.GameWorldService
	PopupNotice        *services.PopupNoticeService
	Survey             *services.SurveyService
	Whitelist          *services.WhitelistService
	ServiceMaintenance *services.ServiceMaintenanceService
	StoreProduct       *services.StoreProductService
	ServiceDiscovery   *services.ServiceDiscoveryService
	Coupon             *services.CouponService
	ImpactMetrics      *services.ImpactMetricsService
}

// NewGatrixServerSDK creates a new SDK instance with the given configuration
func NewGatrixServerSDK(config GatrixSDKConfig) (*GatrixServerSDK, error) {
	if config.APIURL == "" {
		return nil, &types.GatrixError{Code: types.ErrorCodeConfigError, Message: "apiUrl is required"}
	}
	if config.APIToken == "" {
		return nil, &types.GatrixError{Code: types.ErrorCodeConfigError, Message: "apiToken is required"}
	}
	if config.ApplicationName == "" {
		return nil, &types.GatrixError{Code: types.ErrorCodeConfigError, Message: "applicationName is required"}
	}

	var logger types.Logger
	if cl, ok := config.CustomLogger.(types.Logger); ok && cl != nil {
		logger = cl
	} else {
		level := types.LogLevelInfo
		if config.Logger != nil && config.Logger.Level != "" {
			level = types.ParseLogLevel(config.Logger.Level)
		}
		logger = types.NewDefaultLogger(level)
	}

	config.APIURL = strings.TrimRight(config.APIURL, "/")

	apiClient := client.NewApiClient(client.ApiClientConfig{
		BaseURL:         config.APIURL,
		APIToken:        config.APIToken,
		ApplicationName: config.ApplicationName,
		Logger:          logger,
		Retry:           config.Retry,
	})

	envID := config.Environment

	sdk := &GatrixServerSDK{
		config:       config,
		logger:       logger,
		apiClient:    apiClient,
		eventEmitter: events.NewEventEmitter(),
	}

	sdk.FeatureFlag = services.NewFeatureFlagService(apiClient, logger, envID)
	sdk.GameWorld = services.NewGameWorldService(apiClient, logger, envID)
	sdk.PopupNotice = services.NewPopupNoticeService(apiClient, logger, envID)
	sdk.Survey = services.NewSurveyService(apiClient, logger, envID)
	sdk.Whitelist = services.NewWhitelistService(apiClient, logger, envID)
	sdk.ServiceMaintenance = services.NewServiceMaintenanceService(apiClient, logger, envID)
	sdk.StoreProduct = services.NewStoreProductService(apiClient, logger, envID)
	sdk.ServiceDiscovery = services.NewServiceDiscoveryService(apiClient, logger)
	sdk.Coupon = services.NewCouponService(apiClient, logger)
	sdk.ImpactMetrics = services.NewImpactMetricsService(apiClient, logger, config.ApplicationName, config.Service)

	if config.FeatureFlags != nil && config.FeatureFlags.Compact != nil {
		sdk.FeatureFlag.SetCompactFlags(*config.FeatureFlags.Compact)
	}

	if config.Uses != nil {
		sdk.GameWorld.SetFeatureEnabled(getBool(config.Uses.GameWorld, true))
		sdk.PopupNotice.SetFeatureEnabled(getBool(config.Uses.PopupNotice, true))
		sdk.Survey.SetFeatureEnabled(getBool(config.Uses.Survey, true))
		sdk.Whitelist.SetFeatureEnabled(getBool(config.Uses.Whitelist, true))
		sdk.ServiceMaintenance.SetFeatureEnabled(getBool(config.Uses.ServiceMaintenance, true))
		sdk.StoreProduct.SetFeatureEnabled(getBool(config.Uses.StoreProduct, false))
		sdk.FeatureFlag.SetFeatureEnabled(getBool(config.Uses.FeatureFlag, false))
	}

	return sdk, nil
}

// Initialize bootstraps the SDK
func (sdk *GatrixServerSDK) Initialize() error {
	if sdk.initialized {
		return nil
	}

	sdk.logger.Info("Initializing Gatrix Go Server SDK", map[string]interface{}{
		"version": types.SDKVersion, "appName": sdk.config.ApplicationName,
	})

	sdk.fetchInitialData()

	refreshMethod := RefreshMethodPolling
	cacheTTL := 300
	if sdk.config.Cache != nil {
		if sdk.config.Cache.RefreshMethod != "" {
			refreshMethod = sdk.config.Cache.RefreshMethod
		}
		if sdk.config.Cache.TTL > 0 {
			cacheTTL = sdk.config.Cache.TTL
		}
	}

	switch refreshMethod {
	case RefreshMethodPolling:
		sdk.startPolling(cacheTTL)
	case RefreshMethodEvent:
		if err := sdk.startEventListener(); err != nil {
			sdk.logger.Warn("Failed to start event listener, falling back to polling", map[string]interface{}{"error": err.Error()})
			sdk.startPolling(cacheTTL)
		}
	case RefreshMethodManual:
		sdk.logger.Info("Manual refresh mode enabled")
	}

	sdk.FeatureFlag.StartMetricsCollection(60000)
	sdk.initialized = true
	sdk.logger.Info("Gatrix Go Server SDK initialized successfully")
	return nil
}

// Shutdown gracefully shuts down the SDK
func (sdk *GatrixServerSDK) Shutdown() {
	sdk.logger.Info("Shutting down Gatrix Go Server SDK...")
	sdk.FeatureFlag.StopMetricsCollection()
	sdk.ImpactMetrics.StopCollection()
	if sdk.cacheManager != nil {
		sdk.cacheManager.Stop()
	}
	if sdk.eventListener != nil {
		sdk.eventListener.Stop()
	}
	_ = sdk.ServiceDiscovery.Unregister()
	sdk.initialized = false
}

// On registers an event callback
func (sdk *GatrixServerSDK) On(eventType string, callback types.EventCallback) {
	sdk.eventEmitter.On(eventType, callback)
}

// Off removes event callbacks
func (sdk *GatrixServerSDK) Off(eventType string) {
	sdk.eventEmitter.Off(eventType)
}

// RefreshCache manually refreshes cache for all services
func (sdk *GatrixServerSDK) RefreshCache() {
	if sdk.cacheManager != nil {
		sdk.cacheManager.RefreshAll()
	} else {
		sdk.fetchInitialData()
	}
}

// IsInitialized returns whether the SDK has been initialized
func (sdk *GatrixServerSDK) IsInitialized() bool { return sdk.initialized }

func (sdk *GatrixServerSDK) fetchInitialData() {
	env := sdk.config.Environment

	if sdk.config.Uses == nil || getBool(sdk.config.Uses.FeatureFlag, false) {
		if _, err := sdk.FeatureFlag.FetchByEnvironment(env); err != nil {
			sdk.logger.Warn("Failed to fetch feature flags", map[string]interface{}{"error": err.Error()})
		}
	}
	if sdk.config.Uses == nil || getBool(sdk.config.Uses.GameWorld, true) {
		if _, err := sdk.GameWorld.FetchByEnvironment(env); err != nil {
			sdk.logger.Warn("Failed to fetch game worlds", map[string]interface{}{"error": err.Error()})
		}
	}
	if sdk.config.Uses == nil || getBool(sdk.config.Uses.PopupNotice, true) {
		if _, err := sdk.PopupNotice.FetchByEnvironment(env); err != nil {
			sdk.logger.Warn("Failed to fetch popup notices", map[string]interface{}{"error": err.Error()})
		}
	}
	if sdk.config.Uses == nil || getBool(sdk.config.Uses.Survey, true) {
		if _, err := sdk.Survey.FetchByEnvironment(env); err != nil {
			sdk.logger.Warn("Failed to fetch surveys", map[string]interface{}{"error": err.Error()})
		}
	}
	if sdk.config.Uses == nil || getBool(sdk.config.Uses.Whitelist, true) {
		if _, err := sdk.Whitelist.FetchByEnvironment(env); err != nil {
			sdk.logger.Warn("Failed to fetch whitelist", map[string]interface{}{"error": err.Error()})
		}
	}
	if sdk.config.Uses == nil || getBool(sdk.config.Uses.ServiceMaintenance, true) {
		if _, err := sdk.ServiceMaintenance.FetchByEnvironment(env); err != nil {
			sdk.logger.Warn("Failed to fetch maintenance", map[string]interface{}{"error": err.Error()})
		}
	}
	if sdk.config.Uses != nil && getBool(sdk.config.Uses.StoreProduct, false) {
		if _, err := sdk.StoreProduct.FetchByEnvironment(env); err != nil {
			sdk.logger.Warn("Failed to fetch store products", map[string]interface{}{"error": err.Error()})
		}
	}
}

func (sdk *GatrixServerSDK) startPolling(intervalSeconds int) {
	sdk.cacheManager = cache.NewCacheManager(sdk.logger)
	sdk.cacheManager.SetEnvironments([]string{sdk.config.Environment})

	if sdk.config.Uses == nil || getBool(sdk.config.Uses.FeatureFlag, false) {
		sdk.cacheManager.AddRefresher("featureFlag", func(e string) error { _, err := sdk.FeatureFlag.RefreshByEnvironment(e); return err })
	}
	if sdk.config.Uses == nil || getBool(sdk.config.Uses.GameWorld, true) {
		sdk.cacheManager.AddRefresher("gameWorld", func(e string) error { _, err := sdk.GameWorld.FetchByEnvironment(e); return err })
	}
	if sdk.config.Uses == nil || getBool(sdk.config.Uses.PopupNotice, true) {
		sdk.cacheManager.AddRefresher("popupNotice", func(e string) error { _, err := sdk.PopupNotice.FetchByEnvironment(e); return err })
	}
	if sdk.config.Uses == nil || getBool(sdk.config.Uses.Survey, true) {
		sdk.cacheManager.AddRefresher("survey", func(e string) error { _, err := sdk.Survey.FetchByEnvironment(e); return err })
	}
	if sdk.config.Uses == nil || getBool(sdk.config.Uses.Whitelist, true) {
		sdk.cacheManager.AddRefresher("whitelist", func(e string) error { _, err := sdk.Whitelist.FetchByEnvironment(e); return err })
	}
	if sdk.config.Uses == nil || getBool(sdk.config.Uses.ServiceMaintenance, true) {
		sdk.cacheManager.AddRefresher("maintenance", func(e string) error { _, err := sdk.ServiceMaintenance.FetchByEnvironment(e); return err })
	}
	sdk.cacheManager.Start(intervalSeconds)
}

func (sdk *GatrixServerSDK) startEventListener() error {
	if sdk.config.Redis == nil {
		return fmt.Errorf("redis config is required for event refresh mode")
	}
	sdk.eventListener = events.NewEventListener(events.EventListenerConfig{
		Host: sdk.config.Redis.Host, Port: sdk.config.Redis.Port,
		Password: sdk.config.Redis.Password, DB: sdk.config.Redis.DB,
	}, sdk.eventEmitter, sdk.logger)
	if err := sdk.eventListener.Start(); err != nil {
		return err
	}
	sdk.setupEventHandlers()
	return nil
}

func (sdk *GatrixServerSDK) setupEventHandlers() {
	env := sdk.config.Environment

	refreshOn := func(eventType types.StandardEventType, refreshFn func() error) {
		sdk.eventEmitter.On(string(eventType), func(_ types.SdkEvent) {
			if err := refreshFn(); err != nil {
				sdk.logger.Warn("Event refresh failed", map[string]interface{}{
					"event": string(eventType), "error": err.Error(),
				})
			}
		})
	}

	refreshOn(types.EventFeatureFlagChanged, func() error { _, err := sdk.FeatureFlag.RefreshByEnvironment(env); return err })
	refreshOn(types.EventFeatureFlagCreated, func() error { _, err := sdk.FeatureFlag.RefreshByEnvironment(env); return err })
	refreshOn(types.EventFeatureFlagDeleted, func() error { _, err := sdk.FeatureFlag.RefreshByEnvironment(env); return err })

	sdk.eventEmitter.On(string(types.EventSegmentCreated), func(e types.SdkEvent) { sdk.handleSegmentEvent(e) })
	sdk.eventEmitter.On(string(types.EventSegmentUpdated), func(e types.SdkEvent) { sdk.handleSegmentEvent(e) })
	sdk.eventEmitter.On(string(types.EventSegmentDeleted), func(e types.SdkEvent) {
		data, ok := e.Data.(types.StandardEventData)
		if ok && data.SegmentName != "" && data.ProjectID != "" {
			sdk.FeatureFlag.RemoveSegmentFromCache(data.SegmentName, data.ProjectID)
		}
	})

	refreshOn(types.EventGameWorldCreated, func() error { _, err := sdk.GameWorld.FetchByEnvironment(env); return err })
	refreshOn(types.EventGameWorldUpdated, func() error { _, err := sdk.GameWorld.FetchByEnvironment(env); return err })
	refreshOn(types.EventGameWorldDeleted, func() error { _, err := sdk.GameWorld.FetchByEnvironment(env); return err })
	refreshOn(types.EventPopupCreated, func() error { _, err := sdk.PopupNotice.FetchByEnvironment(env); return err })
	refreshOn(types.EventPopupUpdated, func() error { _, err := sdk.PopupNotice.FetchByEnvironment(env); return err })
	refreshOn(types.EventPopupDeleted, func() error { _, err := sdk.PopupNotice.FetchByEnvironment(env); return err })
	refreshOn(types.EventSurveyCreated, func() error { _, err := sdk.Survey.FetchByEnvironment(env); return err })
	refreshOn(types.EventSurveyUpdated, func() error { _, err := sdk.Survey.FetchByEnvironment(env); return err })
	refreshOn(types.EventSurveyDeleted, func() error { _, err := sdk.Survey.FetchByEnvironment(env); return err })
	refreshOn(types.EventWhitelistUpdated, func() error { _, err := sdk.Whitelist.FetchByEnvironment(env); return err })
	refreshOn(types.EventMaintenanceUpdated, func() error { _, err := sdk.ServiceMaintenance.FetchByEnvironment(env); return err })
}

func (sdk *GatrixServerSDK) handleSegmentEvent(e types.SdkEvent) {
	dataBytes, err := json.Marshal(e.Data)
	if err != nil {
		return
	}
	var eventData types.StandardEventData
	if err := json.Unmarshal(dataBytes, &eventData); err != nil {
		return
	}
	if eventData.Segment != nil && eventData.ProjectID != "" {
		segBytes, err := json.Marshal(eventData.Segment)
		if err != nil {
			return
		}
		var segment types.FeatureSegment
		if err := json.Unmarshal(segBytes, &segment); err != nil {
			return
		}
		sdk.FeatureFlag.UpdateSegmentInCache(segment, eventData.ProjectID)
	}
}

// Ensure time is used
var _ = time.Now
