// JSON serialization helpers for Gatrix Unity Client SDK
// Uses Unity's built-in JsonUtility where possible, with manual parsing for complex types.

using System;
using System.Collections.Generic;
using System.Globalization;
using System.Text;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Lightweight JSON serialization/deserialization utility for the SDK.
    /// Handles the specific API response format without requiring external JSON libraries.
    /// Uses a simple recursive descent parser for deserialization.
    /// </summary>
    internal static class GatrixJson
    {
        /// <summary>
        /// Serialize an object to a JSON string (simple implementation for SDK types)
        /// </summary>
        public static string Serialize(object obj)
        {
            if (obj == null) return "null";
            var sb = new StringBuilder();
            SerializeValue(sb, obj);
            return sb.ToString();
        }

        /// <summary>
        /// Deserialize a JSON string to a FlagsApiResponse
        /// </summary>
        public static FlagsApiResponse DeserializeFlagsResponse(string json)
        {
            if (string.IsNullOrEmpty(json)) return null;
            var index = 0;
            var obj = ParseValue(json, ref index) as Dictionary<string, object>;
            if (obj == null) return null;
            return MapFlagsApiResponse(obj);
        }

        /// <summary>
        /// Deserialize a JSON string to a list of EvaluatedFlags (for storage)
        /// </summary>
        public static List<EvaluatedFlag> DeserializeFlags(string json)
        {
            if (string.IsNullOrEmpty(json)) return null;
            var index = 0;
            var arr = ParseValue(json, ref index) as List<object>;
            if (arr == null) return null;

            var result = new List<EvaluatedFlag>();
            foreach (var item in arr)
            {
                if (item is Dictionary<string, object> dict)
                {
                    result.Add(MapEvaluatedFlag(dict));
                }
            }
            return result;
        }

        /// <summary>
        /// Serialize a list of EvaluatedFlags to JSON (for storage)
        /// </summary>
        public static string SerializeFlags(List<EvaluatedFlag> flags)
        {
            var sb = new StringBuilder();
            sb.Append('[');
            for (int i = 0; i < flags.Count; i++)
            {
                if (i > 0) sb.Append(',');
                SerializeFlag(sb, flags[i]);
            }
            sb.Append(']');
            return sb.ToString();
        }

        /// <summary>
        /// Parse a JSON value string into a CLR object.
        /// Used by streaming SSE event parser to parse event data.
        /// </summary>
        public static object ParseJsonValue(string json, ref int index)
        {
            return ParseValue(json, ref index);
        }

        /// <summary>
        /// Serialize a metrics payload to JSON
        /// </summary>
        public static string SerializeMetrics(MetricsPayload payload)
        {
            var sb = new StringBuilder();
            sb.Append('{');
            sb.Append("\"appName\":"); SerializeString(sb, payload.AppName);
            sb.Append(",\"instanceId\":"); SerializeString(sb, payload.InstanceId);
            sb.Append(",\"bucket\":{");
            sb.Append("\"start\":"); SerializeString(sb, payload.Bucket.Start.ToString("o"));
            sb.Append(",\"stop\":"); SerializeString(sb, (payload.Bucket.Stop ?? DateTime.UtcNow).ToString("o"));
            sb.Append(",\"flags\":{");
            var firstFlag = true;
            foreach (var kvp in payload.Bucket.Flags)
            {
                if (!firstFlag) sb.Append(',');
                firstFlag = false;
                SerializeString(sb, kvp.Key);
                sb.Append(":{\"yes\":");
                sb.Append(kvp.Value.Yes);
                sb.Append(",\"no\":");
                sb.Append(kvp.Value.No);
                sb.Append(",\"variants\":{");
                var firstVariant = true;
                foreach (var vkvp in kvp.Value.Variants)
                {
                    if (!firstVariant) sb.Append(',');
                    firstVariant = false;
                    SerializeString(sb, vkvp.Key);
                    sb.Append(':');
                    sb.Append(vkvp.Value);
                }
                sb.Append("}}");
            }
            sb.Append("},\"missing\":{");
            var firstMissing = true;
            foreach (var kvp in payload.Bucket.Missing)
            {
                if (!firstMissing) sb.Append(',');
                firstMissing = false;
                SerializeString(sb, kvp.Key);
                sb.Append(':');
                sb.Append(kvp.Value);
            }
            sb.Append("}}}");
            return sb.ToString();
        }

        // ==================== Private: Serialization ====================

        private static void SerializeValue(StringBuilder sb, object value)
        {
            if (value == null)
            {
                sb.Append("null");
            }
            else if (value is string s)
            {
                SerializeString(sb, s);
            }
            else if (value is bool b)
            {
                sb.Append(b ? "true" : "false");
            }
            else if (value is int i)
            {
                sb.Append(i);
            }
            else if (value is long l)
            {
                sb.Append(l);
            }
            else if (value is float f)
            {
                sb.Append(f.ToString(CultureInfo.InvariantCulture));
            }
            else if (value is double d)
            {
                sb.Append(d.ToString(CultureInfo.InvariantCulture));
            }
            else if (value is Dictionary<string, object> dict)
            {
                sb.Append('{');
                var first = true;
                foreach (var kvp in dict)
                {
                    if (!first) sb.Append(',');
                    first = false;
                    SerializeString(sb, kvp.Key);
                    sb.Append(':');
                    SerializeValue(sb, kvp.Value);
                }
                sb.Append('}');
            }
            else if (value is List<object> list)
            {
                sb.Append('[');
                for (int idx = 0; idx < list.Count; idx++)
                {
                    if (idx > 0) sb.Append(',');
                    SerializeValue(sb, list[idx]);
                }
                sb.Append(']');
            }
            else if (value is Dictionary<string, string> sDict)
            {
                sb.Append('{');
                var first = true;
                foreach (var kvp in sDict)
                {
                    if (!first) sb.Append(',');
                    first = false;
                    SerializeString(sb, kvp.Key);
                    sb.Append(':');
                    SerializeString(sb, kvp.Value);
                }
                sb.Append('}');
            }
            else
            {
                SerializeString(sb, value.ToString());
            }
        }

        private static void SerializeString(StringBuilder sb, string s)
        {
            if (s == null)
            {
                sb.Append("null");
                return;
            }
            sb.Append('"');
            foreach (var c in s)
            {
                switch (c)
                {
                    case '"': sb.Append("\\\""); break;
                    case '\\': sb.Append("\\\\"); break;
                    case '\b': sb.Append("\\b"); break;
                    case '\f': sb.Append("\\f"); break;
                    case '\n': sb.Append("\\n"); break;
                    case '\r': sb.Append("\\r"); break;
                    case '\t': sb.Append("\\t"); break;
                    default:
                        if (c < 0x20)
                        {
                            sb.Append("\\u");
                            sb.Append(((int)c).ToString("x4"));
                        }
                        else
                        {
                            sb.Append(c);
                        }
                        break;
                }
            }
            sb.Append('"');
        }

        private static void SerializeFlag(StringBuilder sb, EvaluatedFlag flag)
        {
            sb.Append('{');
            sb.Append("\"name\":"); SerializeString(sb, flag.Name);
            sb.Append(",\"enabled\":"); sb.Append(flag.Enabled ? "true" : "false");
            sb.Append(",\"variantType\":"); SerializeString(sb, VariantTypeHelper.ToApiString(flag.VariantType));
            sb.Append(",\"version\":"); sb.Append(flag.Version);
            sb.Append(",\"impressionData\":"); sb.Append(flag.ImpressionData ? "true" : "false");
            if (flag.Reason != null)
            {
                sb.Append(",\"reason\":"); SerializeString(sb, flag.Reason);
            }
            if (flag.Variant != null)
            {
                sb.Append(",\"variant\":{");
                sb.Append("\"name\":"); SerializeString(sb, flag.Variant.Name);
                sb.Append(",\"enabled\":"); sb.Append(flag.Variant.Enabled ? "true" : "false");
                if (flag.Variant.Payload != null)
                {
                    sb.Append(",\"payload\":");
                    SerializeValue(sb, flag.Variant.Payload);
                }
                sb.Append('}');
            }
            sb.Append('}');
        }

        // ==================== Private: JSON Parser ====================

        private static object ParseValue(string json, ref int index)
        {
            SkipWhitespace(json, ref index);
            if (index >= json.Length) return null;

            var c = json[index];
            if (c == '"') return ParseString(json, ref index);
            if (c == '{') return ParseObject(json, ref index);
            if (c == '[') return ParseArray(json, ref index);
            if (c == 't' || c == 'f') return ParseBool(json, ref index);
            if (c == 'n') return ParseNull(json, ref index);
            return ParseNumber(json, ref index);
        }

        private static string ParseString(string json, ref int index)
        {
            index++; // skip opening "
            var sb = new StringBuilder();
            while (index < json.Length)
            {
                var c = json[index++];
                if (c == '"') return sb.ToString();
                if (c == '\\' && index < json.Length)
                {
                    var next = json[index++];
                    switch (next)
                    {
                        case '"': sb.Append('"'); break;
                        case '\\': sb.Append('\\'); break;
                        case '/': sb.Append('/'); break;
                        case 'b': sb.Append('\b'); break;
                        case 'f': sb.Append('\f'); break;
                        case 'n': sb.Append('\n'); break;
                        case 'r': sb.Append('\r'); break;
                        case 't': sb.Append('\t'); break;
                        case 'u':
                            if (index + 4 <= json.Length)
                            {
                                var hex = json.Substring(index, 4);
                                sb.Append((char)int.Parse(hex, NumberStyles.HexNumber));
                                index += 4;
                            }
                            break;
                    }
                }
                else
                {
                    sb.Append(c);
                }
            }
            return sb.ToString();
        }

        private static Dictionary<string, object> ParseObject(string json, ref int index)
        {
            var dict = new Dictionary<string, object>();
            index++; // skip {
            SkipWhitespace(json, ref index);

            if (index < json.Length && json[index] == '}')
            {
                index++;
                return dict;
            }

            while (index < json.Length)
            {
                SkipWhitespace(json, ref index);
                if (index >= json.Length || json[index] == '}')
                {
                    index++;
                    return dict;
                }

                var key = ParseString(json, ref index);
                SkipWhitespace(json, ref index);
                if (index < json.Length && json[index] == ':') index++;
                var value = ParseValue(json, ref index);
                dict[key] = value;

                SkipWhitespace(json, ref index);
                if (index < json.Length && json[index] == ',') index++;
            }

            return dict;
        }

        private static List<object> ParseArray(string json, ref int index)
        {
            var list = new List<object>();
            index++; // skip [
            SkipWhitespace(json, ref index);

            if (index < json.Length && json[index] == ']')
            {
                index++;
                return list;
            }

            while (index < json.Length)
            {
                SkipWhitespace(json, ref index);
                if (index >= json.Length || json[index] == ']')
                {
                    index++;
                    return list;
                }

                list.Add(ParseValue(json, ref index));

                SkipWhitespace(json, ref index);
                if (index < json.Length && json[index] == ',') index++;
            }

            return list;
        }

        private static bool ParseBool(string json, ref int index)
        {
            if (json.Substring(index, 4) == "true")
            {
                index += 4;
                return true;
            }
            index += 5; // false
            return false;
        }

        private static object ParseNull(string json, ref int index)
        {
            index += 4;
            return null;
        }

        private static object ParseNumber(string json, ref int index)
        {
            var start = index;
            var hasDecimal = false;

            if (index < json.Length && json[index] == '-') index++;

            while (index < json.Length)
            {
                var c = json[index];
                if (c >= '0' && c <= '9')
                {
                    index++;
                }
                else if (c == '.' || c == 'e' || c == 'E' || c == '+' || c == '-')
                {
                    if (c == '.') hasDecimal = true;
                    if (c == 'e' || c == 'E') hasDecimal = true;
                    index++;
                }
                else
                {
                    break;
                }
            }

            var numStr = json.Substring(start, index - start);

            if (hasDecimal)
            {
                if (double.TryParse(numStr, NumberStyles.Float, CultureInfo.InvariantCulture, out var d))
                {
                    return d;
                }
            }
            else
            {
                if (long.TryParse(numStr, NumberStyles.Integer, CultureInfo.InvariantCulture, out var l))
                {
                    // Return int when possible for Unity compatibility
                    if (l >= int.MinValue && l <= int.MaxValue)
                    {
                        return (int)l;
                    }
                    return l;
                }
            }

            return 0;
        }

        private static void SkipWhitespace(string json, ref int index)
        {
            while (index < json.Length && (json[index] == ' ' || json[index] == '\t' || json[index] == '\n' || json[index] == '\r'))
            {
                index++;
            }
        }

        // ==================== Private: Mapping ====================

        private static FlagsApiResponse MapFlagsApiResponse(Dictionary<string, object> obj)
        {
            var response = new FlagsApiResponse();

            if (obj.TryGetValue("success", out var success))
            {
                response.Success = success is bool b && b;
            }

            if (obj.TryGetValue("data", out var data) && data is Dictionary<string, object> dataDict)
            {
                response.Data = new FlagsApiResponseData();
                if (dataDict.TryGetValue("flags", out var flags) && flags is List<object> flagsList)
                {
                    response.Data.Flags = new List<EvaluatedFlag>();
                    foreach (var item in flagsList)
                    {
                        if (item is Dictionary<string, object> flagDict)
                        {
                            response.Data.Flags.Add(MapEvaluatedFlag(flagDict));
                        }
                    }
                }
            }

            if (obj.TryGetValue("meta", out var meta) && meta is Dictionary<string, object> metaDict)
            {
                response.Meta = new FlagsApiResponseMeta
                {
                    Environment = metaDict.TryGetValue("environment", out var env) ? env?.ToString() : null,
                    EvaluatedAt = metaDict.TryGetValue("evaluatedAt", out var evalAt) ? evalAt?.ToString() : null
                };
            }

            return response;
        }

        private static EvaluatedFlag MapEvaluatedFlag(Dictionary<string, object> dict)
        {
            var flag = new EvaluatedFlag();

            if (dict.TryGetValue("name", out var name))
                flag.Name = name?.ToString();

            if (dict.TryGetValue("enabled", out var enabled))
                flag.Enabled = enabled is bool b && b;

            if (dict.TryGetValue("variantType", out var vt))
                flag.VariantType = VariantTypeHelper.Parse(vt?.ToString());

            if (dict.TryGetValue("version", out var version))
            {
                if (version is int vi) flag.Version = vi;
                else if (version is long vl) flag.Version = (int)vl;
                else if (version is double vd) flag.Version = (int)vd;
            }

            if (dict.TryGetValue("reason", out var reason))
                flag.Reason = reason?.ToString();

            if (dict.TryGetValue("impressionData", out var impData))
                flag.ImpressionData = impData is bool ib && ib;

            if (dict.TryGetValue("variant", out var variant) && variant is Dictionary<string, object> variantDict)
            {
                flag.Variant = MapVariant(variantDict, flag.VariantType);
            }

            return flag;
        }

        private static Variant MapVariant(Dictionary<string, object> dict, VariantType variantType)
        {
            var variant = new Variant();

            if (dict.TryGetValue("name", out var name))
                variant.Name = name?.ToString();

            if (dict.TryGetValue("enabled", out var enabled))
                variant.Enabled = enabled is bool b && b;

            if (dict.TryGetValue("payload", out var payload))
            {
                // Map payload based on variantType
                switch (variantType)
                {
                    case VariantType.Number:
                        if (payload is int pi) variant.Payload = (double)pi;
                        else if (payload is long pl) variant.Payload = (double)pl;
                        else if (payload is double pd) variant.Payload = pd;
                        else if (payload is string ps && double.TryParse(ps, NumberStyles.Float, CultureInfo.InvariantCulture, out var parsed))
                            variant.Payload = parsed;
                        break;

                    case VariantType.Json:
                        // Keep as Dictionary<string, object> for JSON payloads
                        variant.Payload = payload;
                        break;

                    case VariantType.String:
                        variant.Payload = payload?.ToString();
                        break;

                    default:
                        variant.Payload = payload;
                        break;
                }
            }

            return variant;
        }
    }
}
