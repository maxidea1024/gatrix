// GatrixSDK - Static shorthand for accessing the Gatrix SDK
// Provides convenient access without the verbose GatrixBehaviour.Client path

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Static shorthand for accessing the Gatrix SDK.
    /// <para>
    /// Instead of <c>GatrixBehaviour.Client.Features.IsEnabled("flag")</c>,
    /// you can write <c>GatrixSDK.Features.IsEnabled("flag")</c>.
    /// </para>
    /// <para>
    /// All properties delegate to <see cref="GatrixBehaviour.Client"/>.
    /// </para>
    /// </summary>
    public static class GatrixSDK
    {
        /// <summary>The active GatrixClient instance (same as GatrixBehaviour.Client).</summary>
        public static GatrixClient Client => GatrixBehaviour.Client;

        /// <summary>Shorthand for GatrixBehaviour.Client.Features.</summary>
        public static IFeaturesClient Features => GatrixBehaviour.Client?.Features;

        /// <summary>Shorthand for GatrixBehaviour.Client.Events.</summary>
        public static GatrixEventEmitter Events => GatrixBehaviour.Client?.Events;

        /// <summary>Check if SDK is initialized (same as GatrixBehaviour.IsInitialized).</summary>
        public static bool IsInitialized => GatrixBehaviour.IsInitialized;
    }
}
