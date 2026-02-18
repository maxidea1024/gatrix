// File-based storage provider for Gatrix Unity Client SDK
// Stores data in Unity's Application.persistentDataPath

using System.IO;
using System.Threading.Tasks;
using UnityEngine;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// File-based storage provider that saves to Application.persistentDataPath.
    /// More reliable than PlayerPrefs for larger data and survives app reinstalls on some platforms.
    /// All operations are synchronous so ValueTask avoids heap allocation entirely.
    /// </summary>
    public class FileStorageProvider : IStorageProvider
    {
        private readonly string _directory;

        /// <param name="subdirectory">Subdirectory under persistentDataPath (default: "gatrix")</param>
        public FileStorageProvider(string subdirectory = "gatrix")
        {
            _directory = Path.Combine(Application.persistentDataPath, subdirectory);
            if (!Directory.Exists(_directory))
            {
                Directory.CreateDirectory(_directory);
            }
        }

        public ValueTask<string> GetAsync(string key)
        {
            var path = GetFilePath(key);
            if (!File.Exists(path))
            {
                return new ValueTask<string>((string)null);
            }

            var value = File.ReadAllText(path);
            return new ValueTask<string>(value);
        }

        public ValueTask SaveAsync(string key, string value)
        {
            var path = GetFilePath(key);
            File.WriteAllText(path, value);
            return default;
        }

        public ValueTask DeleteAsync(string key)
        {
            var path = GetFilePath(key);
            if (File.Exists(path))
            {
                File.Delete(path);
            }
            return default;
        }

        private string GetFilePath(string key)
        {
            // Sanitize key for file system
            var safeKey = key.Replace('/', '_').Replace('\\', '_').Replace(':', '_');
            return Path.Combine(_directory, safeKey + ".dat");
        }
    }
}
