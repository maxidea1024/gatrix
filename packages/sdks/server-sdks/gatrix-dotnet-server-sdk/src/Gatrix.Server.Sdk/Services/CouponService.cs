using Gatrix.Server.Sdk.Client;
using Gatrix.Server.Sdk.Models;

namespace Gatrix.Server.Sdk.Services;

public interface ICouponService
{
    Task<RedeemCouponResponse> RedeemAsync(RedeemCouponRequest request, string environment, CancellationToken ct = default);
}

public class CouponService : ICouponService
{
    private readonly GatrixApiClient _apiClient;

    public CouponService(GatrixApiClient apiClient) => _apiClient = apiClient;

    public async Task<RedeemCouponResponse> RedeemAsync(RedeemCouponRequest request, string environment, CancellationToken ct = default)
    {
        var response = await _apiClient.PostAsync<RedeemCouponResponse>(
            $"/api/v1/server/coupons/redeem", request, ct);

        if (!response.Success || response.Data is null)
            throw new InvalidOperationException(response.Error?.Message ?? "Coupon redemption failed");

        return response.Data;
    }
}
