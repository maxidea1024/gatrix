namespace Gatrix.Server.Sdk.Evaluation.Strategies;

/// <summary>
/// Gradual rollout using random percentage.
/// </summary>
public class GradualRolloutRandomStrategy : IStrategy
{
    public string Name => "gradualRolloutRandom";

    public bool IsEnabled(Models.StrategyParameters? parameters, Models.EvaluationContext context, string flagName)
    {
        var pct = parameters?.Percentage ?? 0;
        if (pct >= 100) return true;
        if (pct <= 0) return false;

        return Random.Shared.Next(1, 101) <= pct;
    }
}
