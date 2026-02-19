// GatrixTimeSeriesGraph - Unity Editor time-series visualization
// Uses GL immediate-mode rendering for clean, hardware-accelerated graphs
// (same technique used by Unity Profiler and Audio Mixer)

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

            while (Points.Count > MaxPoints)
                Points.RemoveAt(0);
        }

        public float GetLatest()
        {
            return Points.Count > 0 ? Points[Points.Count - 1].Value : 0f;
        }
    }

    /// <summary>
    /// GL-based time-series graph renderer.
    /// Uses GL.QUADS for filled areas and GL.LINES for line rendering.
    /// Renders at native resolution with hardware acceleration.
    /// </summary>
    internal static class TimeSeriesGraphRenderer
    {
        private const float YAxisWidth = 28f;
        private const float BottomPadding = 30f; // time axis + legend
        private const float TopPadding = 2f;

        private static Material _glMaterial;

        private static Material GetGLMaterial()
        {
            if (_glMaterial == null)
            {
                var shader = Shader.Find("Hidden/Internal-Colored");
                _glMaterial = new Material(shader)
                {
                    hideFlags = HideFlags.HideAndDontSave
                };
                _glMaterial.SetInt("_SrcBlend", (int)UnityEngine.Rendering.BlendMode.SrcAlpha);
                _glMaterial.SetInt("_DstBlend", (int)UnityEngine.Rendering.BlendMode.OneMinusSrcAlpha);
                _glMaterial.SetInt("_Cull", (int)UnityEngine.Rendering.CullMode.Off);
                _glMaterial.SetInt("_ZWrite", 0);
            }
            return _glMaterial;
        }

        public static void DrawGraph(
            List<TimeSeriesTrack> tracks,
            float chartHeight = 60f,
            float pixelsPerSec = 3f,
            float timeOffset = 0f)
        {
            bool isDark = EditorGUIUtility.isProSkin;
            float totalHeight = chartHeight + BottomPadding + TopPadding;

            // Use actual window width for chart sizing (GUILayout unreliable inside ScrollView)
            float viewWidth = EditorGUIUtility.currentViewWidth - 36f; // subtract scrollbar + padding
            var rect = GUILayoutUtility.GetRect(viewWidth, totalHeight);

            // Chart area (inside padding)
            var chart = new Rect(
                rect.x + YAxisWidth,
                rect.y + TopPadding,
                viewWidth - YAxisWidth - 4f,
                chartHeight);

            if (chart.width < 30 || chart.height < 20) return;

            // Time window = chart pixel width / pixelsPerSec
            // So chart width directly determines how many seconds are visible
            float timeWindowSec = chart.width / pixelsPerSec;

            // Time range
            float now = (float)EditorApplication.timeSinceStartup - timeOffset;
            float timeStart = now - timeWindowSec;
            float realNow = (float)EditorApplication.timeSinceStartup;
            bool isLive = timeOffset < 0.5f;

            // Auto-scale Y
            float maxY = 1f;
            foreach (var track in tracks)
            {
                foreach (var p in track.Points)
                {
                    if (p.Time >= timeStart && p.Time <= now && p.Value > maxY)
                        maxY = p.Value;
                }
            }
            maxY = Mathf.Ceil(maxY * 1.25f);
            if (maxY < 1f) maxY = 1f;

            // ── GL Rendering (only on Repaint) ──
            if (Event.current.type == EventType.Repaint)
            {
                GetGLMaterial().SetPass(0);
                GL.PushMatrix();
                GL.LoadPixelMatrix();

                // Background
                DrawQuad(chart, isDark
                    ? new Color(0.13f, 0.13f, 0.15f, 1f)
                    : new Color(0.94f, 0.94f, 0.96f, 1f));

                // Border
                Color border = isDark
                    ? new Color(0.25f, 0.25f, 0.28f, 1f)
                    : new Color(0.70f, 0.70f, 0.73f, 1f);
                DrawHLine(chart.x, chart.xMax, chart.y, border);
                DrawHLine(chart.x, chart.xMax, chart.yMax, border);
                DrawVLine(chart.x, chart.y, chart.yMax, border);
                DrawVLine(chart.xMax, chart.y, chart.yMax, border);

                // Grid lines (3 horizontal)
                Color grid = isDark
                    ? new Color(0.20f, 0.20f, 0.23f, 0.5f)
                    : new Color(0.80f, 0.80f, 0.83f, 0.5f);
                for (int i = 1; i <= 3; i++)
                {
                    float gy = chart.y + chart.height * (1f - (float)i / 4f);
                    DrawHLine(chart.x + 1, chart.xMax - 1, gy, grid);
                }

                // Data tracks
                foreach (var track in tracks)
                {
                    DrawTrackGL(chart, track, timeStart, now, maxY, isLive, realNow);
                }

                GL.PopMatrix();
            }

            // ── GUI labels (outside GL) ──
            var labelStyle = new GUIStyle(EditorStyles.miniLabel)
            {
                fontSize = 9,
                normal = { textColor = isDark ? new Color(0.52f, 0.55f, 0.60f) : new Color(0.42f, 0.45f, 0.50f) }
            };

            // Y axis: 0 and max
            labelStyle.alignment = TextAnchor.MiddleRight;
            GUI.Label(new Rect(rect.x, chart.yMax - 9, YAxisWidth - 3, 12), "0", labelStyle);
            GUI.Label(new Rect(rect.x, chart.y, YAxisWidth - 3, 12),
                maxY >= 1000 ? $"{maxY / 1000f:F1}k" : $"{maxY:F0}", labelStyle);

            // Time axis
            labelStyle.alignment = TextAnchor.UpperCenter;
            float taxisY = chart.yMax + 2;
            // Left
            float leftSec = timeWindowSec + timeOffset;
            string leftLabel = leftSec >= 60 ? $"-{leftSec / 60f:F0}m" : $"-{leftSec:F0}s";
            GUI.Label(new Rect(chart.x - 14, taxisY, 36, 12), leftLabel, labelStyle);
            // Center
            float midSec = timeWindowSec * 0.5f + timeOffset;
            string midLabel = midSec >= 60 ? $"-{midSec / 60f:F0}m" : $"-{midSec:F0}s";
            GUI.Label(new Rect(chart.x + chart.width * 0.5f - 14, taxisY, 36, 12), midLabel, labelStyle);
            // Right
            string rightLabel = timeOffset < 0.5f ? "now" : $"-{timeOffset:F0}s";
            GUI.Label(new Rect(chart.xMax - 14, taxisY, 36, 12), rightLabel, labelStyle);

            // Legend
            var legendStyle = new GUIStyle(EditorStyles.miniLabel)
            {
                fontSize = 9,
                normal = { textColor = isDark ? new Color(0.65f, 0.68f, 0.73f) : new Color(0.30f, 0.33f, 0.38f) }
            };
            float lx = chart.x;
            float ly = taxisY + 14;
            foreach (var track in tracks)
            {
                EditorGUI.DrawRect(new Rect(lx, ly + 2, 6, 6), track.Color);
                lx += 8;
                string name = track.Name;
                var sz = legendStyle.CalcSize(new GUIContent(name));
                GUI.Label(new Rect(lx, ly, sz.x, 12), name, legendStyle);
                lx += sz.x + 8;
            }
        }

        /// <summary>Render a single track as step-chart with filled area using GL.</summary>
        private static void DrawTrackGL(Rect chart, TimeSeriesTrack track,
            float timeStart, float timeEnd, float maxY, bool isLive, float realNow)
        {
            if (track.Points.Count == 0) return;

            Color fillColor = new Color(track.Color.r, track.Color.g, track.Color.b, 0.18f);
            Color lineColor = track.Color;
            float baseline = chart.yMax;

            // Collect visible segments as (x, value) pairs in step-chart order
            float prevX = -1f;
            float prevVal = 0f;
            bool started = false;

            // Find the value just before the visible window for continuity
            for (int i = track.Points.Count - 1; i >= 0; i--)
            {
                if (track.Points[i].Time <= timeStart)
                {
                    prevVal = track.Points[i].Value;
                    break;
                }
            }

            // Draw segments
            for (int i = 0; i < track.Points.Count; i++)
            {
                var p = track.Points[i];
                if (p.Time < timeStart)
                {
                    prevVal = p.Value;
                    continue;
                }
                if (p.Time > timeEnd) break;

                float px = XMap(p.Time, timeStart, timeEnd, chart);

                if (!started)
                {
                    // Fill from left edge to first visible point with previous value
                    float leftX = chart.x;
                    float prevY = YMap(prevVal, maxY, chart);
                    if (prevVal > 0)
                    {
                        DrawQuad(new Rect(leftX, prevY, px - leftX, baseline - prevY), fillColor);
                    }
                    // Horizontal step line
                    DrawGLLine(leftX, prevY, px, prevY, lineColor);
                    // Vertical transition
                    float curY = YMap(p.Value, maxY, chart);
                    DrawGLLine(px, prevY, px, curY, lineColor);

                    prevX = px;
                    prevVal = p.Value;
                    started = true;
                    continue;
                }

                // Step from previous to this point
                float py0 = YMap(prevVal, maxY, chart);
                float py1 = YMap(p.Value, maxY, chart);

                // Fill horizontal segment with previous value
                if (prevVal > 0)
                {
                    DrawQuad(new Rect(prevX, py0, px - prevX, baseline - py0), fillColor);
                }

                // Horizontal line at previous value, then vertical transition
                DrawGLLine(prevX, py0, px, py0, lineColor);
                DrawGLLine(px, py0, px, py1, lineColor);

                prevX = px;
                prevVal = p.Value;
            }

            // Extend to right edge
            float rightX = isLive ? XMap(realNow, timeStart, timeEnd, chart) : chart.xMax;
            rightX = Mathf.Min(rightX, chart.xMax);
            if (started && prevX < rightX)
            {
                float py = YMap(prevVal, maxY, chart);
                if (prevVal > 0)
                {
                    DrawQuad(new Rect(prevX, py, rightX - prevX, baseline - py), fillColor);
                }
                DrawGLLine(prevX, py, rightX, py, lineColor);
            }
            else if (!started)
            {
                // No visible points — draw flat line at prevVal
                float py = YMap(prevVal, maxY, chart);
                if (prevVal > 0)
                {
                    DrawQuad(new Rect(chart.x, py, chart.width, baseline - py), fillColor);
                }
                DrawGLLine(chart.x, py, chart.xMax, py, lineColor);
            }
        }

        // ── GL Primitives ──

        private static void DrawQuad(Rect r, Color c)
        {
            GL.Begin(GL.QUADS);
            GL.Color(c);
            GL.Vertex3(r.x, r.y, 0);
            GL.Vertex3(r.xMax, r.y, 0);
            GL.Vertex3(r.xMax, r.yMax, 0);
            GL.Vertex3(r.x, r.yMax, 0);
            GL.End();
        }

        private static void DrawGLLine(float x0, float y0, float x1, float y1, Color c)
        {
            GL.Begin(GL.LINES);
            GL.Color(c);
            GL.Vertex3(x0, y0, 0);
            GL.Vertex3(x1, y1, 0);
            GL.End();
        }

        private static void DrawHLine(float x0, float x1, float y, Color c)
        {
            DrawGLLine(x0, y, x1, y, c);
        }

        private static void DrawVLine(float x, float y0, float y1, Color c)
        {
            DrawGLLine(x, y0, x, y1, c);
        }

        // ── Coordinate Mapping ──

        private static float XMap(float time, float tStart, float tEnd, Rect chart)
        {
            float t = (time - tStart) / (tEnd - tStart);
            return chart.x + Mathf.Clamp01(t) * chart.width;
        }

        private static float YMap(float value, float maxY, Rect chart)
        {
            float t = Mathf.Clamp01(value / maxY);
            return chart.yMax - t * chart.height;
        }
    }
}
#endif
