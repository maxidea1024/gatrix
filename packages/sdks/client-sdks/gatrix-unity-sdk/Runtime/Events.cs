// Event constants for Gatrix Unity Client SDK
// All events use the 'flags.' prefix for namespacing

namespace Gatrix.Unity.SDK
{
    public static class GatrixEvents
    {
        /// <summary>SDK initialized (from storage/bootstrap)</summary>
        public const string FlagsInit = "flags.init";

        /// <summary>First successful fetch completed</summary>
        public const string FlagsReady = "flags.ready";

        /// <summary>Started fetching flags from server</summary>
        public const string FlagsFetch = "flags.fetch";

        /// <summary>Started fetching flags from server (alias for Fetch)</summary>
        public const string FlagsFetchStart = "flags.fetch_start";

        /// <summary>Successfully fetched flags from server</summary>
        public const string FlagsFetchSuccess = "flags.fetch_success";

        /// <summary>Error occurred during fetching</summary>
        public const string FlagsFetchError = "flags.fetch_error";

        /// <summary>Completed fetching flags (success or error)</summary>
        public const string FlagsFetchEnd = "flags.fetch_end";

        /// <summary>Flags changed from server</summary>
        public const string FlagsChange = "flags.change";

        /// <summary>General SDK error related to flags</summary>
        public const string FlagsError = "flags.error";

        /// <summary>Flag accessed (if impressionData enabled)</summary>
        public const string FlagsImpression = "flags.impression";

        /// <summary>Flags synchronized (explicitSyncMode)</summary>
        public const string FlagsSync = "flags.sync";

        /// <summary>One or more flags removed from server. Payload: string[] of removed flag names</summary>
        public const string FlagsRemoved = "flags.removed";

        /// <summary>SDK recovered from error state</summary>
        public const string FlagsRecovered = "flags.recovered";

        /// <summary>Metrics sent to server</summary>
        public const string FlagsMetricsSent = "flags.metrics_sent";

        /// <summary>Error sending metrics</summary>
        public const string FlagsMetricsError = "flags.metrics_error";

        /// <summary>Get the per-flag change event name</summary>
        public static string FlagChange(string flagName) => $"flags.{flagName}.change";
    }

    /// <summary>Delegate for Gatrix SDK events</summary>
    public delegate void GatrixEventHandler(object[] args);

    /// <summary>Delegate for universal Gatrix SDK event listeners (OnAny)</summary>
    public delegate void GatrixAnyEventHandler(string eventName, object[] args);

    /// <summary>Delegate for feature flag change watchers</summary>
    public delegate void GatrixFlagWatchHandler(FlagProxy flag);
}
