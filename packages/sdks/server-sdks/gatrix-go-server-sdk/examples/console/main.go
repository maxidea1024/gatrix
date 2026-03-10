package main

import (
	"fmt"
	"os"
	"os/signal"
	"syscall"

	gatrix "github.com/gatrix/gatrix-go-server-sdk"
	"github.com/gatrix/gatrix-go-server-sdk/types"
)

func main() {
	// 1. Create SDK instance
	sdk, err := gatrix.NewGatrixServerSDK(gatrix.GatrixSDKConfig{
		APIURL:          "http://localhost:45000",
		APIToken:        "unsecured-server-api-token",
		ApplicationName: "my-game-server",
		Service:         "world-server",
		Group:           "kr",
		Environment:     "your-environment-id",
		Cache: &gatrix.CacheConfig{
			TTL:           60,
			RefreshMethod: gatrix.RefreshMethodPolling,
		},
		Logger: &gatrix.LoggerConfig{
			Level: "info",
		},
		Uses: &gatrix.UsesConfig{
			FeatureFlag: gatrix.BoolPtrExported(true),
		},
	})
	if err != nil {
		fmt.Printf("Failed to create SDK: %v\n", err)
		os.Exit(1)
	}

	// 2. Initialize SDK (fetches all initial data, starts polling)
	if err := sdk.Initialize(); err != nil {
		fmt.Printf("Failed to initialize SDK: %v\n", err)
		os.Exit(1)
	}
	defer sdk.Shutdown()

	// 3. Register event listener
	sdk.On("feature_flag.changed", func(e types.SdkEvent) {
		fmt.Printf("Feature flag changed: %v\n", e.Data)
	})

	// 4. Evaluate feature flags
	ctx := &types.EvaluationContext{
		UserID:     "user-123",
		AppVersion: "1.2.3",
		Properties: map[string]interface{}{
			"plan":    "premium",
			"country": "KR",
		},
	}

	// IsEnabled
	isEnabled := sdk.FeatureFlag.IsEnabled("my-feature", false, ctx, "")
	fmt.Printf("my-feature enabled: %v\n", isEnabled)

	// StringVariation
	welcomeMsg := sdk.FeatureFlag.StringVariation("welcome-message", "Hello!", ctx, "")
	fmt.Printf("Welcome message: %s\n", welcomeMsg)

	// IntVariation
	maxRetries := sdk.FeatureFlag.IntVariation("max-retries", 3, ctx, "")
	fmt.Printf("Max retries: %d\n", maxRetries)

	// BoolVariation (returns variant value parsed as bool, NOT enabled state)
	darkMode := sdk.FeatureFlag.BoolVariation("dark-mode", false, ctx, "")
	fmt.Printf("Dark mode: %v\n", darkMode)

	// JsonVariation
	config := sdk.FeatureFlag.JsonVariation("app-config", map[string]interface{}{"theme": "light"}, ctx, "")
	fmt.Printf("App config: %v\n", config)

	// StringVariationDetails (includes evaluation metadata)
	detail := sdk.FeatureFlag.StringVariationDetails("welcome-message", "Hello!", ctx, "")
	fmt.Printf("Detail: value=%s, reason=%s, variant=%s\n", detail.Value, detail.Reason, detail.VariantName)

	// 5. Query game worlds
	worlds := sdk.GameWorld.GetAll("")
	fmt.Printf("Game worlds: %d\n", len(worlds))
	for _, w := range worlds {
		fmt.Printf("  World: %s (maintenance: %v)\n", w.Name, w.IsMaintenance)
	}

	// 6. Check maintenance
	isMaintenanceActive := sdk.ServiceMaintenance.IsActive("")
	fmt.Printf("Service maintenance active: %v\n", isMaintenanceActive)

	// 7. Check whitelist
	isIPAllowed := sdk.Whitelist.IsIPWhitelisted("192.168.1.100", "")
	fmt.Printf("IP whitelisted: %v\n", isIPAllowed)

	// 8. Impact metrics
	sdk.ImpactMetrics.DefineCounter("login_count", "Total login count")
	sdk.ImpactMetrics.IncrementCounter("login_count")

	sdk.ImpactMetrics.DefineHistogram("response_time", "API response time in ms", nil)
	sdk.ImpactMetrics.ObserveHistogram("response_time", 45.2)

	// 9. Wait for shutdown signal
	fmt.Println("\nSDK running. Press Ctrl+C to stop...")
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan

	fmt.Println("Shutting down...")
}
