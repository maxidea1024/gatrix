using Gatrix.ServerSDK.Client;
using Gatrix.ServerSDK.Types;
using Gatrix.ServerSDK.Utils;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Gatrix.ServerSDK.Extensions;

/// <summary>
/// Dependency injection extensions for GatrixServerSDK
/// </summary>
public static class ServiceCollectionExtensions
{
    /// <summary>
    /// Add GatrixServerSDK to dependency injection container
    /// </summary>
    public static IServiceCollection AddGatrixServerSDK(
        this IServiceCollection services,
        GatrixSDKConfig config)
    {
        // Register configuration
        services.AddSingleton(config);
        services.AddSingleton(config.Logger);
        services.AddSingleton(config.Cache);
        services.AddSingleton(config.Retry);

        // Register logger
        services.AddSingleton<GatrixLogger>();

        // Register HTTP client with base address
        services.AddHttpClient<ApiClient>()
            .ConfigureHttpClient(client =>
            {
                client.BaseAddress = new Uri(config.GatrixUrl);
                client.DefaultRequestHeaders.Add("Authorization", $"Bearer {config.ApiToken}");
                client.DefaultRequestHeaders.Add("X-Application-Name", config.ApplicationName);
            });

        // Register API client
        services.AddSingleton<ApiClient>();

        // Register SDK
        services.AddSingleton<GatrixServerSDK>(provider =>
        {
            var logger = provider.GetRequiredService<GatrixLogger>();
            var apiClient = provider.GetRequiredService<ApiClient>();
            return new GatrixServerSDK(config, logger, apiClient);
        });

        return services;
    }

    /// <summary>
    /// Add GatrixServerSDK with configuration action
    /// </summary>
    public static IServiceCollection AddGatrixServerSDK(
        this IServiceCollection services,
        Action<GatrixSDKConfig> configureOptions)
    {
        var config = new GatrixSDKConfig
        {
            GatrixUrl = "https://api.gatrix.com",
            ApiToken = "gatrix-unsecured-server-api-token",
            ApplicationName = "default"
        };

        configureOptions(config);

        return services.AddGatrixServerSDK(config);
    }
}

