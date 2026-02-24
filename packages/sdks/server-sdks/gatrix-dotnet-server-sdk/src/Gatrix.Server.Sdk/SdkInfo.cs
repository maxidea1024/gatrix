using System.Reflection;

namespace Gatrix.Server.Sdk;

/// <summary>
/// SDK version information, read from the assembly at runtime.
/// Version is managed via the .csproj VersionPrefix property.
/// </summary>
public static class SdkInfo
{
    public const string Name = "gatrix-dotnet-server-sdk";

    /// <summary>Assembly informational version (e.g., 1.0.0 or 1.0.0+commit).</summary>
    public static string Version { get; } = GetVersion();

    /// <summary>Full SDK identifier for HTTP headers and metrics (e.g., gatrix-dotnet-server-sdk/1.0.0).</summary>
    public static string FullName => $"{Name}/{Version}";

    private static string GetVersion()
    {
        var attr = typeof(SdkInfo).Assembly
            .GetCustomAttribute<AssemblyInformationalVersionAttribute>();
        if (attr?.InformationalVersion is { } ver)
        {
            // Strip the +commitHash suffix if present
            var plusIdx = ver.IndexOf('+');
            return plusIdx >= 0 ? ver[..plusIdx] : ver;
        }
        return typeof(SdkInfo).Assembly.GetName().Version?.ToString(3) ?? "0.0.0";
    }
}
