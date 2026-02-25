using Gatrix.Server.Sdk.Services;

namespace Gatrix.Server.Sdk;

/// <summary>
/// Root SDK interface — all services accessed through namespaced properties.
/// Mirrors the Node.js GatrixServerSDK class API surface.
/// </summary>
public interface IGatrixServerSdk
{
    /// <summary>Feature flag evaluation service (local evaluation).</summary>
    IFeatureFlagService FeatureFlag { get; }

    /// <summary>Game world management and maintenance check.</summary>
    IGameWorldService GameWorld { get; }

    /// <summary>In-game popup notice retrieval with targeting.</summary>
    IPopupNoticeService PopupNotice { get; }

    /// <summary>Survey retrieval with settings.</summary>
    ISurveyService Survey { get; }

    /// <summary>IP and account whitelist checking.</summary>
    IWhitelistService Whitelist { get; }

    /// <summary>Global service maintenance status.</summary>
    IServiceMaintenanceService ServiceMaintenance { get; }

    /// <summary>Store product catalog.</summary>
    IStoreProductService StoreProduct { get; }

    /// <summary>Service instance registration and discovery.</summary>
    IServiceDiscoveryService ServiceDiscovery { get; }

    /// <summary>Coupon redemption.</summary>
    ICouponService Coupon { get; }

    /// <summary>KV settings (Vars) retrieval and caching.</summary>
    IVarsService Vars { get; }
}
