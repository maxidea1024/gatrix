// GatrixPrefabCreator - Menu items to quickly create pre-configured Gatrix objects in the scene
// This provides the "prefabs" functionality in a more robust way for the user.

#if UNITY_EDITOR
using UnityEditor;
using UnityEngine;
using UnityEngine.UI;
using UnityEngine.EventSystems;

namespace Gatrix.Unity.SDK.Editor
{
    public static class GatrixPrefabCreator
    {
        private const string RootMenu = "GameObject/Gatrix/";

        [MenuItem(RootMenu + "SDK Manager", false, 0)]
        public static void CreateSDKManager(MenuCommand menuCommand)
        {
            GameObject go = new GameObject("GatrixSDK");
            go.AddComponent<GatrixBehaviour>();
            go.AddComponent<GatrixEventListener>();
            
            GameObjectUtility.SetParentAndAlign(go, menuCommand.context as GameObject);
            Undo.RegisterCreatedObjectUndo(go, "Create Gatrix SDK Manager");
            Selection.activeObject = go;
        }

        [MenuItem(RootMenu + "UI/Flag Text (Legacy)", false, 10)]
        public static void CreateFlagText(MenuCommand menuCommand)
        {
            GameObject go = CreateUIObject("FlagText", menuCommand);
            var text = go.AddComponent<Text>();
            text.text = "Feature Flag Value";
            text.alignment = TextAnchor.MiddleCenter;
            text.color = Color.white;
            
            var flagValue = go.AddComponent<GatrixFlagValue>();
            
            Selection.activeObject = go;
        }

        [MenuItem(RootMenu + "UI/Flag Image", false, 11)]
        public static void CreateFlagImage(MenuCommand menuCommand)
        {
            GameObject go = CreateUIObject("FlagImage", menuCommand);
            go.AddComponent<Image>();
            go.AddComponent<GatrixFlagImage>();
            
            Selection.activeObject = go;
        }

        [MenuItem(RootMenu + "Logic/Flag Toggle", false, 20)]
        public static void CreateFlagToggle(MenuCommand menuCommand)
        {
            GameObject go = new GameObject("FlagToggle");
            go.AddComponent<GatrixFlagToggle>();
            
            GameObjectUtility.SetParentAndAlign(go, menuCommand.context as GameObject);
            Undo.RegisterCreatedObjectUndo(go, "Create Flag Toggle");
            Selection.activeObject = go;
        }

        [MenuItem(RootMenu + "Logic/Variant Switch", false, 21)]
        public static void CreateVariantSwitch(MenuCommand menuCommand)
        {
            GameObject go = new GameObject("VariantSwitch");
            go.AddComponent<GatrixVariantSwitch>();
            
            GameObjectUtility.SetParentAndAlign(go, menuCommand.context as GameObject);
            Undo.RegisterCreatedObjectUndo(go, "Create Variant Switch");
            Selection.activeObject = go;
        }

        [MenuItem(RootMenu + "Debug/Flag Logger", false, 30)]
        public static void CreateFlagLogger(MenuCommand menuCommand)
        {
            GameObject go = new GameObject("FlagLogger");
            go.AddComponent<GatrixFlagLogger>();
            
            GameObjectUtility.SetParentAndAlign(go, menuCommand.context as GameObject);
            Undo.RegisterCreatedObjectUndo(go, "Create Flag Logger");
            Selection.activeObject = go;
        }

        private static GameObject CreateUIObject(string name, MenuCommand menuCommand)
        {
            GameObject go = new GameObject(name);
            RectTransform rect = go.AddComponent<RectTransform>();
            rect.sizeDelta = new Vector2(200, 50);

            GameObject parent = menuCommand.context as GameObject;
            if (parent == null || parent.GetComponentInParent<Canvas>() == null)
            {
                parent = EnsureCanvasExists();
            }

            GameObjectUtility.SetParentAndAlign(go, parent);
            Undo.RegisterCreatedObjectUndo(go, "Create " + name);
            return go;
        }

        private static GameObject EnsureCanvasExists()
        {
#if UNITY_2023_1_OR_NEWER
            Canvas canvas = Object.FindFirstObjectByType<Canvas>();
#else
            Canvas canvas = Object.FindObjectOfType<Canvas>();
#endif
            if (canvas != null) return canvas.gameObject;

            GameObject canvasGo = new GameObject("Canvas");
            canvasGo.layer = LayerMask.NameToLayer("UI");
            canvas = canvasGo.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvasGo.AddComponent<CanvasScaler>();
            canvasGo.AddComponent<GraphicRaycaster>();
            Undo.RegisterCreatedObjectUndo(canvasGo, "Create Canvas");

#if UNITY_2023_1_OR_NEWER
            if (Object.FindFirstObjectByType<EventSystem>() == null)
#else
            if (Object.FindObjectOfType<EventSystem>() == null)
#endif
            {
                GameObject esGo = new GameObject("EventSystem");
                esGo.AddComponent<EventSystem>();
                esGo.AddComponent<StandaloneInputModule>();
                Undo.RegisterCreatedObjectUndo(esGo, "Create EventSystem");
            }

            return canvasGo;
        }
    }
}
#endif
