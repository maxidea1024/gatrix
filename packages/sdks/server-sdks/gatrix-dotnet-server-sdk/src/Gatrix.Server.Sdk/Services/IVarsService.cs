using Gatrix.Server.Sdk.Models;

namespace Gatrix.Server.Sdk.Services;

public interface IVarsService
{
    Task InitializeAsync(string environmentId, CancellationToken ct = default);
    Task<List<VarItem>> FetchAsync(string environmentId, CancellationToken ct = default);
    Task<List<VarItem>> FetchByEnvironmentAsync(string environmentId, CancellationToken ct = default);
    List<VarItem> GetCached(string environmentId);
    string? GetValue(string key, string environmentId);
    T? GetParsedValue<T>(string key, string environmentId, System.Text.Json.JsonSerializerOptions? options = null);
    void UpdateCache(List<VarItem> items, string environmentId);
    void ClearCache();
}
