namespace Gatrix.Server.Sdk.Events;

/// <summary>
/// Constants for SDK event types received via Redis Pub/Sub.
/// </summary>
public static class SdkEventTypes
{
    // Game World
    public const string GameWorldCreated = "game_world.created";
    public const string GameWorldUpdated = "game_world.updated";
    public const string GameWorldDeleted = "game_world.deleted";
    public const string GameWorldOrderChanged = "game_world.order_changed";

    // Popup Notice
    public const string PopupCreated = "popup.created";
    public const string PopupUpdated = "popup.updated";
    public const string PopupDeleted = "popup.deleted";

    // Survey
    public const string SurveyCreated = "survey.created";
    public const string SurveyUpdated = "survey.updated";
    public const string SurveyDeleted = "survey.deleted";
    public const string SurveySettingsUpdated = "survey.settings.updated";

    // Whitelist
    public const string WhitelistUpdated = "whitelist.updated";

    // Service Maintenance
    public const string MaintenanceSettingsUpdated = "maintenance.settings.updated";

    // Store Product
    public const string StoreProductCreated = "store_product.created";
    public const string StoreProductUpdated = "store_product.updated";
    public const string StoreProductDeleted = "store_product.deleted";
    public const string StoreProductBulkUpdated = "store_product.bulk_updated";

    // Feature Flag
    public const string FeatureFlagChanged = "feature_flag.changed";

    // Vars
    public const string VarsUpdated = "vars.updated";

    // Segment
    public const string SegmentCreated = "segment.created";
    public const string SegmentUpdated = "segment.updated";
    public const string SegmentDeleted = "segment.deleted";

    // Client Version
    public const string ClientVersionCreated = "client_version.created";
    public const string ClientVersionUpdated = "client_version.updated";
    public const string ClientVersionDeleted = "client_version.deleted";

    // Banner
    public const string BannerCreated = "banner.created";
    public const string BannerUpdated = "banner.updated";
    public const string BannerDeleted = "banner.deleted";

    // Service Notice
    public const string ServiceNoticeCreated = "service_notice.created";
    public const string ServiceNoticeUpdated = "service_notice.updated";
    public const string ServiceNoticeDeleted = "service_notice.deleted";

    // Environment
    public const string EnvironmentCreated = "environment.created";
    public const string EnvironmentDeleted = "environment.deleted";
}

/// <summary>
/// Constants for feature flag change types.
/// </summary>
public static class FeatureFlagChangeTypes
{
    public const string EnabledChanged = "enabled_changed";
    public const string DefinitionChanged = "definition_changed";
    public const string Deleted = "deleted";
}
