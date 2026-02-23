// FeaturesClient.Statistics - Metrics tracking, impressions, and statistics
// Handles flag access tracking, impression events, and statistics reporting

using System;
using System.Collections.Generic;

namespace Gatrix.Unity.SDK
{
    public partial class FeaturesClient
    {
        // ==================== Statistics ====================

        /// <summary>Get feature flag specific statistics</summary>
        public FeaturesStats GetStats()
        {
            var flags = SelectFlags();

            // Active watch groups
            var activeWatchGroups = new List<string>();
            foreach (var kvp in _watchGroups)
            {
                if (kvp.Value.Size > 0) activeWatchGroups.Add(kvp.Key);
            }

            return new FeaturesStats
            {
                TotalFlagCount = flags.Count,
                MissingFlags = _metrics.GetMissingFlags(),
                FetchFlagsCount = _fetchFlagsCount,
                UpdateCount = _updateCount,
                NotModifiedCount = _notModifiedCount,
                RecoveryCount = _recoveryCount,
                ErrorCount = _errorCount,
                SdkState = _sdkState,
                LastError = _lastError,
                StartTime = _startTime,
                LastFetchTime = _lastFetchTime,
                LastUpdateTime = _lastUpdateTime,
                LastRecoveryTime = _lastRecoveryTime,
                LastErrorTime = _lastErrorTime,
                FlagEnabledCounts = new Dictionary<string, EnabledCount>(_flagEnabledCounts),
                FlagVariantCounts = CloneFlagVariantCounts(),
                SyncFlagsCount = _syncFlagsCount,
                ImpressionCount = _impressionCount,
                ContextChangeCount = _contextChangeCount,
                FlagLastChangedTimes = new Dictionary<string, DateTime>(_flagLastChangedTimes),
                ActiveWatchGroups = activeWatchGroups,
                Etag = string.IsNullOrEmpty(_etag) ? null : _etag,
                MetricsSentCount = _metricsSentCount,
                MetricsErrorCount = _metricsErrorCount,
                StreamingEnabled = FeaturesConfig?.Streaming?.Enabled ?? false,
                StreamingState = _streamingState,
                StreamingTransport = FeaturesConfig?.Streaming?.Transport ?? StreamingTransport.Sse,
                StreamingReconnectCount = _streamingReconnectCount,
                LastStreamingEventTime = _lastStreamingEventTime,
                StreamingEventCount = _streamingEventCount,
                StreamingErrorCount = _streamingErrorCount,
                StreamingRecoveryCount = _streamingRecoveryCount,
                LastStreamingErrorTime = _lastStreamingErrorTime,
                LastStreamingRecoveryTime = _lastStreamingRecoveryTime,
                LastStreamingError = _lastStreamingError
            };
        }

        /// <summary>Unified flag access tracking - metrics, stats, and impressions.</summary>
        private void TrackFlagAccess(string flagName, EvaluatedFlag flag, string eventType, string variantName = null)
        {
            if (flag == null)
            {
                _metrics.CountMissing(flagName);
                return;
            }

            // Metrics
            _metrics.Count(flagName, flag.Enabled);
            if (variantName != null)
            {
                _metrics.CountVariant(flagName, variantName);
            }

            // Stats
            TrackFlagEnabledCount(flagName, flag.Enabled);
            if (variantName != null)
            {
                TrackVariantCount(flagName, variantName);
            }

            // Impression
            TrackImpression(flagName, flag.Enabled, flag, eventType, variantName);
        }

        private void TrackImpression(
            string flagName, bool enabled, EvaluatedFlag flag,
            string eventType, string variantName = null)
        {
            var shouldTrack = FeaturesConfig.ImpressionDataAll || (flag?.ImpressionData ?? false);
            if (!shouldTrack) return;

            var evt = new ImpressionEvent
            {
                EventType = eventType,
                EventId = Guid.NewGuid().ToString(),
                Context = _context,
                Enabled = enabled,
                FeatureName = flagName,
                ImpressionData = flag?.ImpressionData ?? false,
                VariantName = variantName,
                Reason = flag?.Reason
            };

            _impressionCount++;
            _emitter.Emit(GatrixEvents.FlagsImpression, evt);
        }

        private void TrackFlagEnabledCount(string flagName, bool enabled)
        {
            if (FeaturesConfig.DisableStats) return;

            if (!_flagEnabledCounts.TryGetValue(flagName, out var counts))
            {
                counts = new EnabledCount();
                _flagEnabledCounts[flagName] = counts;
            }
            if (enabled) counts.Yes++;
            else counts.No++;
        }

        private void TrackVariantCount(string flagName, string variantName)
        {
            if (FeaturesConfig.DisableStats) return;

            if (!_flagVariantCounts.TryGetValue(flagName, out var variantCounts))
            {
                variantCounts = new Dictionary<string, int>();
                _flagVariantCounts[flagName] = variantCounts;
            }
            if (variantCounts.TryGetValue(variantName, out var count))
            {
                variantCounts[variantName] = count + 1;
            }
            else
            {
                variantCounts[variantName] = 1;
            }
        }

        private Dictionary<string, Dictionary<string, int>> CloneFlagVariantCounts()
        {
            var result = new Dictionary<string, Dictionary<string, int>>();
            foreach (var kvp in _flagVariantCounts)
            {
                result[kvp.Key] = new Dictionary<string, int>(kvp.Value);
            }
            return result;
        }
    }
}
