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
        return Hash(key.AsSpan(), seed);
    }

    /// <summary>
    /// Compute MurmurHash3 32-bit hash of a ReadOnlySpan<char> with a given seed without allocating strings.
    /// </summary>
    public static uint Hash(ReadOnlySpan<char> key, uint seed = 0)
    {
        int maxByteCount = Encoding.UTF8.GetMaxByteCount(key.Length);
        byte[]? rented = null;
        Span<byte> utf8Bytes = maxByteCount <= 512 
            ? stackalloc byte[maxByteCount] 
            : (rented = System.Buffers.ArrayPool<byte>.Shared.Rent(maxByteCount));

        try
        {
            int bytesWritten = Encoding.UTF8.GetBytes(key, utf8Bytes);
            using var algorithm = MurmurHash.Create32(seed);

            Span<byte> hashBytes = stackalloc byte[4];
            if (algorithm.TryComputeHash(utf8Bytes[..bytesWritten], hashBytes, out _))
            {
                return BitConverter.ToUInt32(hashBytes);
            }
            // Fallback just in case
            return BitConverter.ToUInt32(algorithm.ComputeHash(utf8Bytes[..bytesWritten].ToArray()));
        }
        finally
        {
            if (rented != null)
                System.Buffers.ArrayPool<byte>.Shared.Return(rented);
        }
    }
}
