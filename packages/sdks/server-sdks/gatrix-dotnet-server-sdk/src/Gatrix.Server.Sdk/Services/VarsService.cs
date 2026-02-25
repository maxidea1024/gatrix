using System.Text.Json;
using Gatrix.Server.Sdk.Cache;
using Gatrix.Server.Sdk.Client;
using Gatrix.Server.Sdk.Models;
using Microsoft.Extensions.Logging;

namespace Gatrix.Server.Sdk.Services;

/// <summary>
/// Service for handling KV settings (Vars) and caching.
/// </summary>
public class VarsService : BaseEnvironmentService<VarItem, List<VarItem>>, IVarsService
{
    public VarsService(GatrixApiClient apiClient, ILogger logger, ICacheStorageProvider? storage = null)
        : base(apiClient, logger, storage)
    {
    }

    protected override string GetEndpoint(string environment) => 
        $"/api/v1/server/{Uri.EscapeDataString(environment)}/vars";

    protected override List<VarItem> ExtractItems(List<VarItem> response) => 
        response;

    protected override string ServiceName => "vars";

    protected override object GetItemId(VarItem item) => item.VarKey;

    public Task<List<VarItem>> FetchAsync(string environment, CancellationToken ct = default) =>
        FetchByEnvironmentAsync(environment, ct);

    /// <summary>
    /// Get a variable value by key from cache.
    /// </summary>
    public string? GetValue(string key, string environment)
    {
        var items = GetCached(environment);
        return items.Find(i => i.VarKey == key)?.VarValue;
    }

    /// <summary>
    /// Get a variable value parsed as JSON.
    /// </summary>
    public T? GetParsedValue<T>(string key, string environment, JsonSerializerOptions? options = null)
    {
        var value = GetValue(key, environment);
        if (string.IsNullOrEmpty(value)) return default;

        try
        {
            var item = GetCached(environment).Find(i => i.VarKey == key);
            if (item != null && (item.ValueType == "object" || item.ValueType == "array"))
            {
                return JsonSerializer.Deserialize<T>(value, options);
            }
            
            // If it's not marked as object/array but we want to try parsing anyway (primitive fallback)
            if (typeof(T) == typeof(string)) return (T)(object)value;
            return JsonSerializer.Deserialize<T>(value, options);
        }
        catch (Exception ex)
        {
            Logger.LogWarning(ex, "Failed to parse KV value for key: {Key} in {Environment}", key, environment);
            return default;
        }
    }
}
