// File-based storage provider for Gatrix Unity Client SDK
// Stores data in Unity's Application.persistentDataPath

using System.IO;
using System.Text;
using System.Threading;
using Cysharp.Threading.Tasks;
using UnityEngine;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// File-based storage provider that saves to Application.persistentDataPath.
    /// More reliable than PlayerPrefs for larger data and survives app reinstalls on some platforms.
    /// File I/O is performed asynchronously via UniTask.RunOnThreadPool to avoid blocking the main thread.
    /// On WebGL (single-threaded), operations fall back to synchronous execution.
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

        public async UniTask<string> GetAsync(string key)
        {
            var path = GetFilePath(key);
            if (!File.Exists(path))
            {
                return null;
            }

#if UNITY_WEBGL && !UNITY_EDITOR
            // WebGL does not support threads — use synchronous read
            return File.ReadAllText(path);
#else
            return await UniTask.RunOnThreadPool(() => File.ReadAllText(path));
#endif
        }

        public async UniTask SaveAsync(string key, string value)
        {
            var path = GetFilePath(key);

#if UNITY_WEBGL && !UNITY_EDITOR
            // WebGL does not support threads — use synchronous write
            File.WriteAllText(path, value);
#else
            var bytes = Encoding.UTF8.GetBytes(value);
            await UniTask.RunOnThreadPool(async () =>
            {
                using (var stream = new FileStream(
                    path, FileMode.Create, FileAccess.Write, FileShare.None,
                    bufferSize: 4096, useAsync: true))
                {
                    await stream.WriteAsync(bytes, 0, bytes.Length, CancellationToken.None);
                }
            });
#endif
        }

        public async UniTask DeleteAsync(string key)
        {
            var path = GetFilePath(key);

#if UNITY_WEBGL && !UNITY_EDITOR
            if (File.Exists(path)) File.Delete(path);
#else
            await UniTask.RunOnThreadPool(() =>
            {
                if (File.Exists(path)) File.Delete(path);
            });
#endif
        }

        private string GetFilePath(string key)
        {
            // Sanitize key for file system
            var safeKey = key.Replace('/', '_').Replace('\\', '_').Replace(':', '_');
            return Path.Combine(_directory, safeKey + ".dat");
        }
    }
}
