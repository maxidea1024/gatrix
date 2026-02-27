namespace Gatrix.Server.Sdk.Evaluation.Strategies;

/// <summary>
/// User with ID strategy — enables for specific user IDs.
/// </summary>
public class UserWithIdStrategy : IStrategy
{
    public string Name => "userWithId";

    public bool IsEnabled(Models.StrategyParameters? parameters, Models.EvaluationContext context, string flagName)
    {
        var userIds = parameters?.UserIds;
        if (string.IsNullOrEmpty(userIds)) return false;
        if (string.IsNullOrEmpty(context.UserId)) return false;

        var ids = userIds.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
        return ids.Contains(context.UserId, StringComparer.Ordinal);
    }
}
