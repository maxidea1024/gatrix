// FlagProxy - Wrapper for EvaluatedFlag with helper methods
// Provides convenient variation accessors matching JS SDK's FlagProxy

using System;
using System.Collections.Generic;
using System.Globalization;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Convenience wrapper for accessing flag values.
    /// All variation methods return default values when flag is not found or disabled.
    /// </summary>
    public class FlagProxy
    {
        private static readonly Variant FallbackDisabledVariant = new Variant
        {
            Name = "disabled",
            Enabled = false
        };

        private readonly EvaluatedFlag _flag;

        public FlagProxy(EvaluatedFlag flag)
        {
            _flag = flag;
        }

        /// <summary>Get the flag name</summary>
        public string Name => _flag?.Name ?? "";

        /// <summary>Check if the flag exists</summary>
        public bool Exists => _flag != null;

        /// <summary>Check if the flag is enabled</summary>
        public bool Enabled => _flag?.Enabled ?? false;

        /// <summary>Get the variant (never null)</summary>
        public Variant Variant => _flag?.Variant ?? FallbackDisabledVariant;

        /// <summary>Get the variant type</summary>
        public VariantType VariantType => _flag?.VariantType ?? VariantType.None;

        /// <summary>Get the flag version</summary>
        public int Version => _flag?.Version ?? 0;

        /// <summary>Check if impression data is enabled</summary>
        public bool ImpressionData => _flag?.ImpressionData ?? false;

        /// <summary>Get the raw flag object</summary>
        public EvaluatedFlag Raw => _flag;

        /// <summary>Get evaluation reason</summary>
        public string Reason => _flag?.Reason;

        // ==================== Variation Methods ====================

        /// <summary>Get boolean variation (flag enabled state)</summary>
        public bool BoolVariation(bool defaultValue)
        {
            return _flag != null ? _flag.Enabled : defaultValue;
        }

        /// <summary>Get string variation from variant payload</summary>
        public string StringVariation(string defaultValue)
        {
            if (_flag == null || _flag.Variant?.Payload == null)
                return defaultValue;
            return _flag.Variant.Payload.ToString();
        }

        /// <summary>Get number variation from variant payload</summary>
        public double NumberVariation(double defaultValue)
        {
            if (_flag == null || _flag.Variant?.Payload == null)
                return defaultValue;

            var payload = _flag.Variant.Payload;
            if (payload is double d) return d;
            if (payload is int i) return i;
            if (payload is long l) return l;
            if (payload is float f) return f;

            // Fallback: parse string number
            if (payload is string s &&
                double.TryParse(s, NumberStyles.Float, CultureInfo.InvariantCulture, out var parsed))
            {
                return parsed;
            }

            return defaultValue;
        }

        /// <summary>Get integer variation from variant payload</summary>
        public int IntVariation(int defaultValue)
        {
            var result = NumberVariation(defaultValue);
            return (int)result;
        }

        /// <summary>Get float variation from variant payload</summary>
        public float FloatVariation(float defaultValue)
        {
            var result = NumberVariation(defaultValue);
            return (float)result;
        }

        /// <summary>
        /// Get JSON variation from variant payload as Dictionary.
        /// For typed deserialization, use the string payload with your preferred JSON library.
        /// </summary>
        public Dictionary<string, object> JsonVariation(Dictionary<string, object> defaultValue)
        {
            if (_flag == null || _flag.Variant?.Payload == null)
                return defaultValue;

            if (_flag.Variant.Payload is Dictionary<string, object> dict)
                return dict;

            return defaultValue;
        }

        /// <summary>Get the raw payload as string for custom deserialization</summary>
        public string RawPayload(string defaultValue = null)
        {
            if (_flag == null || _flag.Variant?.Payload == null)
                return defaultValue;

            if (_flag.Variant.Payload is string s)
                return s;

            return GatrixJson.Serialize(_flag.Variant.Payload);
        }

        // ==================== Variation Details Methods ====================

        /// <summary>Get boolean variation with details</summary>
        public VariationResult<bool> BoolVariationDetails(bool defaultValue)
        {
            if (_flag == null)
            {
                return new VariationResult<bool>
                {
                    Value = defaultValue, Reason = "flag_not_found",
                    FlagExists = false, Enabled = false
                };
            }
            return new VariationResult<bool>
            {
                Value = _flag.Enabled,
                Reason = _flag.Reason ?? "evaluated",
                FlagExists = true, Enabled = _flag.Enabled
            };
        }

        /// <summary>Get string variation with details</summary>
        public VariationResult<string> StringVariationDetails(string defaultValue)
        {
            if (_flag == null)
            {
                return new VariationResult<string>
                {
                    Value = defaultValue, Reason = "flag_not_found",
                    FlagExists = false, Enabled = false
                };
            }
            if (!_flag.Enabled)
            {
                return new VariationResult<string>
                {
                    Value = defaultValue, Reason = _flag.Reason ?? "disabled",
                    FlagExists = true, Enabled = false
                };
            }
            if (_flag.Variant?.Payload == null)
            {
                return new VariationResult<string>
                {
                    Value = defaultValue, Reason = "no_payload",
                    FlagExists = true, Enabled = true
                };
            }
            return new VariationResult<string>
            {
                Value = _flag.Variant.Payload.ToString(),
                Reason = _flag.Reason ?? "evaluated",
                FlagExists = true, Enabled = true
            };
        }

        /// <summary>Get number variation with details</summary>
        public VariationResult<double> NumberVariationDetails(double defaultValue)
        {
            if (_flag == null)
            {
                return new VariationResult<double>
                {
                    Value = defaultValue, Reason = "flag_not_found",
                    FlagExists = false, Enabled = false
                };
            }
            if (!_flag.Enabled)
            {
                return new VariationResult<double>
                {
                    Value = defaultValue, Reason = _flag.Reason ?? "disabled",
                    FlagExists = true, Enabled = false
                };
            }
            if (_flag.Variant?.Payload == null)
            {
                return new VariationResult<double>
                {
                    Value = defaultValue, Reason = "no_payload",
                    FlagExists = true, Enabled = true
                };
            }

            var payload = _flag.Variant.Payload;
            if (payload is double d)
            {
                return new VariationResult<double>
                {
                    Value = d, Reason = _flag.Reason ?? "evaluated",
                    FlagExists = true, Enabled = true
                };
            }
            if (payload is int i)
            {
                return new VariationResult<double>
                {
                    Value = i, Reason = _flag.Reason ?? "evaluated",
                    FlagExists = true, Enabled = true
                };
            }

            return new VariationResult<double>
            {
                Value = defaultValue, Reason = "type_mismatch:payload_not_number",
                FlagExists = true, Enabled = true
            };
        }

        /// <summary>Get JSON variation with details</summary>
        public VariationResult<Dictionary<string, object>> JsonVariationDetails(
            Dictionary<string, object> defaultValue)
        {
            if (_flag == null)
            {
                return new VariationResult<Dictionary<string, object>>
                {
                    Value = defaultValue, Reason = "flag_not_found",
                    FlagExists = false, Enabled = false
                };
            }
            if (!_flag.Enabled)
            {
                return new VariationResult<Dictionary<string, object>>
                {
                    Value = defaultValue, Reason = _flag.Reason ?? "disabled",
                    FlagExists = true, Enabled = false
                };
            }
            if (_flag.Variant?.Payload == null)
            {
                return new VariationResult<Dictionary<string, object>>
                {
                    Value = defaultValue, Reason = "no_payload",
                    FlagExists = true, Enabled = true
                };
            }

            if (_flag.Variant.Payload is Dictionary<string, object> dict)
            {
                return new VariationResult<Dictionary<string, object>>
                {
                    Value = dict, Reason = _flag.Reason ?? "evaluated",
                    FlagExists = true, Enabled = true
                };
            }

            return new VariationResult<Dictionary<string, object>>
            {
                Value = defaultValue, Reason = "type_mismatch:payload_not_object",
                FlagExists = true, Enabled = true
            };
        }

        // ==================== Strict Variation Methods (OrThrow) ====================

        /// <summary>Get boolean variation or throw if flag not found</summary>
        public bool BoolVariationOrThrow()
        {
            if (_flag == null) throw GatrixFeatureException.FlagNotFoundError(Name);
            return _flag.Enabled;
        }

        /// <summary>Get string variation or throw if flag not found or no payload</summary>
        public string StringVariationOrThrow()
        {
            if (_flag == null) throw GatrixFeatureException.FlagNotFoundError(Name);
            if (_flag.Variant?.Payload == null) throw GatrixFeatureException.NoPayloadError(_flag.Name);
            return _flag.Variant.Payload.ToString();
        }

        /// <summary>Get number variation or throw if flag not found or type mismatch</summary>
        public double NumberVariationOrThrow()
        {
            if (_flag == null) throw GatrixFeatureException.FlagNotFoundError(Name);
            if (_flag.Variant?.Payload == null) throw GatrixFeatureException.NoPayloadError(_flag.Name);

            var payload = _flag.Variant.Payload;
            if (payload is double d) return d;
            if (payload is int i) return i;
            if (payload is long l) return l;
            if (payload is float f) return f;

            throw GatrixFeatureException.TypeMismatchError(_flag.Name, "number", payload.GetType().Name);
        }

        /// <summary>Get JSON variation or throw if flag not found or type mismatch</summary>
        public Dictionary<string, object> JsonVariationOrThrow()
        {
            if (_flag == null) throw GatrixFeatureException.FlagNotFoundError(Name);
            if (_flag.Variant?.Payload == null) throw GatrixFeatureException.NoPayloadError(_flag.Name);

            if (_flag.Variant.Payload is Dictionary<string, object> dict)
                return dict;

            throw GatrixFeatureException.TypeMismatchError(
                _flag.Name, "object", _flag.Variant.Payload.GetType().Name);
        }
    }
}
