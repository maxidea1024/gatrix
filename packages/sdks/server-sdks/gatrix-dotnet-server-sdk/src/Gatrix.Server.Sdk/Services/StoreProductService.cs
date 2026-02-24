using System.Text.Json.Serialization;
using Gatrix.Server.Sdk.Client;
using Gatrix.Server.Sdk.Models;
using Microsoft.Extensions.Logging;

namespace Gatrix.Server.Sdk.Services;

public class StoreProductListResponse
{
    [JsonPropertyName("products")] public List<StoreProduct> Products { get; set; } = [];
}

internal class StoreProductByIdResponse
{
    [JsonPropertyName("product")] public StoreProduct Product { get; set; } = null!;
}

public interface IStoreProductService
{
    Task<List<StoreProduct>> FetchAsync(string environment, CancellationToken ct = default);
    List<StoreProduct> GetAll(string environment);
    Task UpdateSingleProductAsync(string id, string environment, bool? isActive = null, CancellationToken ct = default);
    void RemoveProduct(string id, string environment);
}

public class StoreProductService : BaseEnvironmentService<StoreProduct, StoreProductListResponse>, IStoreProductService
{
    public StoreProductService(GatrixApiClient apiClient, ILogger<StoreProductService> logger)
        : base(apiClient, logger) { }

    protected override string ServiceName => "StoreProduct";
    protected override string GetEndpoint(string environment) =>
        $"/api/v1/server/{Uri.EscapeDataString(environment)}/store-products";
    protected override List<StoreProduct> ExtractItems(StoreProductListResponse response) => response.Products;
    protected override object GetItemId(StoreProduct item) => item.Id;

    public Task<List<StoreProduct>> FetchAsync(string environment, CancellationToken ct = default) =>
        FetchByEnvironmentAsync(environment, ct);
    public List<StoreProduct> GetAll(string environment) => GetCached(environment);

    // ── Single-item cache operations (event-driven) ─────────────

    public async Task UpdateSingleProductAsync(string id, string environment, bool? isActive = null, CancellationToken ct = default)
    {
        try
        {
            if (isActive == false)
            {
                Logger.LogInformation("StoreProduct isActive=false, removing from cache (id={Id})", id);
                RemoveFromCache(id, environment);
                return;
            }

            await Task.Delay(100, ct);

            var response = await ApiClient.GetAsync<StoreProductByIdResponse>(
                $"/api/v1/server/{Uri.EscapeDataString(environment)}/store-products/{Uri.EscapeDataString(id)}", ct);

            if (!response.Success || response.Data?.Product is null)
            {
                Logger.LogDebug("StoreProduct not found (id={Id}), removing from cache", id);
                RemoveFromCache(id, environment);
                return;
            }

            UpsertItemInCache(response.Data.Product, environment);
            Logger.LogDebug("Single StoreProduct upserted in cache (id={Id})", id);
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Failed to update single StoreProduct (id={Id}), falling back to full refresh", id);
            await FetchByEnvironmentAsync(environment, ct);
        }
    }

    public void RemoveProduct(string id, string environment)
    {
        RemoveFromCache(id, environment);
        Logger.LogInformation("StoreProduct removed from cache (id={Id})", id);
    }
}
