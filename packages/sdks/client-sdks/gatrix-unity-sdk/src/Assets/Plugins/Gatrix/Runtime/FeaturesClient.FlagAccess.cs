// FeaturesClient.FlagAccess - Flag lookup, variations, and public delegates
// Handles all flag access, variation methods, variation details, OrThrow, sync mode

using System;
using System.Collections.Generic;
using System.Globalization;
using Cysharp.Threading.Tasks;

namespace Gatrix.Unity.SDK
{
    public partial class FeaturesClient
    {
        // ==================== Flag Access ====================

        /// <summary>Lookup a flag from the active cache.</summary>
        private EvaluatedFlag LookupFlag(string flagName, bool forceRealtime = false)
        {
            var flags = SelectFlags(forceRealtime);
            flags.TryGetValue(flagName, out var flag);
            return flag;
        }

        /// <summary>Check if a flag exists</summary>
        public bool HasFlag(string flagName) => LookupFlag(flagName) != null;

        /// <summary>Create a FlagProxy. Used internally by WatchFlag.
        /// Always reads from realtimeFlags — watch callbacks must reflect
        /// the latest server state regardless of explicitSyncMode.</summary>
        internal FlagProxy CreateProxy(string flagName)
        {
            return new FlagProxy(this, flagName, forceRealtime: true);
        }

        /// <summary>Get all flags</summary>
        public List<EvaluatedFlag> GetAllFlags(bool forceRealtime = false)
        {
            var flags = SelectFlags(forceRealtime);
            var result = new List<EvaluatedFlag>(flags.Count);
            foreach (var kvp in flags)
            {
                result.Add(kvp.Value);
            }
            return result;
        }

        // ==================== VariationProvider Internal Methods ====================
        // All flag lookup + value extraction + metrics tracking happen here.

        public bool IsEnabledInternal(string flagName, bool forceRealtime = false)
        {
            var flag = LookupFlag(flagName, forceRealtime);
            if (flag == null)
            {
                TrackFlagAccess(flagName, null, "isEnabled");
                return false;
            }
            TrackFlagAccess(flagName, flag, "isEnabled", flag.Variant?.Name);
            return flag.Enabled;
        }

        public Variant GetVariantInternal(string flagName, bool forceRealtime = false)
        {
            var flag = LookupFlag(flagName, forceRealtime);
            if (flag == null)
            {
                TrackFlagAccess(flagName, null, "getVariant");
                return new Variant { Name = VariantSource.Missing, Enabled = false };
            }
            TrackFlagAccess(flagName, flag, "getVariant", flag.Variant?.Name);
            return flag.Variant;
        }

        // ==================== Metadata Access Internal Methods ====================
        // No metrics tracking — read-only metadata access for FlagProxy property delegation.

        public bool HasFlagInternal(string flagName, bool forceRealtime = false)
        {
            return LookupFlag(flagName, forceRealtime) != null;
        }

        public ValueType GetValueTypeInternal(string flagName, bool forceRealtime = false)
        {
            var flag = LookupFlag(flagName, forceRealtime);
            return flag?.ValueType ?? ValueType.None;
        }

        public int GetVersionInternal(string flagName, bool forceRealtime = false)
        {
            var flag = LookupFlag(flagName, forceRealtime);
            return flag?.Version ?? 0;
        }

        public string GetReasonInternal(string flagName, bool forceRealtime = false)
        {
            var flag = LookupFlag(flagName, forceRealtime);
            return flag?.Reason;
        }

        public bool GetImpressionDataInternal(string flagName, bool forceRealtime = false)
        {
            var flag = LookupFlag(flagName, forceRealtime);
            return flag?.ImpressionData ?? false;
        }

        public EvaluatedFlag GetRawFlagInternal(string flagName, bool forceRealtime = false)
        {
            return LookupFlag(flagName, forceRealtime);
        }

        public string VariationInternal(string flagName, string fallbackValue, bool forceRealtime = false)
        {
            var flag = LookupFlag(flagName, forceRealtime);
            if (flag == null)
            {
                TrackFlagAccess(flagName, null, "getVariant");
                return fallbackValue;
            }
            TrackFlagAccess(flagName, flag, "getVariant", flag.Variant?.Name);
            return flag.Variant?.Name ?? fallbackValue;
        }

        public bool BoolVariationInternal(string flagName, bool fallbackValue, bool forceRealtime = false)
        {
            var flag = LookupFlag(flagName, forceRealtime);
            if (flag == null)
            {
                TrackFlagAccess(flagName, null, "getVariant");
                return fallbackValue;
            }
            TrackFlagAccess(flagName, flag, "getVariant", flag.Variant?.Name);
            if (flag.ValueType != ValueType.Boolean) return fallbackValue;
            var val = flag.Variant?.Value;
            if (val == null) return fallbackValue;
            if (val is bool b) return b;
            if (val is string s) return s.ToLowerInvariant() == "true";
            try { return Convert.ToBoolean(val, CultureInfo.InvariantCulture); }
            catch { return fallbackValue; }
        }

        public string StringVariationInternal(string flagName, string fallbackValue, bool forceRealtime = false)
        {
            var flag = LookupFlag(flagName, forceRealtime);
            if (flag == null)
            {
                TrackFlagAccess(flagName, null, "getVariant");
                return fallbackValue;
            }
            TrackFlagAccess(flagName, flag, "getVariant", flag.Variant?.Name);
            if (flag.ValueType != ValueType.String) return fallbackValue;
            var val = flag.Variant?.Value;
            return val?.ToString() ?? fallbackValue;
        }

        public int IntVariationInternal(string flagName, int fallbackValue, bool forceRealtime = false)
        {
            var flag = LookupFlag(flagName, forceRealtime);
            if (flag == null)
            {
                TrackFlagAccess(flagName, null, "getVariant");
                return fallbackValue;
            }
            TrackFlagAccess(flagName, flag, "getVariant", flag.Variant?.Name);
            if (flag.ValueType != ValueType.Number) return fallbackValue;
            var val = flag.Variant?.Value;
            if (val == null) return fallbackValue;
            try { return Convert.ToInt32(val, CultureInfo.InvariantCulture); }
            catch { return fallbackValue; }
        }

        public float FloatVariationInternal(string flagName, float fallbackValue, bool forceRealtime = false)
        {
            var flag = LookupFlag(flagName, forceRealtime);
            if (flag == null)
            {
                TrackFlagAccess(flagName, null, "getVariant");
                return fallbackValue;
            }
            TrackFlagAccess(flagName, flag, "getVariant", flag.Variant?.Name);
            if (flag.ValueType != ValueType.Number) return fallbackValue;
            var val = flag.Variant?.Value;
            if (val == null) return fallbackValue;
            try { return Convert.ToSingle(val, CultureInfo.InvariantCulture); }
            catch { return fallbackValue; }
        }

        public double DoubleVariationInternal(string flagName, double fallbackValue, bool forceRealtime = false)
        {
            var flag = LookupFlag(flagName, forceRealtime);
            if (flag == null)
            {
                TrackFlagAccess(flagName, null, "getVariant");
                return fallbackValue;
            }
            TrackFlagAccess(flagName, flag, "getVariant", flag.Variant?.Name);
            if (flag.ValueType != ValueType.Number) return fallbackValue;
            var val = flag.Variant?.Value;
            if (val == null) return fallbackValue;
            try { return Convert.ToDouble(val, CultureInfo.InvariantCulture); }
            catch { return fallbackValue; }
        }

        public Dictionary<string, object> JsonVariationInternal(
            string flagName, Dictionary<string, object> fallbackValue, bool forceRealtime = false)
        {
            var flag = LookupFlag(flagName, forceRealtime);
            if (flag == null)
            {
                TrackFlagAccess(flagName, null, "getVariant");
                return fallbackValue;
            }
            TrackFlagAccess(flagName, flag, "getVariant", flag.Variant?.Name);
            if (flag.ValueType != ValueType.Json) return fallbackValue;
            var val = flag.Variant?.Value;
            if (val == null) return fallbackValue;
            if (val is Dictionary<string, object> dict) return dict;
            if (val is string jsonStr)
            {
                var parsed = GatrixJson.DeserializeDictionary(jsonStr);
                return parsed ?? fallbackValue;
            }
            return fallbackValue;
        }

        // -------------------- Variation Details Internal --------------------

        private VariationResult<T> MakeDetails<T>(string flagName, T value, string expectedType)
        {
            var flag = LookupFlag(flagName);
            var exists = flag != null;
            string reason;
            if (!exists)
            {
                reason = "flag_not_found";
            }
            else if (ValueTypeHelper.ToApiString(flag.ValueType) != expectedType)
            {
                reason = $"type_mismatch:expected_{expectedType}_got_{ValueTypeHelper.ToApiString(flag.ValueType)}";
            }
            else
            {
                reason = string.IsNullOrEmpty(flag.Reason) ? "evaluated" : flag.Reason;
            }
            return new VariationResult<T>
            {
                Value = value,
                Reason = reason,
                FlagExists = exists,
                Enabled = exists && flag.Enabled
            };
        }

        public VariationResult<bool> BoolVariationDetailsInternal(string flagName, bool fallbackValue, bool forceRealtime = false)
            => MakeDetails(flagName, BoolVariationInternal(flagName, fallbackValue, forceRealtime), "boolean");

        public VariationResult<string> StringVariationDetailsInternal(string flagName, string fallbackValue, bool forceRealtime = false)
            => MakeDetails(flagName, StringVariationInternal(flagName, fallbackValue, forceRealtime), "string");

        public VariationResult<int> IntVariationDetailsInternal(string flagName, int fallbackValue, bool forceRealtime = false)
            => MakeDetails(flagName, IntVariationInternal(flagName, fallbackValue, forceRealtime), "number");

        public VariationResult<float> FloatVariationDetailsInternal(string flagName, float fallbackValue, bool forceRealtime = false)
            => MakeDetails(flagName, FloatVariationInternal(flagName, fallbackValue, forceRealtime), "number");

        public VariationResult<double> DoubleVariationDetailsInternal(string flagName, double fallbackValue, bool forceRealtime = false)
            => MakeDetails(flagName, DoubleVariationInternal(flagName, fallbackValue, forceRealtime), "number");

        public VariationResult<Dictionary<string, object>> JsonVariationDetailsInternal(
            string flagName, Dictionary<string, object> fallbackValue, bool forceRealtime = false)
            => MakeDetails(flagName, JsonVariationInternal(flagName, fallbackValue, forceRealtime), "json");

        // -------------------- OrThrow Internal --------------------

        private EvaluatedFlag LookupFlagOrThrow(string flagName)
        {
            var flag = LookupFlag(flagName);
            if (flag == null)
            {
                TrackFlagAccess(flagName, null, "getVariant");
                throw GatrixFeatureException.FlagNotFoundError(flagName);
            }
            TrackFlagAccess(flagName, flag, "getVariant", flag.Variant?.Name);
            return flag;
        }

        private void ThrowTypeMismatch(string flagName, string expected, ValueType actual)
        {
            throw GatrixFeatureException.TypeMismatchError(flagName, expected, ValueTypeHelper.ToApiString(actual));
        }

        public bool BoolVariationOrThrowInternal(string flagName, bool forceRealtime = false)
        {
            var flag = LookupFlagOrThrow(flagName);
            if (flag.ValueType != ValueType.Boolean) ThrowTypeMismatch(flagName, "boolean", flag.ValueType);
            var val = flag.Variant?.Value;
            if (val == null) throw GatrixFeatureException.NoPayloadError(flagName);
            if (val is bool b) return b;
            if (val is string s) return s.ToLowerInvariant() == "true";
            return Convert.ToBoolean(val, CultureInfo.InvariantCulture);
        }

        public string StringVariationOrThrowInternal(string flagName, bool forceRealtime = false)
        {
            var flag = LookupFlagOrThrow(flagName);
            if (flag.ValueType != ValueType.String) ThrowTypeMismatch(flagName, "string", flag.ValueType);
            var val = flag.Variant?.Value;
            if (val == null) throw GatrixFeatureException.NoPayloadError(flagName);
            return val.ToString();
        }

        public int IntVariationOrThrowInternal(string flagName, bool forceRealtime = false)
        {
            var flag = LookupFlagOrThrow(flagName);
            if (flag.ValueType != ValueType.Number) ThrowTypeMismatch(flagName, "number", flag.ValueType);
            var val = flag.Variant?.Value;
            if (val == null) throw GatrixFeatureException.NoPayloadError(flagName);
            return Convert.ToInt32(val, CultureInfo.InvariantCulture);
        }

        public float FloatVariationOrThrowInternal(string flagName, bool forceRealtime = false)
        {
            var flag = LookupFlagOrThrow(flagName);
            if (flag.ValueType != ValueType.Number) ThrowTypeMismatch(flagName, "number", flag.ValueType);
            var val = flag.Variant?.Value;
            if (val == null) throw GatrixFeatureException.NoPayloadError(flagName);
            return Convert.ToSingle(val, CultureInfo.InvariantCulture);
        }

        public double DoubleVariationOrThrowInternal(string flagName, bool forceRealtime = false)
        {
            var flag = LookupFlagOrThrow(flagName);
            if (flag.ValueType != ValueType.Number) ThrowTypeMismatch(flagName, "number", flag.ValueType);
            var val = flag.Variant?.Value;
            if (val == null) throw GatrixFeatureException.NoPayloadError(flagName);
            return Convert.ToDouble(val, CultureInfo.InvariantCulture);
        }

        public Dictionary<string, object> JsonVariationOrThrowInternal(string flagName, bool forceRealtime = false)
        {
            var flag = LookupFlagOrThrow(flagName);
            if (flag.ValueType != ValueType.Json) ThrowTypeMismatch(flagName, "json", flag.ValueType);
            var val = flag.Variant?.Value;
            if (val == null) throw GatrixFeatureException.NoPayloadError(flagName);
            if (val is Dictionary<string, object> dict) return dict;
            if (val is string jsonStr)
            {
                var parsed = GatrixJson.DeserializeDictionary(jsonStr);
                if (parsed != null) return parsed;
            }
            throw GatrixFeatureException.ParseErrorFor(flagName);
        }

        // ==================== Public Methods (delegate to internal) ====================

        /// <summary>Check if a flag is enabled</summary>
        public bool IsEnabled(string flagName, bool forceRealtime = false) => IsEnabledInternal(flagName, forceRealtime);

        /// <summary>Get variant (never returns null)</summary>
        public Variant GetVariant(string flagName, bool forceRealtime = false) => GetVariantInternal(flagName, forceRealtime);

        public string Variation(string flagName, string fallbackValue, bool forceRealtime = false)
            => VariationInternal(flagName, fallbackValue, forceRealtime);

        public bool BoolVariation(string flagName, bool fallbackValue, bool forceRealtime = false)
            => BoolVariationInternal(flagName, fallbackValue, forceRealtime);

        public string StringVariation(string flagName, string fallbackValue, bool forceRealtime = false)
            => StringVariationInternal(flagName, fallbackValue, forceRealtime);

        public int IntVariation(string flagName, int fallbackValue, bool forceRealtime = false)
            => IntVariationInternal(flagName, fallbackValue, forceRealtime);

        public float FloatVariation(string flagName, float fallbackValue, bool forceRealtime = false)
            => FloatVariationInternal(flagName, fallbackValue, forceRealtime);

        public double DoubleVariation(string flagName, double fallbackValue, bool forceRealtime = false)
            => DoubleVariationInternal(flagName, fallbackValue, forceRealtime);

        public double NumberVariation(string flagName, double fallbackValue, bool forceRealtime = false)
            => DoubleVariationInternal(flagName, fallbackValue, forceRealtime);

        public Dictionary<string, object> JsonVariation(
            string flagName, Dictionary<string, object> fallbackValue, bool forceRealtime = false)
            => JsonVariationInternal(flagName, fallbackValue, forceRealtime);

        // Strict variations - delegate
        public bool BoolVariationOrThrow(string flagName, bool forceRealtime = false)
            => BoolVariationOrThrowInternal(flagName, forceRealtime);

        public string StringVariationOrThrow(string flagName, bool forceRealtime = false)
            => StringVariationOrThrowInternal(flagName, forceRealtime);

        public double NumberVariationOrThrow(string flagName, bool forceRealtime = false)
            => DoubleVariationOrThrowInternal(flagName, forceRealtime);

        public Dictionary<string, object> JsonVariationOrThrow(string flagName, bool forceRealtime = false)
            => JsonVariationOrThrowInternal(flagName, forceRealtime);

        // Variation details - delegate
        public VariationResult<bool> BoolVariationDetails(string flagName, bool fallbackValue, bool forceRealtime = false)
            => BoolVariationDetailsInternal(flagName, fallbackValue, forceRealtime);

        public VariationResult<string> StringVariationDetails(string flagName, string fallbackValue, bool forceRealtime = false)
            => StringVariationDetailsInternal(flagName, fallbackValue, forceRealtime);

        public VariationResult<double> NumberVariationDetails(string flagName, double fallbackValue, bool forceRealtime = false)
            => DoubleVariationDetailsInternal(flagName, fallbackValue, forceRealtime);

        public VariationResult<Dictionary<string, object>> JsonVariationDetails(
            string flagName, Dictionary<string, object> fallbackValue, bool forceRealtime = false)
            => JsonVariationDetailsInternal(flagName, fallbackValue, forceRealtime);

        // ==================== Explicit Sync Mode ====================

        /// <summary>Sync flags (explicit sync mode only)</summary>
        public async UniTask SyncFlagsAsync(bool fetchNow = true)
        {
            if (!FeaturesConfig.ExplicitSyncMode) return;

            if (fetchNow) await FetchFlagsAsync();

            var oldSynchronizedFlags = new Dictionary<string, EvaluatedFlag>(_synchronizedFlags);
            _synchronizedFlags = new Dictionary<string, EvaluatedFlag>(_realtimeFlags);
            InvokeWatchCallbacks(_syncedWatchCallbacks, oldSynchronizedFlags, _synchronizedFlags, forceRealtime: false);
            _pendingSync = false;
            _syncFlagsCount++;
            _emitter.Emit(GatrixEvents.FlagsSync);
        }

        /// <summary>Check if explicit sync mode is enabled</summary>
        public bool IsExplicitSync() => FeaturesConfig.ExplicitSyncMode;

        /// <summary>Check if there are pending flag changes to sync</summary>
        public bool HasPendingSyncFlags() => _pendingSync;

        /// <summary>Check if there are pending flag changes to sync (alias)</summary>
        public bool CanSyncFlags() => _pendingSync;

        /// <summary>Dynamically enable/disable explicit sync mode at runtime</summary>
        public void SetExplicitSyncMode(bool enabled)
        {
            if (FeaturesConfig.ExplicitSyncMode == enabled) return;
            FeaturesConfig.ExplicitSyncMode = enabled;
            _synchronizedFlags = new Dictionary<string, EvaluatedFlag>(_realtimeFlags);
            _pendingSync = false;
            DevLog($"SetExplicitSyncMode: {enabled}");
        }

        /// <summary>Check if offline mode is enabled</summary>
        public bool IsOfflineMode() => _config.OfflineMode;

        /// <summary>Check if currently fetching flags</summary>
        public bool IsFetching() => _isFetchingFlags;
    }
}
