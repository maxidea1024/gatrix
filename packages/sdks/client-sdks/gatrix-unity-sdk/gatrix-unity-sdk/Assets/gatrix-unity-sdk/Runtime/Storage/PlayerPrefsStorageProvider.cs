// PlayerPrefs-based storage provider for Gatrix Unity Client SDK

using System.Threading.Tasks;
using UnityEngine;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Storage provider using Unity's PlayerPrefs for persistent storage.
    /// All operations are synchronous so ValueTask avoids heap allocation entirely.
    /// </summary>
    public class PlayerPrefsStorageProvider : IStorageProvider
    {
        private readonly string _prefix;

        /// <param name="prefix">Key prefix to avoid collisions (default: "gatrix_")</param>
        public PlayerPrefsStorageProvider(string prefix = "gatrix_")
        {
            _prefix = prefix;
        }

        public ValueTask<string> GetAsync(string key)
        {
            var fullKey = _prefix + key;
            var value = PlayerPrefs.HasKey(fullKey) ? PlayerPrefs.GetString(fullKey) : null;
            return new ValueTask<string>(value);
        }

        public ValueTask SaveAsync(string key, string value)
        {
            var fullKey = _prefix + key;
            PlayerPrefs.SetString(fullKey, value);
            PlayerPrefs.Save();
            return default;
        }

        public ValueTask DeleteAsync(string key)
        {
            var fullKey = _prefix + key;
            PlayerPrefs.DeleteKey(fullKey);
            PlayerPrefs.Save();
            return default;
        }
    }
}
