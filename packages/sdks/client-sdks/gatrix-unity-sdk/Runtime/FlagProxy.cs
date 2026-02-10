// FlagProxy - Single source of truth for flag value extraction.
//
// ALL variation logic lives here. FeaturesClient delegates to FlagProxy
// so that value extraction + metrics tracking happen in one place.
//
// Uses null object pattern: _flag is never null.
// MISSING_FLAG sentinel is used for non-existent flags.
//
// OnAccess callback is invoked on every variation/Enabled call, enabling
// consistent metrics tracking regardless of how FlagProxy is obtained.
//
// Type safety: ValueType is checked strictly to prevent misuse.

using System;
using System.Collections.Generic;
using System.Globalization;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Callback invoked on every variation/Enabled call.
    /// </summary>
    /// <param name="flagName">Name of the flag</param>
    /// <param name="flag">The flag object (null = missing)</param>
    /// <param name="eventType">'isEnabled' for bool, 'getVariant' for value variations</param>
    /// <param name="variantName">Variant name (for getVariant events)</param>
    public delegate void FlagAccessCallback(
        string flagName, EvaluatedFlag flag, string eventType, string variantName);

    /// <summary>
    /// Convenience wrapper for accessing flag values.
    /// All variation methods return missing values when flag is not found.
    /// </summary>
    public class FlagProxy
    {
        private static readonly Variant MissingVariant = new Variant
        {
            Name = "$missing",
            Enabled = false,
            Value = null
        };

        private static readonly EvaluatedFlag MissingFlag = new EvaluatedFlag
        {
            Name = "",
            Enabled = false,
            Variant = MissingVariant,
            ValueType = ValueType.None,
            Version = 0,
            ImpressionData = false
        };

        private readonly EvaluatedFlag _flag;
        private readonly bool _exists;
        private readonly FlagAccessCallback _onAccess;
        private readonly string _flagName;

        public FlagProxy(EvaluatedFlag flag, FlagAccessCallback onAccess = null, string flagName = null)
        {
            _exists = flag != null;
            _flag = flag ?? MissingFlag;
            _onAccess = onAccess;
            _flagName = flagName ?? _flag.Name;
        }

        #region Props
        public bool Exists => _exists;
        public string Name => _flagName;

        /// <summary>Check if flag is enabled. Triggers metrics.</summary>
        public bool IsEnabled()
        {
            TrackAccess("isEnabled");
            return _flag.Enabled;
        }

        public Variant Variant => _flag.Variant;
        public ValueType ValueType => _flag.ValueType;
        public int Version => _flag.Version;
        public string Reason => _flag.Reason;
        public bool ImpressionData => _flag.ImpressionData;
        public EvaluatedFlag Raw => _exists ? _flag : null;
        #endregion

        #region Variations (Single Source of Truth)

        public string Variation(string missingValue)
        {
            TrackAccess("getVariant");
            return _exists ? _flag.Variant.Name : missingValue;
        }

        public bool BoolVariation(bool missingValue)
        {
            TrackAccess("getVariant");
            if (!_exists) return missingValue;

            // Strict: ValueType must be Boolean
            if (_flag.ValueType != ValueType.None && _flag.ValueType != ValueType.Boolean)
                return missingValue;

            object value = _flag.Variant.Value;
            if (value == null) return missingValue;

            if (value is bool b) return b;
            if (value is string s) return s.ToLowerInvariant() == "true";
            
            try {
                return Convert.ToBoolean(value, CultureInfo.InvariantCulture);
            } catch {
                return missingValue;
            }
        }

        public int IntVariation(int missingValue)
        {
            TrackAccess("getVariant");
            if (!_exists) return missingValue;

            // Strict: ValueType must be Number
            if (_flag.ValueType != ValueType.None && _flag.ValueType != ValueType.Number)
                return missingValue;

            object value = _flag.Variant.Value;
            if (value == null) return missingValue;

            try {
                return Convert.ToInt32(value, CultureInfo.InvariantCulture);
            } catch {
                return missingValue;
            }
        }

        public float FloatVariation(float missingValue)
        {
            TrackAccess("getVariant");
            if (!_exists) return missingValue;

            // Strict: ValueType must be Number
            if (_flag.ValueType != ValueType.None && _flag.ValueType != ValueType.Number)
                return missingValue;

            object value = _flag.Variant.Value;
            if (value == null) return missingValue;

            try {
                return Convert.ToSingle(value, CultureInfo.InvariantCulture);
            } catch {
                return missingValue;
            }
        }

        public double DoubleVariation(double missingValue)
        {
            TrackAccess("getVariant");
            if (!_exists) return missingValue;

            // Strict: ValueType must be Number
            if (_flag.ValueType != ValueType.None && _flag.ValueType != ValueType.Number)
                return missingValue;

            object value = _flag.Variant.Value;
            if (value == null) return missingValue;

            try {
                return Convert.ToDouble(value, CultureInfo.InvariantCulture);
            } catch {
                return missingValue;
            }
        }

        public string StringVariation(string missingValue)
        {
            TrackAccess("getVariant");
            if (!_exists) return missingValue;

            // Strict: ValueType must be String
            if (_flag.ValueType != ValueType.None && _flag.ValueType != ValueType.String)
                return missingValue;

            object value = _flag.Variant.Value;
            return value != null ? value.ToString() : missingValue;
        }

        public float NumberVariation(float missingValue)
        {
            return FloatVariation(missingValue);
        }

        public string JsonVariation(string missingValue)
        {
            TrackAccess("getVariant");
            if (!_exists) return missingValue;

            // Strict: ValueType must be Json
            if (_flag.ValueType != ValueType.None && _flag.ValueType != ValueType.Json)
                return missingValue;

            object value = _flag.Variant.Value;
            return value != null ? value.ToString() : missingValue;
        }

        #endregion

        #region Variation Details

        public VariationResult<bool> BoolVariationDetails(bool missingValue)
        {
            bool val = BoolVariation(missingValue);
            return new VariationResult<bool>
            {
                Value = val,
                Reason = GetResultReason(ValueType.Boolean),
                FlagExists = _exists,
                Enabled = _flag.Enabled
            };
        }

        public VariationResult<string> StringVariationDetails(string missingValue)
        {
            string val = StringVariation(missingValue);
            return new VariationResult<string>
            {
                Value = val,
                Reason = GetResultReason(ValueType.String),
                FlagExists = _exists,
                Enabled = _flag.Enabled
            };
        }

        public VariationResult<float> NumberVariationDetails(float missingValue)
        {
            float val = NumberVariation(missingValue);
            return new VariationResult<float>
            {
                Value = val,
                Reason = GetResultReason(ValueType.Number),
                FlagExists = _exists,
                Enabled = _flag.Enabled
            };
        }

        public VariationResult<string> JsonVariationDetails(string missingValue)
        {
            string val = JsonVariation(missingValue);
            return new VariationResult<string>
            {
                Value = val,
                Reason = GetResultReason(ValueType.Json),
                FlagExists = _exists,
                Enabled = _flag.Enabled
            };
        }

        #endregion

        #region Helpers

        private void TrackAccess(string eventType)
        {
            if (_onAccess != null)
            {
                _onAccess(_flagName, _exists ? _flag : null, eventType, _flag.Variant.Name);
            }
        }

        private string GetResultReason(ValueType expectedType)
        {
            if (!_exists) return "flag_not_found";
            if (_flag.ValueType != ValueType.None && _flag.ValueType != expectedType)
                return "type_mismatch:expected_" + expectedType.ToString().ToLowerInvariant();
            
            return string.IsNullOrEmpty(_flag.Reason) ? "evaluated" : _flag.Reason;
        }

        #endregion
    }

    /// <summary>
    /// Generic variation result
    /// </summary>
    public class VariationResult<T>
    {
        public T Value { get; set; }
        public string Reason { get; set; }
        public bool FlagExists { get; set; }
        public bool Enabled { get; set; }
    }
}
