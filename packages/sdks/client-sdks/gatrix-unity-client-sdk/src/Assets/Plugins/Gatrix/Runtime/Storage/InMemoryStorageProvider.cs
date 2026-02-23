// In-memory storage provider for Gatrix Unity Client SDK

using System.Collections.Generic;
using Cysharp.Threading.Tasks;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// In-memory storage provider (no persistence across sessions).
    /// Useful for testing or when persistence is not needed.
    /// All operations are synchronous; UniTask wraps results efficiently.
    /// </summary>
    public class InMemoryStorageProvider : IStorageProvider
    {
        private readonly Dictionary<string, string> _store = new Dictionary<string, string>();

        public UniTask<string> GetAsync(string key)
        {
            _store.TryGetValue(key, out var value);
            return UniTask.FromResult(value);
        }

        public UniTask SaveAsync(string key, string value)
        {
            _store[key] = value;
            return UniTask.CompletedTask;
        }

        public UniTask DeleteAsync(string key)
        {
            _store.Remove(key);
            return UniTask.CompletedTask;
        }
    }
}
