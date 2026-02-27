namespace Gatrix.Server.Sdk.Evaluation.Strategies;

/// <summary>
/// Gradual rollout based on session ID hash.
/// </summary>
public class GradualRolloutSessionIdStrategy : IStrategy
{
    public string Name => "gradualRolloutSessionId";

    public bool IsEnabled(Models.StrategyParameters? parameters, Models.EvaluationContext context, string flagName)
    {
        var pct = parameters?.Percentage ?? 0;
        if (pct >= 100) return true;
        if (pct <= 0) return false;
        if (string.IsNullOrEmpty(context.SessionId)) return false;

        var groupId = parameters?.GroupId ?? flagName;
        var percentage = StrategyUtils.CalculatePercentage(context.SessionId, groupId);
        return percentage <= pct;
    }
}
