using System.Net;

namespace Gatrix.Server.Sdk.Evaluation.Strategies;

/// <summary>
/// Remote address strategy — enables for specific IP addresses/CIDR ranges.
/// </summary>
public class RemoteAddressStrategy : IStrategy
{
    public string Name => "remoteAddress";

    public bool IsEnabled(Models.StrategyParameters? parameters, Models.EvaluationContext context, string flagName)
    {
        var ips = parameters?.IPs;
        if (string.IsNullOrEmpty(ips)) return false;
        if (string.IsNullOrEmpty(context.RemoteAddress)) return false;

        var ranges = ips.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
        return IsIpInRanges(context.RemoteAddress, ranges);
    }

    /// <summary>
    /// Check if an IP address falls within any of the given ranges (exact match or CIDR).
    /// </summary>
    private static bool IsIpInRanges(string ipAddress, string[] ranges)
    {
        if (!IPAddress.TryParse(ipAddress, out var clientIp))
            return false;

        foreach (var range in ranges)
        {
            if (range.Contains('/'))
            {
                var parts = range.Split('/');
                if (parts.Length == 2 &&
                    IPAddress.TryParse(parts[0], out var networkIp) &&
                    int.TryParse(parts[1], out var prefixLength))
                {
                    if (IsInCidr(clientIp, networkIp, prefixLength))
                        return true;
                }
            }
            else
            {
                if (IPAddress.TryParse(range, out var exactIp) &&
                    clientIp.Equals(exactIp))
                    return true;
            }
        }
        return false;
    }

    /// <summary>
    /// Check if a client IP is within a CIDR range.
    /// </summary>
    private static bool IsInCidr(IPAddress clientIp, IPAddress networkIp, int prefixLength)
    {
        var clientBytes = clientIp.GetAddressBytes();
        var networkBytes = networkIp.GetAddressBytes();

        if (clientBytes.Length != networkBytes.Length)
            return false;

        var totalBits = clientBytes.Length * 8;
        if (prefixLength < 0 || prefixLength > totalBits)
            return false;

        for (int i = 0; i < clientBytes.Length; i++)
        {
            int bitsToCheck = Math.Min(8, Math.Max(0, prefixLength - i * 8));
            if (bitsToCheck <= 0) break;

            byte mask = (byte)(0xFF << (8 - bitsToCheck));
            if ((clientBytes[i] & mask) != (networkBytes[i] & mask))
                return false;
        }
        return true;
    }
}
