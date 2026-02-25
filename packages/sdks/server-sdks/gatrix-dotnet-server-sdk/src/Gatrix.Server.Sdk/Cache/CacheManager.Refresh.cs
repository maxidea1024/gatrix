using Microsoft.Extensions.Logging;
using Gatrix.Server.Sdk.Models;
using System.Text.Json;

namespace Gatrix.Server.Sdk.Cache;

public partial class CacheManager
{
    /// <summary>Initialize all services by loading data from local storage.</summary>
    public async Task InitializeAsync(CancellationToken ct = default)
    {
        try
        {
            // For wildcard mode, environments are resolved from backend or local cache
            var environments = await GetTargetEnvironmentsAsync(ct);
            
            if (environments.Count > 0)
            {
                var tasks = environments.Select(env => InitializeForEnvironmentAsync(env, ct));
                await Task.WhenAll(tasks);
                _logger.LogDebug("Cache initialization completed for {Count} environment(s)", environments.Count);
            }
            else
            {
                _logger.LogWarning("No environments resolved during initialization");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Cache initialization failed");
        }
    }

    private async Task InitializeForEnvironmentAsync(string env, CancellationToken ct)
    {
        var features = _options.Features;
        var tasks = new List<Task>();

        try
        {
            if (features.FeatureFlag) tasks.Add(_featureFlag.InitializeAsync(env, ct));
            if (features.GameWorld) tasks.Add(_gameWorld.InitializeAsync(env, ct));
            if (features.PopupNotice) tasks.Add(_popupNotice.InitializeAsync(env, ct));
            if (features.Survey) tasks.Add(_survey.InitializeAsync(env, ct));
            if (features.Whitelist) tasks.Add(_whitelist.InitializeAsync(env, ct));
            if (features.ServiceMaintenance) tasks.Add(_serviceMaintenance.InitializeAsync(env, ct));
            if (features.StoreProduct) tasks.Add(_storeProduct.InitializeAsync(env, ct));
            if (features.ClientVersion) tasks.Add(_clientVersion.InitializeAsync(env, ct));
            if (features.ServiceNotice) tasks.Add(_serviceNotice.InitializeAsync(env, ct));
            if (features.Banner) tasks.Add(_banner.InitializeAsync(env, ct));
            if (features.Vars) tasks.Add(_vars.InitializeAsync(env, ct));

            await Task.WhenAll(tasks);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to initialize some services for environment {Environment}", env);
        }
    }

    /// <summary>Manually trigger a full cache refresh for all target environments.</summary>
    public async Task RefreshAsync(CancellationToken ct = default)
    {
        try
        {
            var environments = await GetTargetEnvironmentsAsync(ct);

            if (environments.Count == 0)
            {
                _logger.LogWarning("No target environments resolved — skipping cache refresh");
                return;
            }

            var tasks = environments.Select(env => RefreshForEnvironmentAsync(env, ct));
            await Task.WhenAll(tasks);

            _logger.LogDebug("Cache refresh completed for {Count} environment(s)", environments.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Cache refresh failed — serving stale data");
        }
    }

    /// <summary>Refresh all enabled services for a single environment.</summary>
    private async Task RefreshForEnvironmentAsync(string env, CancellationToken ct)
    {
        var features = _options.Features;
        var tasks = new List<Task>();

        // Wrap each task with a catch to prevent one service failure from breaking everything
        async Task RunSafe(string serviceName, Func<Task> action)
        {
            try { await action(); }
            catch (Exception ex) { _logger.LogWarning(ex, "Failed to refresh {Service} for {Environment}", serviceName, env); }
        }

        if (features.FeatureFlag) tasks.Add(RunSafe("FeatureFlag", () => _featureFlag.FetchAsync(env, ct)));
        if (features.GameWorld) tasks.Add(RunSafe("GameWorld", () => _gameWorld.FetchAsync(env, ct)));
        if (features.PopupNotice) tasks.Add(RunSafe("PopupNotice", () => _popupNotice.FetchAsync(env, ct)));
        if (features.Survey) tasks.Add(RunSafe("Survey", () => _survey.FetchAsync(env, ct)));
        if (features.Whitelist) tasks.Add(RunSafe("Whitelist", () => _whitelist.FetchAsync(env, ct)));
        if (features.ServiceMaintenance) tasks.Add(RunSafe("ServiceMaintenance", () => _serviceMaintenance.FetchAsync(env, ct)));
        if (features.StoreProduct) tasks.Add(RunSafe("StoreProduct", () => _storeProduct.FetchAsync(env, ct)));
        if (features.ClientVersion) tasks.Add(RunSafe("ClientVersion", () => _clientVersion.FetchAsync(env, ct)));
        if (features.ServiceNotice) tasks.Add(RunSafe("ServiceNotice", () => _serviceNotice.FetchAsync(env, ct)));
        if (features.Banner) tasks.Add(RunSafe("Banner", () => _banner.FetchAsync(env, ct)));
        if (features.Vars) tasks.Add(RunSafe("Vars", () => _vars.FetchByEnvironmentAsync(env, ct)));

        await Task.WhenAll(tasks);
    }

    /// <summary>Refresh ONLY feature flags (flags + segments) for a specific environment.</summary>
    public async Task RefreshFeatureFlagsAsync(string? environment = null, CancellationToken ct = default)
    {
        var env = environment ?? _options.Environment;
        if (_options.Features.FeatureFlag)
        {
            await _featureFlag.FetchAsync(env, ct);
        }
    }

    /// <summary>Refresh ONLY vars for a specific environment.</summary>
    public async Task RefreshVarsAsync(string environment, CancellationToken ct = default)
    {
        if (_options.Features.Vars)
        {
            await _vars.FetchByEnvironmentAsync(environment, ct);
        }
    }

    private List<string>? _cachedWildcardEnvironments;
    private const string WildcardEnvironmentsCacheKey = "wildcard_environments_list";

    /// <summary>
    /// Resolve target environments based on configuration.
    /// </summary>
    private async Task<List<string>> GetTargetEnvironmentsAsync(CancellationToken ct)
    {
        if (!_options.IsMultiEnvironmentMode)
        {
            return [_options.Environment];
        }

        if (_options.IsWildcardMode)
        {
            // 1. Try to load from local storage first if memory is empty
            if (_cachedWildcardEnvironments == null && _storage != null)
            {
                try
                {
                    var cachedJson = await _storage.GetAsync(WildcardEnvironmentsCacheKey, ct);
                    if (!string.IsNullOrEmpty(cachedJson))
                    {
                        _cachedWildcardEnvironments = JsonSerializer.Deserialize<List<string>>(cachedJson);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to load wildcard environments from local storage");
                }
            }

            // 2. Try to fetch fresh list from backend
            try
            {
                var response = await _apiClient.GetAsync<EnvironmentListResponse>(
                    "/api/v1/server/internal/environments", etag: null, ct: ct);

                if (response.Success && response.Data?.Environments is { Count: > 0 })
                {
                    var envNames = response.Data.Environments
                        .Select(e => e.Environment)
                        .ToList();
                    
                    _cachedWildcardEnvironments = envNames;

                    // Persist to local storage
                    if (_storage != null)
                    {
                        var json = JsonSerializer.Serialize(envNames);
                        await _storage.SaveAsync(WildcardEnvironmentsCacheKey, json, ct);
                    }

                    _logger.LogInformation("Wildcard mode: resolved {Count} environments from backend",
                        envNames.Count);
                    return envNames;
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to fetch environment list from backend — using local cache if available");
            }

            return _cachedWildcardEnvironments ?? [];
        }

        return _options.Environments!
            .Where(e => e != "*")
            .ToList();
    }
}
