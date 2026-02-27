using Gatrix.Server.Sdk.Models;

namespace Gatrix.Server.Sdk.Cache;

/// <summary>
/// Thread-safe in-memory cache for feature flag definitions and segments.
/// Supports per-environment storage for multi-environment mode.
/// Environment must always be resolved by the caller (FeatureFlagService.ResolveEnvironment).
/// </summary>
public class FlagDefinitionCache
{
    private readonly object _lock = new();

    // Per-environment flag cache
    private readonly Dictionary<string, Dictionary<string, FeatureFlag>> _flagsByEnv = new(StringComparer.OrdinalIgnoreCase);

    // Segments are global (shared across environments)
    private Dictionary<string, FeatureSegment> _segments = new(StringComparer.OrdinalIgnoreCase);

    /// <summary>Get a flag definition by name for a specific environment.</summary>
    public FeatureFlag? GetFlag(string flagName, string environment)
    {
        lock (_lock)
        {
            if (_flagsByEnv.TryGetValue(environment, out var flags))
                return flags.GetValueOrDefault(flagName);

            return null;
        }
    }

    /// <summary>Get all cached flags for a specific environment (readonly snapshot).</summary>
    public List<FeatureFlag> GetCached(string environment)
    {
        lock (_lock)
        {
            if (_flagsByEnv.TryGetValue(environment, out var flags))
                return flags.Values.ToList();

            return [];
        }
    }

    /// <summary>Get all cached segments (readonly snapshot).</summary>
    public IReadOnlyDictionary<string, FeatureSegment> GetSegments()
    {
        lock (_lock)
        {
            return new Dictionary<string, FeatureSegment>(_segments, StringComparer.OrdinalIgnoreCase);
        }
    }

    /// <summary>Replace entire cache atomically with new definitions and segments for a specific environment.</summary>
    public void Update(IEnumerable<FeatureFlag> flags, IEnumerable<FeatureSegment> segments, string environment)
    {
        var newFlags = new Dictionary<string, FeatureFlag>(StringComparer.OrdinalIgnoreCase);
        foreach (var flag in flags)
            newFlags[flag.Name] = flag;

        var newSegments = new Dictionary<string, FeatureSegment>(StringComparer.OrdinalIgnoreCase);
        foreach (var segment in segments)
            newSegments[segment.Name] = segment;

        lock (_lock)
        {
            _flagsByEnv[environment] = newFlags;
            // Segments are merged globally (all environments share segments)
            foreach (var kvp in newSegments)
                _segments[kvp.Key] = kvp.Value;
        }
    }

    /// <summary>Upsert a single flag in a specific environment.</summary>
    public void UpsertFlag(FeatureFlag flag, string environment)
    {
        lock (_lock)
        {
            if (!_flagsByEnv.TryGetValue(environment, out var flags))
            {
                flags = new Dictionary<string, FeatureFlag>(StringComparer.OrdinalIgnoreCase);
                _flagsByEnv[environment] = flags;
            }
            flags[flag.Name] = flag;
        }
    }

    /// <summary>Remove a single flag by name from a specific environment.</summary>
    public void RemoveFlag(string flagName, string environment)
    {
        lock (_lock)
        {
            if (_flagsByEnv.TryGetValue(environment, out var flags))
                flags.Remove(flagName);
        }
    }

    /// <summary>Upsert a single segment (global, not per-environment).</summary>
    public void UpsertSegment(FeatureSegment segment)
    {
        lock (_lock)
        {
            _segments[segment.Name] = segment;
        }
    }

    /// <summary>Remove a single segment by name.</summary>
    public void RemoveSegment(string segmentName)
    {
        lock (_lock)
        {
            _segments.Remove(segmentName);
        }
    }

    public int FlagCount
    {
        get
        {
            lock (_lock)
            {
                return _flagsByEnv.Values.Sum(f => f.Count);
            }
        }
    }

    public void Clear()
    {
        lock (_lock)
        {
            _flagsByEnv.Clear();
            _segments.Clear();
        }
    }
}
