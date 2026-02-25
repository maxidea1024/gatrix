using System.Text.Json.Serialization;
using Gatrix.Server.Sdk.Client;
using Gatrix.Server.Sdk.Models;
using Microsoft.Extensions.Logging;

namespace Gatrix.Server.Sdk.Services;

public class SurveyListResponse
{
    [JsonPropertyName("surveys")] public List<Survey> Surveys { get; set; } = [];
    [JsonPropertyName("settings")] public SurveySettings? Settings { get; set; }
}

public interface ISurveyService
{
    Task InitializeAsync(string environment, CancellationToken ct = default);
    Task<SurveyListResponse> FetchAsync(string environment, CancellationToken ct = default);
    List<Survey> GetCached(string environment);
    List<Survey> GetAll(string environment);
    SurveySettings? GetSettings(string environment);
    Task UpdateSingleSurveyAsync(string id, string environment, bool? isActive = null, CancellationToken ct = default);
    void RemoveSurvey(string id, string environment);
}

public class SurveyService : BaseEnvironmentService<Survey, SurveyListResponse>, ISurveyService
{
    private readonly Dictionary<string, SurveySettings?> _settingsByEnv = new(StringComparer.OrdinalIgnoreCase);

    public SurveyService(GatrixApiClient apiClient, ILogger<SurveyService> logger)
        : base(apiClient, logger) { }

    protected override string ServiceName => "Survey";
    protected override string GetEndpoint(string environment) =>
        $"/api/v1/server/{Uri.EscapeDataString(environment)}/surveys";
    protected override List<Survey> ExtractItems(SurveyListResponse response) => response.Surveys;
    protected override object GetItemId(Survey item) => item.Id;

    public async Task<SurveyListResponse> FetchAsync(string environment, CancellationToken ct = default)
    {
        var endpoint = GetEndpoint(environment);
        var response = await ApiClient.GetAsync<SurveyListResponse>(endpoint, ct: ct);
        if (response.Success && response.Data is not null)
        {
            UpdateCache(response.Data.Surveys, environment);
            _settingsByEnv[environment] = response.Data.Settings;
            return response.Data;
        }
        return new SurveyListResponse { Surveys = GetCached(environment), Settings = GetSettings(environment) };
    }

    public List<Survey> GetAll(string environment) => GetCached(environment);
    public SurveySettings? GetSettings(string environment) =>
        _settingsByEnv.GetValueOrDefault(environment);

    // ── Single-item cache operations (event-driven) ─────────────

    public async Task UpdateSingleSurveyAsync(string id, string environment, bool? isActive = null, CancellationToken ct = default)
    {
        try
        {
            if (isActive == false)
            {
                Logger.LogInformation("Survey isActive=false, removing from cache (id={Id})", id);
                RemoveFromCache(id, environment);
                return;
            }

            await Task.Delay(100, ct);

            var response = await ApiClient.GetAsync<Survey>(
                $"/api/v1/server/{Uri.EscapeDataString(environment)}/surveys/{Uri.EscapeDataString(id)}", ct: ct);

            if (!response.Success || response.Data is null)
            {
                Logger.LogDebug("Survey not found (id={Id}), removing from cache", id);
                RemoveFromCache(id, environment);
                return;
            }

            UpsertItemInCache(response.Data, environment);
            Logger.LogDebug("Single Survey upserted in cache (id={Id})", id);
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Failed to update single Survey (id={Id}), falling back to full refresh", id);
            await FetchAsync(environment, ct);
        }
    }

    public void RemoveSurvey(string id, string environment)
    {
        RemoveFromCache(id, environment);
        Logger.LogInformation("Survey removed from cache (id={Id})", id);
    }
}
