using System.Text.Json.Serialization;
using Gatrix.Server.Sdk.Cache;
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
    Task InitializeAsync(string environmentId, CancellationToken ct = default);
    Task<List<StoreProduct>> FetchAsync(string environmentId, CancellationToken ct = default);
    List<StoreProduct> GetCached(string environmentId);
    List<StoreProduct> GetAll(string environmentId);
    Task UpdateSingleProductAsync(string id, string environmentId, bool? isActive = null, CancellationToken ct = default);
    void RemoveProduct(string id, string environmentId);
}

public class StoreProductService : BaseEnvironmentService<StoreProduct, StoreProductListResponse>, IStoreProductService
{
    public StoreProductService(GatrixApiClient apiClient, ILogger<StoreProductService> logger, ICacheStorageProvider? storage = null)
        : base(apiClient, logger, storage) { }

    protected override string ServiceName => "StoreProduct";
    protected override string GetEndpoint(string environmentId) =>
        $"/api/v1/server/store-products";
    protected override List<StoreProduct> ExtractItems(StoreProductListResponse response) => response.Products;
    protected override object GetItemId(StoreProduct item) => item.Id;

    public Task<List<StoreProduct>> FetchAsync(string environmentId, CancellationToken ct = default) =>
        FetchByEnvironmentAsync(environmentId, ct);
    public List<StoreProduct> GetAll(string environmentId) => GetCached(environmentId);

    // ── Single-item cache operations (event-driven) ─────────────

    public async Task UpdateSingleProductAsync(string id, string environmentId, bool? isActive = null, CancellationToken ct = default)
    {
        try
        {
            if (isActive == false)
            {
                Logger.LogInformation("StoreProduct isActive=false, removing from cache (id={Id})", id);
                RemoveFromCache(id, environmentId);
                return;
            }

            await Task.Delay(100, ct);

            var response = await ApiClient.GetAsync<StoreProductByIdResponse>(
                $"/api/v1/server/store-products/{Uri.EscapeDataString(id)}", ct: ct);

            if (!response.Success || response.Data?.Product is null)
            {
                Logger.LogDebug("StoreProduct not found (id={Id}), removing from cache", id);
                RemoveFromCache(id, environmentId);
                return;
            }

            UpsertItemInCache(response.Data.Product, environmentId);
            Logger.LogDebug("Single StoreProduct upserted in cache (id={Id})", id);
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Failed to update single StoreProduct (id={Id}), falling back to full refresh", id);
            await FetchByEnvironmentAsync(environmentId, ct);
        }
    }

    public void RemoveProduct(string id, string environmentId)
    {
        RemoveFromCache(id, environmentId);
        Logger.LogInformation("StoreProduct removed from cache (id={Id})", id);
    }
}
