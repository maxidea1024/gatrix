using System.Text.Json.Serialization;

namespace Gatrix.Server.Sdk.Models;

public class WhitelistData
{
    [JsonPropertyName("ipWhitelist")] public IpWhitelist IpWhitelist { get; set; } = new();
    [JsonPropertyName("accountWhitelist")] public AccountWhitelist AccountWhitelist { get; set; } = new();
}

public class IpWhitelist
{
    [JsonPropertyName("enabled")] public bool Enabled { get; set; }
    [JsonPropertyName("ips")] public List<string> Ips { get; set; } = [];
}

public class AccountWhitelist
{
    [JsonPropertyName("enabled")] public bool Enabled { get; set; }
    [JsonPropertyName("accountIds")] public List<string> AccountIds { get; set; } = [];
}
