// SimplitStatsPanel - SDK statistics display for Simplit example

using System;
using UnityEngine;
using UnityEngine.UI;

namespace Gatrix.Unity.SDK.Examples
{
    /// <summary>
    /// Displays SDK statistics: state, flag counts, fetch stats, uptime.
    /// </summary>
    public class SimplitStatsPanel : MonoBehaviour
    {
        [SerializeField] private Text _sdkStateText;
        [SerializeField] private Text _flagCountText;
        [SerializeField] private Text _fetchCountText;
        [SerializeField] private Text _uptimeText;
        [SerializeField] private Text _lastFetchText;
        [SerializeField] private Text _connectionIdText;
        [SerializeField] private Text _etagText;
        [SerializeField] private Text _errorCountText;

        private float _refreshTimer;
        private const float RefreshInterval = 1f;

        private void Update()
        {
            _refreshTimer += Time.unscaledDeltaTime;
            if (_refreshTimer < RefreshInterval) return;
            _refreshTimer = 0f;

            if (!GatrixBehaviour.IsInitialized) return;

            var stats = GatrixBehaviour.Client.GetStats();
            if (stats == null) return;

            UpdateDisplay(stats);
        }

        public void ForceRefresh()
        {
            if (!GatrixBehaviour.IsInitialized) return;
            var stats = GatrixBehaviour.Client.GetStats();
            if (stats != null) UpdateDisplay(stats);
        }

        private void UpdateDisplay(SdkStats stats)
        {
            SetText(_sdkStateText, FormatState(stats.SdkState));

            var enabled = 0;
            var disabled = 0;
            var flags = GatrixBehaviour.Client.GetAllFlags();
            for (int i = 0; i < flags.Count; i++)
            {
                if (flags[i].Enabled) enabled++;
                else disabled++;
            }
            SetText(_flagCountText, $"{stats.TotalFlagCount} (ON:{enabled} / OFF:{disabled})");

            SetText(_fetchCountText,
                $"Fetch:{stats.FetchFlagsCount}  Update:{stats.UpdateCount}  304:{stats.NotModifiedCount}");

            if (stats.StartTime.HasValue)
            {
                var uptime = DateTime.UtcNow - stats.StartTime.Value;
                SetText(_uptimeText, FormatUptime(uptime));
            }
            else
            {
                SetText(_uptimeText, "-");
            }

            SetText(_lastFetchText,
                stats.LastFetchTime.HasValue ? stats.LastFetchTime.Value.ToLocalTime().ToString("HH:mm:ss") : "-");
            SetText(_connectionIdText, TruncateId(stats.ConnectionId));
            SetText(_etagText, TruncateId(stats.Etag));
            SetText(_errorCountText, stats.ErrorCount > 0 ? $"Errors: {stats.ErrorCount}" : "No errors");

            if (_errorCountText != null)
            {
                _errorCountText.color = stats.ErrorCount > 0 ? Color.red : Color.green;
            }

            if (_sdkStateText != null)
            {
                _sdkStateText.color = stats.SdkState == SdkState.Error ? Color.red :
                    stats.SdkState == SdkState.Healthy ? Color.green : Color.yellow;
            }
        }

        private static string FormatState(SdkState state)
        {
            switch (state)
            {
                case SdkState.Initializing: return "INITIALIZING";
                case SdkState.Ready: return "READY";
                case SdkState.Healthy: return "HEALTHY";
                case SdkState.Error: return "ERROR";
                default: return "UNKNOWN";
            }
        }

        private static string FormatUptime(TimeSpan ts)
        {
            if (ts.TotalHours >= 1) return $"{(int)ts.TotalHours}h {ts.Minutes}m";
            if (ts.TotalMinutes >= 1) return $"{(int)ts.TotalMinutes}m {ts.Seconds}s";
            return $"{(int)ts.TotalSeconds}s";
        }

        private static string TruncateId(string id)
        {
            if (string.IsNullOrEmpty(id)) return "-";
            return id.Length > 12 ? id.Substring(0, 12) + "..." : id;
        }

        private static void SetText(Text text, string value)
        {
            if (text != null) text.text = value;
        }
    }
}
