// Storage Provider Interface for Gatrix Unity Client SDK

using Cysharp.Threading.Tasks;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Interface for persistent storage.
    /// Implementations can use Unity PlayerPrefs, file system, or in-memory storage.
    /// Uses UniTask for efficient async operations in Unity.
    /// </summary>
    public interface IStorageProvider
    {
        /// <summary>Get a value from storage by key</summary>
        UniTask<string> GetAsync(string key);

        /// <summary>Save a value to storage by key</summary>
        UniTask SaveAsync(string key, string value);

        /// <summary>Delete a value from storage by key</summary>
        UniTask DeleteAsync(string key);
    }
}
