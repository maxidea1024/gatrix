using Microsoft.Extensions.Logging;

namespace Gatrix.Server.Sdk.Cache;

/// <summary>
/// Basic file-based implementation of ICacheStorageProvider.
/// Stores data in a hidden folder within the application directory or a configured path.
/// </summary>
public class FileCacheStorageProvider : ICacheStorageProvider
{
    private readonly string _storageDir;
    private readonly ILogger<FileCacheStorageProvider> _logger;

    public FileCacheStorageProvider(ILogger<FileCacheStorageProvider> logger, string? storagePath = null)
    {
        _logger = logger;
        
        // Default to .gatrix_cache folder in the current execution directory
        _storageDir = storagePath ?? Path.Combine(AppDomain.CurrentDomain.BaseDirectory, ".gatrix_cache");

        try
        {
            if (!Directory.Exists(_storageDir))
            {
                Directory.CreateDirectory(_storageDir);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to initialize cache storage directory at {Path}", _storageDir);
        }
    }

    public async Task SaveAsync(string key, string value, CancellationToken ct = default)
    {
        try
        {
            var filePath = GetFilePath(key);
            await File.WriteAllTextAsync(filePath, value, ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to save cache key {Key} to file", key);
        }
    }

    public async Task<string?> GetAsync(string key, CancellationToken ct = default)
    {
        try
        {
            var filePath = GetFilePath(key);
            if (!File.Exists(filePath)) return null;
            return await File.ReadAllTextAsync(filePath, ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to read cache key {Key} from file", key);
            return null;
        }
    }

    public Task<bool> ExistsAsync(string key, CancellationToken ct = default)
    {
        return Task.FromResult(File.Exists(GetFilePath(key)));
    }

    public Task RemoveAsync(string key, CancellationToken ct = default)
    {
        try
        {
            var filePath = GetFilePath(key);
            if (File.Exists(filePath))
            {
                File.Delete(filePath);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to remove cache key {Key}", key);
        }
        return Task.CompletedTask;
    }

    private string GetFilePath(string key)
    {
        // Sanitize key for filename
        var safeKey = string.Concat(key.Select(c => Path.GetInvalidFileNameChars().Contains(c) ? '_' : c));
        return Path.Combine(_storageDir, safeKey + ".cache");
    }
}
