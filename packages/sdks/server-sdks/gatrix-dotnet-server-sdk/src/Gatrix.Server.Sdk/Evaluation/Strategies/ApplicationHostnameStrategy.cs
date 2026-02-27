namespace Gatrix.Server.Sdk.Evaluation.Strategies;

/// <summary>
/// Application hostname strategy — enables for specific hostnames.
/// </summary>
public class ApplicationHostnameStrategy : IStrategy
{
    public string Name => "applicationHostname";

    public bool IsEnabled(Models.StrategyParameters? parameters, Models.EvaluationContext context, string flagName)
    {
        var hostNames = parameters?.HostNames;
        if (string.IsNullOrEmpty(hostNames)) return false;

        var currentHostname = System.Net.Dns.GetHostName();
        var hosts = hostNames.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
        return hosts.Contains(currentHostname, StringComparer.OrdinalIgnoreCase);
    }
}
