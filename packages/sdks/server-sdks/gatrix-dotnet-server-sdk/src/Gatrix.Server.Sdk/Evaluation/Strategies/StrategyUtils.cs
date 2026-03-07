using System.Globalization;
using Gatrix.Server.Sdk.Models;

namespace Gatrix.Server.Sdk.Evaluation.Strategies;

/// <summary>
/// Shared utility methods used by strategy implementations.
/// </summary>
internal static class StrategyUtils
{
    /// <summary>
    /// Extract a named value from the evaluation context.
    /// </summary>
    internal static object? GetContextValue(string name, EvaluationContext context)
    {
        return name switch
        {
            "userId" => context.UserId,
            "sessionId" => context.SessionId,
            "appName" => context.AppName,
            "appVersion" => context.AppVersion,
            "remoteAddress" => context.RemoteAddress,
            "environment" => context.Environment,
            "currentTime" => context.CurrentTime?.ToString("o"),
            _ => context.Properties.TryGetValue(name, out var val) ? val : null,
        };
    }

    /// <summary>
    /// Calculate normalized percentage (0.00-100.00) using MurmurHash3.
    /// Must produce identical results to @gatrix/shared normalizedStrategyValue().
    /// Both use MurmurHash3 with seed 0, formula: (hash % 10001) / 100.0
    /// </summary>
    internal static double CalculatePercentage(string stickinessValue, string groupId, string suffix = "")
    {
        int len = groupId.Length + suffix.Length + 1 + stickinessValue.Length;
        char[]? rented = null;
        Span<char> seedSpan = len <= 256
            ? stackalloc char[len]
            : (rented = System.Buffers.ArrayPool<char>.Shared.Rent(len));

        try
        {
            groupId.AsSpan().CopyTo(seedSpan);
            if (suffix.Length > 0)
            {
                suffix.AsSpan().CopyTo(seedSpan[groupId.Length..]);
            }
            seedSpan[groupId.Length + suffix.Length] = ':';
            stickinessValue.AsSpan().CopyTo(seedSpan[(groupId.Length + suffix.Length + 1)..]);

            var hash = MurmurHash3.Hash(seedSpan[..len]);
            return (hash % 10001) / 100.0;
        }
        finally
        {
            if (rented != null)
                System.Buffers.ArrayPool<char>.Shared.Return(rented);
        }
    }
}
