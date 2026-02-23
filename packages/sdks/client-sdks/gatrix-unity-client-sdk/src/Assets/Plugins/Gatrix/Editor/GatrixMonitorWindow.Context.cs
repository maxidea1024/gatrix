// GatrixMonitorWindow - Context tab
// Displays current evaluation context including system fields and custom properties

#if UNITY_EDITOR
using UnityEditor;

namespace Gatrix.Unity.SDK.Editor
{
    public partial class GatrixMonitorWindow
    {
        // ==================== Context ====================

        private void DrawContextTab()
        {
            if (_cachedContext == null)
            {
                GatrixEditorStyle.DrawHelpBox("No context loaded.", MessageType.Info);
                return;
            }

            GatrixEditorStyle.DrawSection("System Fields");
            GatrixEditorStyle.BeginBox();
            DrawField("AppName", _cachedContext.AppName ?? "-");
            DrawField("Environment", _cachedContext.Environment ?? "-");
            GatrixEditorStyle.EndBox();

            GatrixEditorStyle.DrawSection("Context Fields");
            GatrixEditorStyle.BeginBox();
            DrawField("UserId", _cachedContext.UserId ?? "-");
            DrawField("SessionId", _cachedContext.SessionId ?? "-");
            DrawField("CurrentTime", _cachedContext.CurrentTime ?? "-");
            GatrixEditorStyle.EndBox();

            if (_cachedContext.Properties != null && _cachedContext.Properties.Count > 0)
            {
                GatrixEditorStyle.DrawSection("Custom Properties");
                GatrixEditorStyle.BeginBox();
                foreach (var kvp in _cachedContext.Properties)
                {
                    DrawField(kvp.Key, kvp.Value?.ToString() ?? "null");
                }
                GatrixEditorStyle.EndBox();
            }
        }
    }
}
#endif
