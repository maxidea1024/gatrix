using Gatrix.Server.Sdk.Models;

namespace Gatrix.Server.Sdk.Evaluation.Strategies;

/// <summary>
/// Registry of all built-in activation strategies.
/// Mirrors the TypeScript strategy registry in @gatrix/shared.
/// </summary>
public static class StrategyRegistry
{
    private static readonly Dictionary<string, IStrategy> _strategies = new(StringComparer.Ordinal);

    static StrategyRegistry()
    {
        Register(new DefaultStrategy());
        Register(new FlexibleRolloutStrategy());
        Register(new UserWithIdStrategy());
        Register(new GradualRolloutUserIdStrategy());
        Register(new GradualRolloutRandomStrategy());
        Register(new GradualRolloutSessionIdStrategy());
        Register(new RemoteAddressStrategy());
        Register(new ApplicationHostnameStrategy());
    }

    private static void Register(IStrategy strategy)
    {
        _strategies[strategy.Name] = strategy;
    }

    /// <summary>
    /// Get strategy by name. Returns null if not found.
    /// </summary>
    public static IStrategy? GetStrategy(string name)
    {
        return _strategies.TryGetValue(name, out var strategy) ? strategy : null;
    }

    /// <summary>
    /// Evaluate a strategy's IsEnabled.
    /// Returns false if strategy is unknown (fail-safe).
    /// </summary>
    public static bool EvaluateStrategy(
        string strategyName,
        StrategyParameters? parameters,
        EvaluationContext context,
        string flagName)
    {
        var strategy = GetStrategy(strategyName);
        return strategy?.IsEnabled(parameters, context, flagName) ?? false;
    }
}
