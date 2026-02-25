using Microsoft.Extensions.Logging;
using Gatrix.Server.Sdk.Models;

namespace Gatrix.Server.Sdk.Cache;

public partial class CacheManager
{
    /// <summary>Initialize all services by loading data from local storage.</summary>
    public async Task InitializeAsync(CancellationToken ct = default)
    {
        try
        {
            var environments = await GetTargetEnvironmentsAsync(ct);
            var tasks = environments.Select(env => InitializeForEnvironmentAsync(env, ct));
            await Task.WhenAll(tasks);
            _logger.LogDebug("Cache initialization completed for {Count} environment(s)", environments.Count);
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

        if (features.FeatureFlag) tasks.Add(_featureFlag.InitializeAsync(env, ct));
        if (features.GameWorld && _gameWorld is BaseEnvironmentService<Models.GameWorld, Models.GameWorldListResponse> gw) tasks.Add(gw.InitializeAsync(env, ct));
        if (features.PopupNotice && _popupNotice is BaseEnvironmentService<Models.PopupNotice, Models.PopupNoticeListResponse> pn) tasks.Add(pn.InitializeAsync(env, ct));
        if (features.Survey && _survey is BaseEnvironmentService<Models.Survey, Models.SurveyListResponse> sv) tasks.Add(sv.InitializeAsync(env, ct));
        if (features.Whitelist && _whitelist is BaseEnvironmentService<Models.Whitelist, Models.WhitelistListResponse> wl) tasks.Add(wl.InitializeAsync(env, ct));
        if (features.ServiceMaintenance && _serviceMaintenance is BaseEnvironmentService<Models.ServiceMaintenance, Models.ServiceMaintenanceListResponse> sm) tasks.Add(sm.InitializeAsync(env, ct));
        if (features.StoreProduct && _storeProduct is BaseEnvironmentService<Models.StoreProduct, Models.StoreProductListResponse> sp) tasks.Add(sp.InitializeAsync(env, ct));
        if (features.ClientVersion && _clientVersion is BaseEnvironmentService<Models.ClientVersion, Models.ClientVersionListResponse> cv) tasks.Add(cv.InitializeAsync(env, ct));
        if (features.ServiceNotice && _serviceNotice is BaseEnvironmentService<Models.ServiceNotice, Models.ServiceNoticeListResponse> sn) tasks.Add(sn.InitializeAsync(env, ct));
        if (features.Banner && _banner is BaseEnvironmentService<Models.Banner, Models.BannerListResponse> bn) tasks.Add(bn.InitializeAsync(env, ct));

        await Task.WhenAll(tasks);
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

            var tasks = new List<Task>();
            foreach (var env in environments)
            {
                tasks.Add(RefreshForEnvironmentAsync(env, ct));
            }
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

        if (features.FeatureFlag) tasks.Add(_featureFlag.FetchAsync(env, ct));
        if (features.GameWorld) tasks.Add(_gameWorld.FetchAsync(env, ct));
        if (features.PopupNotice) tasks.Add(_popupNotice.FetchAsync(env, ct));
        if (features.Survey) tasks.Add(_survey.FetchAsync(env, ct));
        if (features.Whitelist) tasks.Add(_whitelist.FetchAsync(env, ct));
        if (features.ServiceMaintenance) tasks.Add(_serviceMaintenance.FetchAsync(env, ct));
        if (features.StoreProduct) tasks.Add(_storeProduct.FetchAsync(env, ct));
        if (features.ClientVersion) tasks.Add(_clientVersion.FetchAsync(env, ct));
        if (features.ServiceNotice) tasks.Add(_serviceNotice.FetchAsync(env, ct));
        if (features.Banner) tasks.Add(_banner.FetchAsync(env, ct));

        await Task.WhenAll(tasks);
    }

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
            try
            {
                var response = await _apiClient.GetAsync<EnvironmentListResponse>(
                    "/api/v1/server/internal/environments", etag: null, ct: ct);

                if (response.Success && response.Data?.Environments is { Count: > 0 })
                {
                    var envNames = response.Data.Environments
                        .Select(e => e.Environment)
                        .ToList();
                    _logger.LogInformation("Wildcard mode: resolved {Count} environments from backend",
                        envNames.Count);
                    return envNames;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to fetch environment list from backend");
            }

            return [];
        }

        return _options.Environments!
            .Where(e => e != "*")
            .ToList();
    }
}
