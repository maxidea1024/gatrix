// PlayerPrefs-based storage provider for Gatrix Unity Client SDK

using Cysharp.Threading.Tasks;
using UnityEngine;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Storage provider using Unity's PlayerPrefs for persistent storage.
    /// All operations are synchronous; UniTask wraps results efficiently.
    /// </summary>
    public class PlayerPrefsStorageProvider : IStorageProvider
    {
        private readonly string _prefix;

        /// <param name="prefix">Key prefix to avoid collisions (default: "gatrix_")</param>
        public PlayerPrefsStorageProvider(string prefix = "gatrix_")
        {
            _prefix = prefix;
        }

        public UniTask<string> GetAsync(string key)
        {
            var fullKey = _prefix + key;
            var value = PlayerPrefs.HasKey(fullKey) ? PlayerPrefs.GetString(fullKey) : null;
            return UniTask.FromResult(value);
        }

        public UniTask SaveAsync(string key, string value)
        {
            var fullKey = _prefix + key;
            PlayerPrefs.SetString(fullKey, value);
            PlayerPrefs.Save();
            return UniTask.CompletedTask;
        }

        public UniTask DeleteAsync(string key)
        {
            var fullKey = _prefix + key;
            PlayerPrefs.DeleteKey(fullKey);
            PlayerPrefs.Save();
            return UniTask.CompletedTask;
        }
    }
}
