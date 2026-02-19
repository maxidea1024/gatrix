// GatrixPackageExporter - Export Gatrix SDK as a .unitypackage
// Accessible from Window > Gatrix > Export Package

#if UNITY_EDITOR
using System.IO;
using UnityEditor;
using UnityEngine;
using Gatrix.Unity.SDK;

namespace Gatrix.Unity.SDK.Editor
{
    public static class GatrixPackageExporter
    {
        [MenuItem("Window/Gatrix/Export Package", priority = 50)]
        public static void ExportPackage()
        {
            string pluginRoot = "";

            // 1. Check standard known paths first
            string[] standardPaths = {
                "Assets/Plugins/Gatrix",
                "Packages/com.gatrix.unity.sdk"
            };

            foreach (var path in standardPaths)
            {
                if (AssetDatabase.IsValidFolder(path))
                {
                    pluginRoot = path;
                    break;
                }
            }

            // 2. If not found, try to find by script location (in case of custom folders)
            if (string.IsNullOrEmpty(pluginRoot))
            {
                string[] guids = AssetDatabase.FindAssets("GatrixPackageExporter t:Script");
                if (guids.Length > 0)
                {
                    string scriptPath = AssetDatabase.GUIDToAssetPath(guids[0]);
                    // Expected: .../Gatrix/Editor/GatrixPackageExporter.cs
                    // Go up two levels to get the root
                    string[] parts = scriptPath.Split('/');
                    if (parts.Length >= 3)
                    {
                        pluginRoot = string.Join("/", parts, 0, parts.Length - 2);
                    }
                }
            }

            // 3. Final validation
            if (string.IsNullOrEmpty(pluginRoot) || !AssetDatabase.IsValidFolder(pluginRoot))
            {
                Debug.LogError("[Gatrix] Could not find SDK root folder. Please ensure the SDK is in Assets/Plugins/Gatrix or properly installed as a package.");
                return;
            }

            Debug.Log($"[Gatrix] Exporting SDK from: {pluginRoot}");

            var version = SdkInfo.Version;
            var defaultFileName = $"gatrix-unity-sdk-{version}.unitypackage";

            // Open save panel on Desktop or project root
            string defaultDir = System.Environment.GetFolderPath(System.Environment.SpecialFolder.Desktop);
            if (string.IsNullOrEmpty(defaultDir)) defaultDir = Application.dataPath;

            var savePath = EditorUtility.SaveFilePanel(
                "Export Gatrix SDK Package",
                defaultDir,
                defaultFileName,
                "unitypackage");

            if (string.IsNullOrEmpty(savePath)) return; // User cancelled

            AssetDatabase.ExportPackage(
                pluginRoot,
                savePath,
                ExportPackageOptions.Recurse);

            Debug.Log($"[Gatrix] SDK v{version} exported successfully to: {savePath}");
            EditorUtility.RevealInFinder(savePath);
        }
    }
}
#endif
