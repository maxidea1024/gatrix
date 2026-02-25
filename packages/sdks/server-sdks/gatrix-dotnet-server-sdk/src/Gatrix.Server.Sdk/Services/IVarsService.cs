using Gatrix.Server.Sdk.Models;

namespace Gatrix.Server.Sdk.Services;

public interface IVarsService
{
    Task InitializeAsync(string environment, CancellationToken ct = default);
    Task<List<VarItem>> FetchAsync(string environment, CancellationToken ct = default);
    Task<List<VarItem>> FetchByEnvironmentAsync(string environment, CancellationToken ct = default);
    List<VarItem> GetCached(string environment);
    string? GetValue(string key, string environment);
    T? GetParsedValue<T>(string key, string environment, System.Text.Json.JsonSerializerOptions? options = null);
    void UpdateCache(List<VarItem> items, string environment);
    void ClearCache();
}
