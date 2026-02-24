using System.Text;
using Murmur;

namespace Gatrix.Server.Sdk.Evaluation;

/// <summary>
/// MurmurHash3 wrapper using the murmurhash NuGet package (darrenkopp).
/// Used for sticky rollout percentage calculation — must produce
/// identical results to the npm "murmurhash" v3 package used in @gatrix/shared.
/// </summary>
public static class MurmurHash3
{
    /// <summary>
    /// Compute MurmurHash3 32-bit hash of a string key with a given seed.
    /// Matches the npm murmurhash v3 package output.
    /// </summary>
    public static uint Hash(string key, uint seed = 0)
    {
        var algorithm = MurmurHash.Create32(seed);
        var bytes = Encoding.UTF8.GetBytes(key);
        var hashBytes = algorithm.ComputeHash(bytes);
        return BitConverter.ToUInt32(hashBytes, 0);
    }
}
