namespace Gatrix.Server.Sdk.Evaluation.Strategies;

/// <summary>
/// Default strategy — always returns true.
/// Only constraints and segments determine the outcome.
/// </summary>
public class DefaultStrategy : IStrategy
{
    public string Name => "default";

    public bool IsEnabled(Models.StrategyParameters? parameters, Models.EvaluationContext context, string flagName)
    {
        return true;
    }
}
