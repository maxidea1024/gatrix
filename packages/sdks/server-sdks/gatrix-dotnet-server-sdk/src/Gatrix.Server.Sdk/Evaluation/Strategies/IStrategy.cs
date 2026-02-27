using Gatrix.Server.Sdk.Models;

namespace Gatrix.Server.Sdk.Evaluation.Strategies;

/// <summary>
/// Base interface for all activation strategies.
/// Each strategy defines its own IsEnabled() logic.
/// </summary>
public interface IStrategy
{
    /// <summary>
    /// Strategy name (e.g. "default", "flexibleRollout", "userWithId").
    /// </summary>
    string Name { get; }

    /// <summary>
    /// Evaluate whether this strategy is enabled for the given context.
    /// </summary>
    bool IsEnabled(StrategyParameters? parameters, EvaluationContext context, string flagName);
}
