namespace Gatrix.Server.Sdk.Evaluation.Strategies;

/// <summary>
/// Gradual rollout based on user ID hash.
/// </summary>
public class GradualRolloutUserIdStrategy : IStrategy
{
    public string Name => "gradualRolloutUserId";

    public bool IsEnabled(Models.StrategyParameters? parameters, Models.EvaluationContext context, string flagName)
    {
        var pct = parameters?.Percentage ?? 0;
        if (pct >= 100) return true;
        if (pct <= 0) return false;
        if (string.IsNullOrEmpty(context.UserId)) return false;

        var groupId = parameters?.GroupId ?? flagName;
        var percentage = StrategyUtils.CalculatePercentage(context.UserId, groupId);
        return percentage <= pct;
    }
}
