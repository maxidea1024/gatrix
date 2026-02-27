namespace Gatrix.Server.Sdk.Evaluation.Strategies;

/// <summary>
/// Flexible rollout strategy with configurable stickiness.
/// </summary>
public class FlexibleRolloutStrategy : IStrategy
{
    public string Name => "flexibleRollout";

    public bool IsEnabled(Models.StrategyParameters? parameters, Models.EvaluationContext context, string flagName)
    {
        var rollout = parameters?.Rollout ?? 100;
        if (rollout >= 100) return true;
        if (rollout <= 0) return false;

        var stickiness = parameters?.Stickiness ?? "default";
        var groupId = parameters?.GroupId ?? flagName;

        // For "random" stickiness, use random value directly
        if (stickiness == "random")
            return Random.Shared.Next(1, 101) <= rollout;

        // Resolve stickiness value
        string? stickinessValue = stickiness switch
        {
            "default" => context.UserId ?? context.SessionId,
            "userId" => context.UserId,
            "sessionId" => context.SessionId,
            _ => StrategyUtils.GetContextValue(stickiness, context)?.ToString(),
        };

        if (stickinessValue == null) return false;

        var percentage = StrategyUtils.CalculatePercentage(stickinessValue, groupId);
        return percentage <= rollout;
    }
}
