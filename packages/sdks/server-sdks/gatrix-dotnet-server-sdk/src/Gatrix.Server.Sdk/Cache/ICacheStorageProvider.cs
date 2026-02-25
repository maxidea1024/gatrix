namespace Gatrix.Server.Sdk.Cache;

/// <summary>
/// Interface for persisting cached data to a non-volatile storage (e.g., file system).
/// </summary>
public interface ICacheStorageProvider
{
    /// <summary>Save a string value to storage.</summary>
    Task SaveAsync(string key, string value, CancellationToken ct = default);

    /// <summary>Get a string value from storage. Returns null if not found.</summary>
    Task<string?> GetAsync(string key, CancellationToken ct = default);

    /// <summary>Check if a key exists in storage.</summary>
    Task<bool> ExistsAsync(string key, CancellationToken ct = default);

    /// <summary>Remove a value from storage.</summary>
    Task RemoveAsync(string key, CancellationToken ct = default);
}
