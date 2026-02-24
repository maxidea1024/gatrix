using Gatrix.Server.Sdk.Services;

namespace Gatrix.Server.Sdk;

/// <summary>
/// Root SDK implementation — all domain services accessed via namespaced properties.
/// Registered as Scoped via DI (follows ambient context lifetime).
/// </summary>
public class GatrixServerSdk : IGatrixServerSdk
{
    public IFeatureFlagService FeatureFlag { get; }
    public IGameWorldService GameWorld { get; }
    public IPopupNoticeService PopupNotice { get; }
    public ISurveyService Survey { get; }
    public IWhitelistService Whitelist { get; }
    public IServiceMaintenanceService ServiceMaintenance { get; }
    public IStoreProductService StoreProduct { get; }
    public IServiceDiscoveryService ServiceDiscovery { get; }
    public ICouponService Coupon { get; }

    public GatrixServerSdk(
        IFeatureFlagService featureFlag,
        IGameWorldService gameWorld,
        IPopupNoticeService popupNotice,
        ISurveyService survey,
        IWhitelistService whitelist,
        IServiceMaintenanceService serviceMaintenance,
        IStoreProductService storeProduct,
        IServiceDiscoveryService serviceDiscovery,
        ICouponService coupon)
    {
        FeatureFlag = featureFlag;
        GameWorld = gameWorld;
        PopupNotice = popupNotice;
        Survey = survey;
        Whitelist = whitelist;
        ServiceMaintenance = serviceMaintenance;
        StoreProduct = storeProduct;
        ServiceDiscovery = serviceDiscovery;
        Coupon = coupon;
    }
}
