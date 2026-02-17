// IFeaturesClient - Interface for the Feature Flags client
// Defines the contract for flag evaluation, context management, and lifecycle operations

using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Interface for the Gatrix feature flags client.
    /// <para>
    /// The features client is responsible for fetching feature flags from the server,
    /// caching them in memory, and providing synchronous access to flag values.
    /// All flag access methods (IsEnabled, *Variation) read from an in-memory cache
    /// and never perform network I/O, making them safe to call from any thread or hot path.
    /// </para>
    /// <para>
    /// Async methods (InitAsync, StartAsync, FetchFlagsAsync, etc.) handle network
    /// communication and return <see cref="ValueTask"/> to minimize GC allocations
    /// on synchronous completion paths.
    /// </para>
    /// </summary>
    public interface IFeaturesClient
    {
        // ==================== Lifecycle ====================

        /// <summary>
        /// Initialize the features client. Loads cached flags from storage,
        /// resolves the session ID, and prepares the client for flag access.
        /// <para>
        /// This must be called before <see cref="StartAsync"/>. After initialization,
        /// cached flags (if any) are available immediately via flag access methods.
        /// </para>
        /// </summary>
        /// <returns>A <see cref="ValueTask"/> that completes when initialization is done.</returns>
        ValueTask InitAsync();

        /// <summary>
        /// Start the features client. Performs the initial flag fetch from the server,
        /// begins the polling loop for periodic refreshes, and starts the metrics sender.
        /// <para>
        /// After this method completes, the SDK transitions to the Ready state
        /// and emits <see cref="GatrixEvents.FlagsReady"/>. The polling interval is controlled
        /// by <see cref="FeaturesConfig.RefreshInterval"/>.
        /// </para>
        /// </summary>
        /// <returns>A <see cref="ValueTask"/> that completes when the initial fetch is done.</returns>
        ValueTask StartAsync();

        /// <summary>
        /// Stop the features client. Cancels the polling loop, stops metrics sending,
        /// and cleans up background tasks.
        /// <para>
        /// Flag access methods remain usable after stopping (they read from the last cache),
        /// but no new fetches or updates will occur. Call <see cref="StartAsync"/> to resume.
        /// </para>
        /// </summary>
        void Stop();

        // ==================== State ====================

        /// <summary>
        /// Check if the SDK is ready (initial flag fetch completed successfully).
        /// <para>
        /// Returns <c>true</c> after the first successful flag fetch.
        /// Flag access methods work before Ready (returning defaults), but values
        /// may not reflect server state until Ready is <c>true</c>.
        /// </para>
        /// </summary>
        /// <returns><c>true</c> if the initial flag fetch has completed.</returns>
        bool IsReady();

        /// <summary>
        /// Get the last error that occurred during SDK operations.
        /// </summary>
        /// <returns>The last <see cref="Exception"/>, or <c>null</c> if no error has occurred.</returns>
        Exception GetError();

        /// <summary>
        /// Get the client's unique connection ID, assigned by the server.
        /// <para>
        /// This ID is used for metrics, debugging, and log correlation.
        /// Returns <c>null</c> before the first successful server response.
        /// </para>
        /// </summary>
        /// <returns>The connection ID string, or <c>null</c>.</returns>
        string GetConnectionId();

        /// <summary>
        /// Check if explicit sync mode is enabled.
        /// <para>
        /// In explicit sync mode, fetched flags are staged in a buffer and not
        /// applied to reads until <see cref="SyncFlagsAsync"/> is called.
        /// This gives the application control over when flag changes take effect.
        /// </para>
        /// </summary>
        /// <returns><c>true</c> if explicit sync mode is enabled.</returns>
        bool IsExplicitSync();

        /// <summary>
        /// Check if there are pending flag changes to sync (explicit sync mode only).
        /// <para>
        /// Returns <c>true</c> when new flags have been fetched but not yet applied
        /// to the read cache. Call <see cref="SyncFlagsAsync"/> to apply them.
        /// Always returns <c>false</c> when not in explicit sync mode.
        /// </para>
        /// </summary>
        /// <returns><c>true</c> if there are unapplied flag changes.</returns>
        bool CanSyncFlags();

        /// <summary>
        /// Check if there are pending sync flags using the pendingSync flag.
        /// </summary>
        /// <returns><c>true</c> if there are pending sync flags.</returns>
        bool HasPendingSyncFlags();

        /// <summary>
        /// Dynamically enable/disable explicit sync mode at runtime.
        /// </summary>
        /// <param name="enabled">Whether to enable explicit sync mode.</param>
        void SetExplicitSyncMode(bool enabled);

        /// <summary>
        /// Check if offline mode is enabled.
        /// <para>
        /// In offline mode, no network requests are made. Flags are loaded from
        /// storage cache or bootstrap data only.
        /// </para>
        /// </summary>
        /// <returns><c>true</c> if offline mode is enabled.</returns>
        bool IsOfflineMode();

        /// <summary>
        /// Check if flags are currently being fetched from the server.
        /// <para>
        /// Useful for showing loading indicators. Flag access methods are still
        /// usable during a fetch (reading from the previous cache).
        /// </para>
        /// </summary>
        /// <returns><c>true</c> if a fetch is in progress.</returns>
        bool IsFetching();

        // ==================== Context ====================

        /// <summary>
        /// Get a deep copy of the current evaluation context.
        /// <para>
        /// The context includes system fields (AppName, Environment) and user-defined
        /// fields (UserId, SessionId, custom properties). Modifying the returned object
        /// does not affect the SDK's internal context.
        /// </para>
        /// </summary>
        /// <returns>A deep copy of the current <see cref="GatrixContext"/>.</returns>
        GatrixContext GetContext();

        /// <summary>
        /// Replace the entire evaluation context and re-fetch flags.
        /// <para>
        /// This is typically used when the user identity changes (e.g., login/logout).
        /// The new context completely replaces the old one. System fields (AppName,
        /// Environment) are preserved from the original config.
        /// </para>
        /// <para>
        /// Emits <see cref="GatrixEvents.FlagsChange"/> after the context is updated,
        /// followed by a flag re-fetch.
        /// </para>
        /// </summary>
        /// <param name="context">The new evaluation context.</param>
        /// <returns>A <see cref="ValueTask"/> that completes when the re-fetch finishes.</returns>
        ValueTask UpdateContextAsync(GatrixContext context);

        /// <summary>
        /// Set a single context field and re-fetch flags.
        /// <para>
        /// Supported field names: "userId", "sessionId", "currentTime",
        /// "ipAddress", and any custom property key (stored in Properties dictionary).
        /// Unknown field names are stored as custom properties.
        /// </para>
        /// </summary>
        /// <param name="fieldName">The field name to set (case-sensitive).</param>
        /// <param name="value">The value to set. Accepts string, number, bool, or object.</param>
        /// <returns>A <see cref="ValueTask"/> that completes when the re-fetch finishes.</returns>
        ValueTask SetContextFieldAsync(string fieldName, object value);

        /// <summary>Set a string context field and re-fetch flags (boxing-free for system fields)</summary>
        ValueTask SetContextFieldAsync(string fieldName, string value);

        /// <summary>Set a boolean context field and re-fetch flags</summary>
        ValueTask SetContextFieldAsync(string fieldName, bool value);

        /// <summary>Set a numeric context field and re-fetch flags</summary>
        ValueTask SetContextFieldAsync(string fieldName, double value);

        /// <summary>Set an integer context field and re-fetch flags</summary>
        ValueTask SetContextFieldAsync(string fieldName, int value);

        /// <summary>
        /// Remove a context field and re-fetch flags.
        /// <para>
        /// Built-in fields (userId, sessionId, etc.) are set to <c>null</c>.
        /// Custom properties are removed from the Properties dictionary.
        /// </para>
        /// </summary>
        /// <param name="fieldName">The field name to remove (case-sensitive).</param>
        /// <returns>A <see cref="ValueTask"/> that completes when the re-fetch finishes.</returns>
        ValueTask RemoveContextFieldAsync(string fieldName);

        // ==================== Flag Access (Synchronous) ====================

        /// <summary>
        /// Check if a feature flag is enabled.
        /// <para>
        /// This is the simplest flag access method. Returns the <c>Enabled</c> property
        /// of the evaluated flag. If the flag does not exist, returns <c>false</c>
        /// and tracks a "missing flag" metric.
        /// </para>
        /// <para>
        /// This method is synchronous and reads from the in-memory cache.
        /// It is safe to call from Update(), FixedUpdate(), or any hot path.
        /// </para>
        /// </summary>
        /// <param name="flagName">The feature flag key (case-sensitive).</param>
        /// <returns><c>true</c> if the flag exists and is enabled.</returns>
        /// <example>
        /// <code>
        /// if (client.Features.IsEnabled("new-ui"))
        /// {
        ///     ShowNewUI();
        /// }
        /// </code>
        /// </example>
        bool IsEnabled(string flagName, bool forceRealtime = false);

        /// <summary>
        /// Get the variant for a feature flag. Never returns <c>null</c>.
        /// <para>
        /// If the flag does not exist, returns a <see cref="Variant"/> with
        /// <c>Name</c> set to "$missing" and <c>Enabled</c> set to <c>false</c>.
        /// </para>
        /// </summary>
        /// <param name="flagName">The feature flag key (case-sensitive).</param>
        /// <returns>The <see cref="Variant"/>, never <c>null</c>.</returns>
        Variant GetVariant(string flagName, bool forceRealtime = false);

        /// <summary>
        /// Check if a flag exists in the cache.
        /// </summary>
        /// <param name="flagName">The feature flag key (case-sensitive).</param>
        /// <returns><c>true</c> if the flag exists.</returns>
        bool HasFlag(string flagName);

        /// <summary>
        /// Get all evaluated flags currently in the cache.
        /// <para>
        /// Returns a list of all flags with their full evaluation results.
        /// Useful for debugging, monitoring dashboards, and bulk inspection.
        /// The returned list is a snapshot; modifications do not affect the cache.
        /// </para>
        /// </summary>
        /// <returns>A list of all <see cref="EvaluatedFlag"/> objects.</returns>
        List<EvaluatedFlag> GetAllFlags();

        // ==================== Variations (Safe, with defaults) ====================

        /// <summary>
        /// Get the variant name for a flag, or a default value if the flag is not found.
        /// </summary>
        /// <param name="flagName">The feature flag key.</param>
        /// <param name="fallbackValue">Default value if flag not found or has no variant.</param>
        /// <returns>The variant name, or <paramref name="fallbackValue"/>.</returns>
        string Variation(string flagName, string fallbackValue, bool forceRealtime = false);

        /// <summary>
        /// Get a boolean variation. Returns the flag's <c>Enabled</c> state.
        /// <para>
        /// This is semantically equivalent to <see cref="IsEnabled"/> but with
        /// a configurable default value.
        /// </para>
        /// </summary>
        /// <param name="flagName">The feature flag key.</param>
        /// <param name="fallbackValue">Default value if flag not found.</param>
        /// <returns>The flag's enabled state, or <paramref name="fallbackValue"/>.</returns>
        bool BoolVariation(string flagName, bool fallbackValue, bool forceRealtime = false);

        /// <summary>
        /// Get a string variation from the variant's payload.
        /// <para>
        /// Reads the <c>Variant.Payload</c> as a string. If the flag has no variant,
        /// no payload, or the flag doesn't exist, returns <paramref name="missingValue"/>.
        /// </para>
        /// </summary>
        /// <param name="flagName">The feature flag key.</param>
        /// <param name="fallbackValue">Default value if flag not found or payload is empty.</param>
        /// <returns>The payload as string, or <paramref name="fallbackValue"/>.</returns>
        string StringVariation(string flagName, string fallbackValue, bool forceRealtime = false);

        /// <summary>
        /// Get a numeric variation from the variant's payload as <c>double</c>.
        /// <para>
        /// Parses the payload as a number. Supports int, long, float, double, and
        /// string representations. If parsing fails, returns <paramref name="missingValue"/>.
        /// </para>
        /// </summary>
        /// <param name="flagName">The feature flag key.</param>
        /// <param name="fallbackValue">Default value if flag not found or not a valid number.</param>
        /// <returns>The payload as double, or <paramref name="fallbackValue"/>.</returns>
        double NumberVariation(string flagName, double fallbackValue, bool forceRealtime = false);

        /// <summary>
        /// Get an integer variation (convenience wrapper around <see cref="NumberVariation"/>).
        /// </summary>
        /// <param name="flagName">The feature flag key.</param>
        /// <param name="fallbackValue">Default value if flag not found.</param>
        /// <returns>The payload as int, or <paramref name="fallbackValue"/>.</returns>
        int IntVariation(string flagName, int fallbackValue, bool forceRealtime = false);

        /// <summary>
        /// Get a float variation (convenience wrapper around <see cref="NumberVariation"/>).
        /// </summary>
        /// <param name="flagName">The feature flag key.</param>
        /// <param name="fallbackValue">Default value if flag not found.</param>
        /// <returns>The payload as float, or <paramref name="fallbackValue"/>.</returns>
        float FloatVariation(string flagName, float fallbackValue, bool forceRealtime = false);

        /// <summary>
        /// Get a double variation.
        /// </summary>
        /// <param name="flagName">The feature flag key.</param>
        /// <param name="fallbackValue">Default value if flag not found.</param>
        /// <returns>The payload as double, or <paramref name="fallbackValue"/>.</returns>
        double DoubleVariation(string flagName, double fallbackValue, bool forceRealtime = false);

        /// <summary>
        /// Get a JSON variation as a <see cref="Dictionary{TKey, TValue}"/>.
        /// <para>
        /// Parses the variant payload as a JSON object. If the payload is already
        /// a Dictionary, returns it directly. If it's a string, parses it as JSON.
        /// Returns <paramref name="missingValue"/> on parse failure or missing flag.
        /// </para>
        /// </summary>
        /// <param name="flagName">The feature flag key.</param>
        /// <param name="fallbackValue">Default value if flag not found or parse fails.</param>
        /// <returns>The payload as Dictionary, or <paramref name="fallbackValue"/>.</returns>
        Dictionary<string, object> JsonVariation(string flagName, Dictionary<string, object> fallbackValue, bool forceRealtime = false);

        // ==================== Variations (Strict, throws on missing) ====================

        /// <summary>
        /// Get a boolean variation, throwing if the flag is not found.
        /// </summary>
        /// <param name="flagName">The feature flag key.</param>
        /// <returns>The flag's enabled state.</returns>
        /// <exception cref="GatrixFeatureException">Thrown if the flag does not exist.</exception>
        bool BoolVariationOrThrow(string flagName, bool forceRealtime = false);

        /// <summary>
        /// Get a string variation, throwing if the flag is not found.
        /// </summary>
        /// <param name="flagName">The feature flag key.</param>
        /// <returns>The payload as string.</returns>
        /// <exception cref="GatrixFeatureException">Thrown if the flag does not exist.</exception>
        string StringVariationOrThrow(string flagName, bool forceRealtime = false);

        /// <summary>
        /// Get a numeric variation, throwing if the flag is not found.
        /// </summary>
        /// <param name="flagName">The feature flag key.</param>
        /// <returns>The payload as double.</returns>
        /// <exception cref="GatrixFeatureException">Thrown if the flag does not exist or payload is not numeric.</exception>
        double NumberVariationOrThrow(string flagName, bool forceRealtime = false);

        /// <summary>
        /// Get a JSON variation, throwing if the flag is not found.
        /// </summary>
        /// <param name="flagName">The feature flag key.</param>
        /// <returns>The payload as Dictionary.</returns>
        /// <exception cref="GatrixFeatureException">Thrown if the flag does not exist or payload is not valid JSON.</exception>
        Dictionary<string, object> JsonVariationOrThrow(string flagName, bool forceRealtime = false);

        // ==================== Variation Details ====================

        /// <summary>
        /// Get a boolean variation with detailed evaluation metadata.
        /// <para>
        /// Returns a <see cref="VariationResult{T}"/> containing the resolved value,
        /// the evaluation reason (e.g., "evaluated", "flag_not_found"), whether the
        /// flag exists, and the flag's enabled state.
        /// </para>
        /// </summary>
        /// <param name="flagName">The feature flag key.</param>
        /// <param name="fallbackValue">Default value if flag not found.</param>
        /// <returns>A <see cref="VariationResult{T}"/> with value and metadata.</returns>
        VariationResult<bool> BoolVariationDetails(string flagName, bool fallbackValue, bool forceRealtime = false);

        /// <summary>
        /// Get a string variation with detailed evaluation metadata.
        /// </summary>
        /// <param name="flagName">The feature flag key.</param>
        /// <param name="fallbackValue">Default value if flag not found.</param>
        /// <returns>A <see cref="VariationResult{T}"/> with value and metadata.</returns>
        VariationResult<string> StringVariationDetails(string flagName, string fallbackValue, bool forceRealtime = false);

        /// <summary>
        /// Get a numeric variation with detailed evaluation metadata.
        /// </summary>
        /// <param name="flagName">The feature flag key.</param>
        /// <param name="fallbackValue">Default value if flag not found.</param>
        /// <returns>A <see cref="VariationResult{T}"/> with value and metadata.</returns>
        VariationResult<double> NumberVariationDetails(string flagName, double fallbackValue, bool forceRealtime = false);

        /// <summary>
        /// Get a JSON variation with detailed evaluation metadata.
        /// </summary>
        /// <param name="flagName">The feature flag key.</param>
        /// <param name="fallbackValue">Default value if flag not found.</param>
        /// <returns>A <see cref="VariationResult{T}"/> with value and metadata.</returns>
        VariationResult<Dictionary<string, object>> JsonVariationDetails(
            string flagName, Dictionary<string, object> fallbackValue, bool forceRealtime = false);

        // ==================== Sync ====================

        /// <summary>
        /// Apply pending flag changes (explicit sync mode only).
        /// <para>
        /// In explicit sync mode, fetched flags are buffered until this method is called.
        /// When called with <paramref name="fetchNow"/> = <c>true</c> (default), performs
        /// a fresh fetch before applying. With <c>false</c>, applies the last fetched buffer.
        /// </para>
        /// <para>
        /// Emits <see cref="GatrixEvents.FlagsSync"/> after flags are applied,
        /// followed by individual <see cref="GatrixEvents.FlagChange"/> events for changed flags.
        /// </para>
        /// </summary>
        /// <param name="fetchNow">If <c>true</c>, fetch fresh flags before syncing.</param>
        /// <returns>A <see cref="ValueTask"/> that completes when sync is done.</returns>
        ValueTask SyncFlagsAsync(bool fetchNow = true);

        /// <summary>
        /// Explicitly fetch flags from the server.
        /// <para>
        /// This triggers an immediate HTTP request to the Gatrix API, bypassing the
        /// polling interval. Uses ETag-based caching — if flags haven't changed,
        /// the server returns 304 and no update is applied.
        /// </para>
        /// <para>
        /// Emits <see cref="GatrixEvents.FlagsFetchStart"/> before the request and
        /// <see cref="GatrixEvents.FlagsFetchEnd"/> after completion (success or failure).
        /// On success with changes, also emits <see cref="GatrixEvents.FlagsChange"/>.
        /// </para>
        /// </summary>
        /// <returns>A <see cref="ValueTask"/> that completes when the fetch finishes.</returns>
        ValueTask FetchFlagsAsync();

        // ==================== Watch ====================

        /// <summary>
        /// Watch a specific flag for changes. Returns an unsubscribe action.
        /// <para>
        /// The callback receives a <see cref="FlagProxy"/> wrapping the updated flag
        /// each time the flag's value changes. Call the returned <see cref="Action"/>
        /// to stop watching.
        /// </para>
        /// <para>
        /// The callback fires only on changes after subscription. To also receive the
        /// current value immediately, use <see cref="WatchFlagWithInitialState"/>.
        /// </para>
        /// </summary>
        /// <param name="flagName">The feature flag key to watch.</param>
        /// <param name="callback">Callback invoked with a <see cref="FlagProxy"/> on each change.</param>
        /// <returns>An <see cref="Action"/> that unsubscribes the watcher when invoked.</returns>
        /// <example>
        /// <code>
        /// var unsubscribe = client.Features.WatchFlag("dark-mode", proxy =>
        /// {
        ///     SetDarkMode(proxy.Enabled);
        /// });
        ///
        /// // Later: stop watching
        /// unsubscribe();
        /// </code>
        /// </example>
        Action WatchFlag(string flagName, GatrixFlagWatchHandler callback, string name = null);

        /// <summary>
        /// Watch a flag for changes, receiving the current value immediately.
        /// <para>
        /// Behaves like <see cref="WatchFlag"/> but also fires the callback immediately
        /// with the flag's current state. If the SDK is not yet ready, defers the
        /// initial callback until <see cref="GatrixEvents.FlagsReady"/> fires.
        /// </para>
        /// </summary>
        /// <param name="flagName">The feature flag key to watch.</param>
        /// <param name="callback">Callback invoked with a <see cref="FlagProxy"/>.</param>
        /// <returns>An <see cref="Action"/> that unsubscribes the watcher when invoked.</returns>
        Action WatchFlagWithInitialState(string flagName, GatrixFlagWatchHandler callback, string name = null);

        /// <summary>
        /// Create a named watch group for batch management of flag watchers.
        /// <para>
        /// A <see cref="WatchFlagGroup"/> lets you register multiple flag watchers
        /// and dispose them all at once by calling <see cref="WatchFlagGroup.Destroy"/>.
        /// This is useful in MonoBehaviour-based code where you watch multiple flags
        /// in OnEnable and need to clean up in OnDisable.
        /// </para>
        /// </summary>
        /// <param name="name">A descriptive name for the watch group (used in monitoring).</param>
        /// <returns>A new <see cref="WatchFlagGroup"/> instance.</returns>
        /// <example>
        /// <code>
        /// var group = client.Features.CreateWatchGroup("ui-flags");
        /// group.WatchFlag("dark-mode", p => { /* ... */ })
        ///      .WatchFlag("show-ads", p => { /* ... */ });
        ///
        /// // Clean up all watchers at once
        /// group.Destroy();
        /// </code>
        /// </example>
        WatchFlagGroup CreateWatchGroup(string name);

        // ==================== Statistics ====================

        /// <summary>
        /// Get SDK statistics for debugging, monitoring, and editor tools.
        /// <para>
        /// Returns a snapshot of internal counters including fetch counts, error counts,
        /// timing information, flag access patterns, and active watch groups.
        /// Used by the Gatrix Monitor Window (Editor) and Simplit example.
        /// </para>
        /// </summary>
        /// <returns>An <see cref="SdkStats"/> snapshot, or <c>null</c> if stats are unavailable.</returns>
        FeaturesStats GetStats();
    }
}
