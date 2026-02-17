// GatrixFlagNameAttribute - Marks a string field as a feature flag name
// Editor will display a searchable dropdown with cached flag names

using UnityEngine;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Apply to a string field to enable flag name autocomplete in the Inspector.
    /// The editor drawer will show a dropdown with all known flag names.
    /// </summary>
    public class GatrixFlagNameAttribute : PropertyAttribute
    {
    }
}
