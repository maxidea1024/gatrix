// GatrixTimeSeriesGraph - Unity Editor time-series graph renderer
// Uses EditorGUI.DrawRect for reliable rendering (no GL clipping issues)
// Renders area charts with line overlays, grid, axis labels, and legends

#if UNITY_EDITOR
using System;
using System.Collections.Generic;
using UnityEditor;
using UnityEngine;

namespace Gatrix.Unity.SDK.Editor
{
    /// <summary>
    /// A single time-series data track that stores values over time.
    /// </summary>
    internal class TimeSeriesTrack
    {
        public string Name;
        public Color Color;
        public readonly List<DataPoint> Points = new List<DataPoint>();
        public int MaxPoints;

        public struct DataPoint
        {
            public float Time; // EditorApplication.timeSinceStartup
            public float Value;
        }

        public TimeSeriesTrack(string name, Color color, int maxPoints = 300)
        {
            Name = name;
            Color = color;
            MaxPoints = maxPoints;
        }

        public void Add(float value)
        {
            Points.Add(new DataPoint
            {
                Time = (float)EditorApplication.timeSinceStartup,
                Value = value
            });

            // Trim old points
            while (Points.Count > MaxPoints)
                Points.RemoveAt(0);
        }

        public float GetLatest()
        {
            return Points.Count > 0 ? Points[Points.Count - 1].Value : 0f;
        }

        /// <summary>
        /// Get the rate of change per second (delta of last two values / time delta).
        /// </summary>
        public float GetRate()
        {
            if (Points.Count < 2) return 0f;
            var a = Points[Points.Count - 2];
            var b = Points[Points.Count - 1];
            var dt = b.Time - a.Time;
            if (dt <= 0.001f) return 0f;
            return (b.Value - a.Value) / dt;
        }
    }

    /// <summary>
    /// Draws time-series graphs in the Unity Editor using EditorGUI.DrawRect.
    /// All rendering is clipped automatically by the GUI system.
    /// </summary>
    internal static class TimeSeriesGraphRenderer
    {
        private const float YAxisWidth = 38f;
        private const float TimeAxisHeight = 16f;
        private const float LegendHeight = 18f;
        private const float ChartPaddingTop = 4f;
        private const float ChartPaddingRight = 20f;
        private const float LineThickness = 2f;

        /// <summary>
        /// Draw a time-series graph with multiple tracks.
        /// Allocates layout space automatically via GUILayoutUtility.
        /// </summary>
        /// <param name="tracks">Data tracks to render</param>
        /// <param name="chartHeight">Height of the chart area (excluding axis/legend)</param>
        /// <param name="timeWindowSec">How many seconds of history to show</param>
        /// <param name="autoScale">Auto-scale Y axis</param>
        /// <param name="fixedMaxY">Fixed max Y (used when autoScale finds nothing larger)</param>
        public static void DrawGraph(
            List<TimeSeriesTrack> tracks,
            float chartHeight = 100f,
            float timeWindowSec = 60f,
            float timeOffset = 0f,
            bool autoScale = true,
            float fixedMaxY = 10f)
        {
            bool isDark = EditorGUIUtility.isProSkin;

            // Total height = chart + time axis + legend
            float totalHeight = chartHeight + TimeAxisHeight + LegendHeight + ChartPaddingTop;
            var totalRect = GUILayoutUtility.GetRect(0, totalHeight, GUILayout.ExpandWidth(true));

            // Sub-rects
            var chartRect = new Rect(
                totalRect.x + YAxisWidth,
                totalRect.y + ChartPaddingTop,
                totalRect.width - YAxisWidth - ChartPaddingRight,
                chartHeight);

            var timeAxisRect = new Rect(
                chartRect.x,
                chartRect.yMax,
                chartRect.width,
                TimeAxisHeight);

            var legendRect = new Rect(
                totalRect.x + YAxisWidth,
                timeAxisRect.yMax,
                chartRect.width,
                LegendHeight);

            if (chartRect.width < 20 || chartRect.height < 20) return;

            // ── Background ──
            var bgColor = isDark
                ? new Color(0.11f, 0.11f, 0.13f, 1f)
                : new Color(0.93f, 0.93f, 0.95f, 1f);
            EditorGUI.DrawRect(chartRect, bgColor);

            // ── Border ──
            var borderColor = isDark
                ? new Color(0.22f, 0.22f, 0.24f, 1f)
                : new Color(0.73f, 0.73f, 0.75f, 1f);
            EditorGUI.DrawRect(new Rect(chartRect.x, chartRect.y, chartRect.width, 1), borderColor);
            EditorGUI.DrawRect(new Rect(chartRect.x, chartRect.yMax - 1, chartRect.width, 1), borderColor);
            EditorGUI.DrawRect(new Rect(chartRect.x, chartRect.y, 1, chartRect.height), borderColor);
            EditorGUI.DrawRect(new Rect(chartRect.xMax - 1, chartRect.y, 1, chartRect.height), borderColor);

            // -- Compute time range (offset shifts the window into the past) --
            float now = (float)EditorApplication.timeSinceStartup - timeOffset;
            float timeStart = now - timeWindowSec;

            // ── Compute Y range ──
            float minY = 0f;
            float maxY = fixedMaxY;

            if (autoScale)
            {
                maxY = 1f;
                foreach (var track in tracks)
                {
                    foreach (var p in track.Points)
                    {
                        if (p.Time >= timeStart && p.Value > maxY)
                            maxY = p.Value;
                    }
                }
                maxY = Mathf.Ceil(maxY * 1.15f); // 15% headroom
                if (maxY < 1f) maxY = 1f;
            }

            // ── Grid lines ──
            DrawGrid(chartRect, minY, maxY, isDark);

            // ── Y axis labels ──
            DrawYAxis(totalRect, chartRect, minY, maxY, isDark);

            // -- Time axis labels --
            DrawTimeAxis(timeAxisRect, timeWindowSec, timeOffset, isDark);

            // ── Data tracks (area fill + line) ──
            foreach (var track in tracks)
            {
                if (track.Points.Count < 2) continue;
                DrawTrackArea(chartRect, track, timeStart, now, minY, maxY);
                DrawTrackLine(chartRect, track, timeStart, now, minY, maxY);
            }

            // ── Legend ──
            DrawLegend(legendRect, tracks, isDark);
        }

        // ── Grid ──

        private static void DrawGrid(Rect chartRect, float minY, float maxY, bool isDark)
        {
            var gridColor = isDark
                ? new Color(0.18f, 0.18f, 0.20f, 0.6f)
                : new Color(0.82f, 0.82f, 0.84f, 0.6f);

            int gridCount = 4;
            for (int i = 0; i <= gridCount; i++)
            {
                float t = (float)i / gridCount;
                float y = chartRect.y + chartRect.height * (1f - t);
                EditorGUI.DrawRect(new Rect(chartRect.x, y, chartRect.width, 1), gridColor);
            }
        }

        // ── Y Axis ──

        private static void DrawYAxis(Rect outerRect, Rect chartRect, float minY, float maxY, bool isDark)
        {
            var style = new GUIStyle(EditorStyles.miniLabel)
            {
                alignment = TextAnchor.MiddleRight,
                fontSize = 9,
                normal = { textColor = isDark ? new Color(0.42f, 0.45f, 0.50f) : new Color(0.48f, 0.51f, 0.56f) }
            };

            int gridCount = 4;
            for (int i = 0; i <= gridCount; i++)
            {
                float t = (float)i / gridCount;
                float val = Mathf.Lerp(minY, maxY, t);
                float y = chartRect.y + chartRect.height * (1f - t);
                string label = val >= 1000 ? $"{val / 1000f:F1}k" : $"{val:F0}";
                GUI.Label(new Rect(outerRect.x, y - 7, YAxisWidth - 4, 14), label, style);
            }
        }

        // ── Time Axis ──

        private static void DrawTimeAxis(Rect timeAxisRect, float timeWindowSec, float timeOffset, bool isDark)
        {
            var style = new GUIStyle(EditorStyles.miniLabel)
            {
                alignment = TextAnchor.UpperCenter,
                fontSize = 9,
                normal = { textColor = isDark ? new Color(0.42f, 0.45f, 0.50f) : new Color(0.48f, 0.51f, 0.56f) }
            };

            // Time markers from left (oldest) to right (now)
            int markerCount = Mathf.Clamp((int)(timeAxisRect.width / 70), 2, 6);
            for (int i = 0; i <= markerCount; i++)
            {
                float t = (float)i / markerCount;
                float x = timeAxisRect.x + timeAxisRect.width * t;
                float secsAgo = timeWindowSec * (1f - t) + timeOffset;
                string label;
                if (secsAgo < 0.5f)
                    label = "now";
                else if (secsAgo >= 60f)
                    label = $"-{secsAgo / 60f:F1}m";
                else
                    label = $"-{secsAgo:F0}s";
                GUI.Label(new Rect(x - 20, timeAxisRect.y, 40, TimeAxisHeight), label, style);
            }
        }

        // ── Area Fill ──
        // Draw thin vertical strips for each data segment

        private static void DrawTrackArea(Rect chartRect, TimeSeriesTrack track,
            float timeStart, float timeEnd, float minY, float maxY)
        {
            var areaColor = new Color(track.Color.r, track.Color.g, track.Color.b, 0.12f);
            float chartBottom = chartRect.yMax;

            for (int i = 1; i < track.Points.Count; i++)
            {
                var p0 = track.Points[i - 1];
                var p1 = track.Points[i];

                // Skip points entirely outside the time window
                if (p1.Time < timeStart || p0.Time > timeEnd) continue;

                float x0 = MapX(Mathf.Max(p0.Time, timeStart), timeStart, timeEnd, chartRect);
                float x1 = MapX(Mathf.Min(p1.Time, timeEnd), timeStart, timeEnd, chartRect);
                float y0 = MapY(p0.Value, minY, maxY, chartRect);
                float y1 = MapY(p1.Value, minY, maxY, chartRect);

                // Use the average Y for this strip
                float stripWidth = x1 - x0;
                if (stripWidth < 0.5f) stripWidth = 1f;

                float topY = Mathf.Min(y0, y1);
                float stripHeight = chartBottom - topY;
                if (stripHeight <= 0) continue;

                EditorGUI.DrawRect(new Rect(x0, topY, stripWidth, stripHeight), areaColor);
            }
        }

        // ── Line ──

        private static void DrawTrackLine(Rect chartRect, TimeSeriesTrack track,
            float timeStart, float timeEnd, float minY, float maxY)
        {
            for (int i = 1; i < track.Points.Count; i++)
            {
                var p0 = track.Points[i - 1];
                var p1 = track.Points[i];

                if (p1.Time < timeStart || p0.Time > timeEnd) continue;

                float x0 = MapX(Mathf.Max(p0.Time, timeStart), timeStart, timeEnd, chartRect);
                float x1 = MapX(Mathf.Min(p1.Time, timeEnd), timeStart, timeEnd, chartRect);
                float y0 = MapY(p0.Value, minY, maxY, chartRect);
                float y1 = MapY(p1.Value, minY, maxY, chartRect);

                // Draw line as a series of small rects (approximate line segments)
                float dx = x1 - x0;
                if (Mathf.Abs(dx) < 0.5f)
                {
                    // Vertical segment
                    float top = Mathf.Min(y0, y1);
                    float height = Mathf.Max(Mathf.Abs(y1 - y0), LineThickness);
                    EditorGUI.DrawRect(new Rect(x0, top, LineThickness, height), track.Color);
                    continue;
                }

                // Interpolate with small steps
                int steps = Mathf.Max(1, Mathf.CeilToInt(Mathf.Abs(dx) / 2f));
                for (int s = 0; s < steps; s++)
                {
                    float t0 = (float)s / steps;
                    float t1 = (float)(s + 1) / steps;
                    float sx = Mathf.Lerp(x0, x1, t0);
                    float sy = Mathf.Lerp(y0, y1, (t0 + t1) * 0.5f);
                    float sw = (x1 - x0) / steps;
                    if (sw < 1f) sw = 1f;
                    EditorGUI.DrawRect(new Rect(sx, sy - LineThickness * 0.5f, sw + 0.5f, LineThickness), track.Color);
                }
            }
        }

        // ── Legend ──

        private static void DrawLegend(Rect legendRect, List<TimeSeriesTrack> tracks, bool isDark)
        {
            var style = new GUIStyle(EditorStyles.miniLabel)
            {
                fontSize = 10,
                normal = { textColor = isDark ? new Color(0.58f, 0.61f, 0.66f) : new Color(0.35f, 0.38f, 0.42f) }
            };

            float x = legendRect.x;
            float y = legendRect.y + 2;

            foreach (var track in tracks)
            {
                // Color swatch
                EditorGUI.DrawRect(new Rect(x, y + 3, 8, 8), track.Color);
                x += 11;

                // Label with current value
                string label = $"{track.Name}: {track.GetLatest():F0}";
                var size = style.CalcSize(new GUIContent(label));
                GUI.Label(new Rect(x, y, size.x + 2, 14), label, style);
                x += size.x + 14;
            }
        }

        // ── Coordinate Mapping ──

        private static float MapX(float time, float timeStart, float timeEnd, Rect chartRect)
        {
            if (timeEnd <= timeStart) return chartRect.x;
            float t = (time - timeStart) / (timeEnd - timeStart);
            return chartRect.x + t * chartRect.width;
        }

        private static float MapY(float value, float minY, float maxY, Rect chartRect)
        {
            if (maxY <= minY) return chartRect.yMax;
            float t = (value - minY) / (maxY - minY);
            // Clamp to chart bounds
            t = Mathf.Clamp01(t);
            return chartRect.yMax - t * chartRect.height;
        }
    }

    /// <summary>
    /// Tracks a single flag's state changes over time (enabled, variant, missing).
    /// Only records transitions to minimize memory usage.
    /// </summary>
    internal class FlagStateTimeline
    {
        public string FlagName;
        public readonly List<StatePoint> Points = new List<StatePoint>();
        public int MaxPoints;

        public enum FlagState { Enabled, Disabled, Missing }

        public struct StatePoint
        {
            public float Time;
            public FlagState State;
            public string VariantName;
        }

        public FlagStateTimeline(string flagName, int maxPoints = 600)
        {
            FlagName = flagName;
            MaxPoints = maxPoints;
        }

        /// <summary>Record current flag state. Only appends if state changed or first point.</summary>
        public void Record(FlagState state, string variantName)
        {
            float now = (float)EditorApplication.timeSinceStartup;

            if (Points.Count > 0)
            {
                var last = Points[Points.Count - 1];
                if (last.State == state && last.VariantName == variantName)
                {
                    // State unchanged — update the last point's time to extend the band
                    Points[Points.Count - 1] = new StatePoint
                    {
                        Time = now,
                        State = state,
                        VariantName = variantName
                    };
                    return;
                }
            }

            Points.Add(new StatePoint
            {
                Time = now,
                State = state,
                VariantName = variantName
            });

            while (Points.Count > MaxPoints)
                Points.RemoveAt(0);
        }

        public StatePoint? GetLatestPoint()
        {
            return Points.Count > 0 ? Points[Points.Count - 1] : (StatePoint?)null;
        }
    }

    /// <summary>
    /// Renders per-flag state timeline charts (step charts with colored bands).
    /// </summary>
    internal static class FlagTimelineRenderer
    {
        private const float RowHeight = 22f;
        private const float NameWidth = 140f;
        private const float PaddingRight = 20f;
        private const float BarHeight = 14f;

        private static readonly Color ColorEnabled  = new Color(0.25f, 0.70f, 0.35f, 0.85f);
        private static readonly Color ColorDisabled = new Color(0.55f, 0.55f, 0.60f, 0.50f);
        private static readonly Color ColorMissing  = new Color(0.85f, 0.30f, 0.30f, 0.70f);

        // Palette for different variant names
        private static readonly Color[] VariantPalette =
        {
            new Color(0.40f, 0.70f, 1.00f, 0.80f),
            new Color(0.40f, 1.00f, 0.50f, 0.80f),
            new Color(1.00f, 0.80f, 0.30f, 0.80f),
            new Color(0.70f, 0.50f, 1.00f, 0.80f),
            new Color(1.00f, 0.60f, 0.20f, 0.80f),
            new Color(0.50f, 1.00f, 0.90f, 0.80f),
            new Color(1.00f, 0.50f, 0.70f, 0.80f),
        };

        /// <summary>Draw all flag timelines in a compact list.</summary>
        public static void DrawTimelines(
            Dictionary<string, FlagStateTimeline> timelines,
            float timeWindowSec,
            float timeOffset = 0f)
        {
            if (timelines == null || timelines.Count == 0) return;

            bool isDark = EditorGUIUtility.isProSkin;
            float now = (float)EditorApplication.timeSinceStartup - timeOffset;
            float timeStart = now - timeWindowSec;

            // Collect unique variant names for consistent coloring
            var variantColorMap = new Dictionary<string, Color>();
            int colorIdx = 0;

            var nameStyle = new GUIStyle(EditorStyles.miniLabel)
            {
                fontSize = 10,
                alignment = TextAnchor.MiddleLeft,
                normal = { textColor = isDark ? new Color(0.72f, 0.75f, 0.80f) : new Color(0.22f, 0.25f, 0.30f) }
            };

            var variantLabelStyle = new GUIStyle(EditorStyles.miniLabel)
            {
                fontSize = 8,
                alignment = TextAnchor.MiddleCenter,
                fontStyle = FontStyle.Bold,
                normal = { textColor = isDark ? new Color(0.90f, 0.92f, 0.95f) : new Color(0.10f, 0.12f, 0.15f) }
            };

            var stateStyle = new GUIStyle(EditorStyles.miniLabel)
            {
                fontSize = 9,
                alignment = TextAnchor.MiddleRight,
                normal = { textColor = isDark ? new Color(0.55f, 0.58f, 0.63f) : new Color(0.40f, 0.43f, 0.48f) }
            };

            // Sort by flag name
            var sortedKeys = new List<string>(timelines.Keys);
            sortedKeys.Sort();

            foreach (var flagName in sortedKeys)
            {
                var timeline = timelines[flagName];
                if (timeline.Points.Count == 0) continue;

                // Reserve layout space
                var rowRect = GUILayoutUtility.GetRect(0, RowHeight, GUILayout.ExpandWidth(true));

                // Background (subtle alternating)
                var bgColor = isDark
                    ? new Color(0.14f, 0.14f, 0.16f, 0.5f)
                    : new Color(0.90f, 0.90f, 0.92f, 0.5f);
                EditorGUI.DrawRect(rowRect, bgColor);

                // Bottom separator
                EditorGUI.DrawRect(new Rect(rowRect.x, rowRect.yMax - 1, rowRect.width, 1),
                    isDark ? new Color(0.20f, 0.20f, 0.22f) : new Color(0.78f, 0.78f, 0.80f));

                // Flag name
                GUI.Label(new Rect(rowRect.x + 4, rowRect.y, NameWidth - 8, rowRect.height), flagName, nameStyle);

                // Bar area
                float barX = rowRect.x + NameWidth;
                float barW = rowRect.width - NameWidth - PaddingRight;
                float barY = rowRect.y + (rowRect.height - BarHeight) * 0.5f;

                if (barW < 10) continue;

                // Draw bar background
                EditorGUI.DrawRect(new Rect(barX, barY, barW, BarHeight),
                    isDark ? new Color(0.10f, 0.10f, 0.12f) : new Color(0.85f, 0.85f, 0.87f));

                // Draw state bands
                for (int i = 0; i < timeline.Points.Count; i++)
                {
                    var point = timeline.Points[i];
                    float nextTime = (i + 1 < timeline.Points.Count)
                        ? timeline.Points[i + 1].Time
                        : now;

                    // Clip to visible window
                    float segStart = Mathf.Max(point.Time, timeStart);
                    float segEnd = Mathf.Min(nextTime, now);
                    if (segStart >= segEnd) continue;

                    float x0 = barX + ((segStart - timeStart) / timeWindowSec) * barW;
                    float x1 = barX + ((segEnd - timeStart) / timeWindowSec) * barW;
                    float sw = Mathf.Max(x1 - x0, 1f);

                    // Color based on state
                    Color bandColor;
                    switch (point.State)
                    {
                        case FlagStateTimeline.FlagState.Enabled:
                            bandColor = ColorEnabled;
                            break;
                        case FlagStateTimeline.FlagState.Missing:
                            bandColor = ColorMissing;
                            break;
                        default:
                            bandColor = ColorDisabled;
                            break;
                    }

                    EditorGUI.DrawRect(new Rect(x0, barY, sw, BarHeight), bandColor);

                    // Draw variant name overlay if segment is wide enough
                    if (sw > 30f && !string.IsNullOrEmpty(point.VariantName) &&
                        point.State == FlagStateTimeline.FlagState.Enabled)
                    {
                        // Assign variant color
                        if (!variantColorMap.ContainsKey(point.VariantName))
                        {
                            variantColorMap[point.VariantName] = VariantPalette[colorIdx % VariantPalette.Length];
                            colorIdx++;
                        }

                        // Small colored pip + variant name
                        var pipColor = variantColorMap[point.VariantName];
                        float pipSize = 6f;
                        float labelX = x0 + 3;
                        EditorGUI.DrawRect(new Rect(labelX, barY + (BarHeight - pipSize) * 0.5f, pipSize, pipSize), pipColor);
                        GUI.Label(new Rect(labelX + pipSize + 2, barY - 1, sw - pipSize - 6, BarHeight), point.VariantName, variantLabelStyle);
                    }
                }

                // Current state label on the right
                var latest = timeline.Points[timeline.Points.Count - 1];
                string stateText;
                switch (latest.State)
                {
                    case FlagStateTimeline.FlagState.Enabled:
                        stateText = latest.VariantName ?? "ON";
                        break;
                    case FlagStateTimeline.FlagState.Missing:
                        stateText = "MISSING";
                        break;
                    default:
                        stateText = "OFF";
                        break;
                }
                var stateRect = new Rect(rowRect.xMax - PaddingRight - 60, rowRect.y, 58, rowRect.height);
                stateStyle.normal.textColor = latest.State == FlagStateTimeline.FlagState.Enabled
                    ? ColorEnabled
                    : latest.State == FlagStateTimeline.FlagState.Missing
                        ? ColorMissing
                        : ColorDisabled;
                GUI.Label(stateRect, stateText, stateStyle);
            }

            // Legend
            EditorGUILayout.Space(2);
            EditorGUILayout.BeginHorizontal();
            GUILayout.Space(NameWidth);
            DrawLegendItem("\u25a0 Enabled", ColorEnabled);
            GUILayout.Space(8);
            DrawLegendItem("\u25a0 Disabled", ColorDisabled);
            GUILayout.Space(8);
            DrawLegendItem("\u25a0 Missing", ColorMissing);
            GUILayout.FlexibleSpace();
            EditorGUILayout.EndHorizontal();
        }

        private static void DrawLegendItem(string text, Color color)
        {
            bool isDark = EditorGUIUtility.isProSkin;
            var style = new GUIStyle(EditorStyles.miniLabel)
            {
                fontSize = 9,
                normal = { textColor = isDark ? new Color(0.55f, 0.58f, 0.63f) : new Color(0.42f, 0.45f, 0.50f) }
            };
            var content = new GUIContent(text);
            var size = style.CalcSize(content);
            var rect = GUILayoutUtility.GetRect(size.x, 14);
            style.normal.textColor = color;
            GUI.Label(rect, text, style);
        }
    }
}
#endif
