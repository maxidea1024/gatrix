using Gatrix.Server.Sdk.Cache;
using Gatrix.Server.Sdk.Client;
using Gatrix.Server.Sdk.Context;
using Gatrix.Server.Sdk.Evaluation;
using Gatrix.Server.Sdk.Options;
using Gatrix.Server.Sdk.Services;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;

namespace Gatrix.Server.Sdk.DependencyInjection;

public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Register all Gatrix Server SDK services.
    /// </summary>
    public static IServiceCollection AddGatrixServerSdk(
        this IServiceCollection services,
        Action<GatrixSdkOptions> configureOptions)
    {
        // Bind options
        services.Configure(configureOptions);

        // Validate required options on first resolution
        services.AddSingleton<IValidateOptions<GatrixSdkOptions>, GatrixSdkOptionsValidator>();

        // HTTP client via IHttpClientFactory
        services.AddHttpClient(GatrixApiClient.HttpClientName)
            .ConfigureHttpClient((sp, client) =>
            {
                var options = sp.GetRequiredService<IOptions<GatrixSdkOptions>>().Value;
                client.BaseAddress = new Uri(options.ApiUrl);
            });

        // Core infrastructure (singletons)
        services.TryAddSingleton<GatrixApiClient>();
        services.TryAddSingleton<FlagDefinitionCache>();

        // Environment-aware services (singletons — they hold their own per-env caches)
        services.TryAddSingleton<IGameWorldService, GameWorldService>();
        services.TryAddSingleton<IPopupNoticeService, PopupNoticeService>();
        services.TryAddSingleton<ISurveyService, SurveyService>();
        services.TryAddSingleton<IWhitelistService, WhitelistService>();
        services.TryAddSingleton<IServiceMaintenanceService, ServiceMaintenanceService>();
        services.TryAddSingleton<IStoreProductService, StoreProductService>();
        services.TryAddSingleton<IServiceDiscoveryService, ServiceDiscoveryService>();
        services.TryAddSingleton<ICouponService, CouponService>();

        // Flag metrics (singleton — accumulates across requests)
        services.TryAddSingleton<FlagMetricsService>();

        // Redis Pub/Sub event listener (singleton — shared connection)
        services.TryAddSingleton<Events.EventListener>();

        // FeatureFlagService + GatrixServerSdk are Scoped (need scoped ambient context)
        services.TryAddScoped<GatrixAmbientContext>();
        services.TryAddScoped<IFeatureFlagService, FeatureFlagService>();
        services.TryAddScoped<IGatrixServerSdk, GatrixServerSdk>();

        // CacheManager as singleton + hosted service (background polling)
        // Registered via ICacheManager so EventListener can inject it cleanly.
        services.TryAddSingleton<ICacheManager, CacheManager>();
        services.AddHostedService<CacheManager>(sp => (CacheManager)sp.GetRequiredService<ICacheManager>());

        return services;
    }
}

/// <summary>
/// Validates required GatrixSdkOptions fields at startup.
/// </summary>
internal class GatrixSdkOptionsValidator : IValidateOptions<GatrixSdkOptions>
{
    public ValidateOptionsResult Validate(string? name, GatrixSdkOptions options)
    {
        if (string.IsNullOrWhiteSpace(options.ApiUrl))
            return ValidateOptionsResult.Fail("Gatrix:ApiUrl is required");
        if (string.IsNullOrWhiteSpace(options.ApiToken))
            return ValidateOptionsResult.Fail("Gatrix:ApiToken is required");
        if (string.IsNullOrWhiteSpace(options.ApplicationName))
            return ValidateOptionsResult.Fail("Gatrix:ApplicationName is required");
        if (string.IsNullOrWhiteSpace(options.Service))
            return ValidateOptionsResult.Fail("Gatrix:Service is required");
        if (string.IsNullOrWhiteSpace(options.Group))
            return ValidateOptionsResult.Fail("Gatrix:Group is required");
        if (string.IsNullOrWhiteSpace(options.Environment))
            return ValidateOptionsResult.Fail("Gatrix:Environment is required");

        return ValidateOptionsResult.Success;
    }
}
