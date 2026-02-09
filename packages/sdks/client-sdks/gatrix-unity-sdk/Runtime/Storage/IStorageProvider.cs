// Storage Provider Interface for Gatrix Unity Client SDK

using System.Threading.Tasks;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Interface for persistent storage.
    /// Implementations can use Unity PlayerPrefs, file system, or in-memory storage.
    /// Uses ValueTask for zero-allocation on synchronous paths.
    /// </summary>
    public interface IStorageProvider
    {
        /// <summary>Get a value from storage by key</summary>
        ValueTask<string> GetAsync(string key);

        /// <summary>Save a value to storage by key</summary>
        ValueTask SaveAsync(string key, string value);

        /// <summary>Delete a value from storage by key</summary>
        ValueTask DeleteAsync(string key);
    }
}
