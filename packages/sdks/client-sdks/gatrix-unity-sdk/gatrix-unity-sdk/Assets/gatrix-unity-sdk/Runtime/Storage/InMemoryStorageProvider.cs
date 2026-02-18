// In-memory storage provider for Gatrix Unity Client SDK

using System.Collections.Generic;
using System.Threading.Tasks;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// In-memory storage provider (no persistence across sessions).
    /// Useful for testing or when persistence is not needed.
    /// All operations are synchronous so ValueTask avoids heap allocation entirely.
    /// </summary>
    public class InMemoryStorageProvider : IStorageProvider
    {
        private readonly Dictionary<string, string> _store = new Dictionary<string, string>();

        public ValueTask<string> GetAsync(string key)
        {
            _store.TryGetValue(key, out var value);
            return new ValueTask<string>(value);
        }

        public ValueTask SaveAsync(string key, string value)
        {
            _store[key] = value;
            return default;
        }

        public ValueTask DeleteAsync(string key)
        {
            _store.Remove(key);
            return default;
        }
    }
}
