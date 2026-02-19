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

        // ── UI Components ──

        [MenuItem(RootMenu + "UI/Flag Color", false, 12)]
        public static void CreateFlagColor(MenuCommand menuCommand)
        {
            GameObject go = CreateUIObject("FlagColor", menuCommand);
            go.AddComponent<GatrixFlagColor>();
            Selection.activeObject = go;
        }

        [MenuItem(RootMenu + "UI/Flag Canvas", false, 13)]
        public static void CreateFlagCanvas(MenuCommand menuCommand)
        {
            GameObject go = CreateUIObject("FlagCanvas", menuCommand);
            go.AddComponent<GatrixFlagCanvas>();
            Selection.activeObject = go;
        }

        // ── Visual Components ──

        [MenuItem(RootMenu + "Visual/Flag Material", false, 40)]
        public static void CreateFlagMaterial(MenuCommand menuCommand)
        {
            GameObject go = new GameObject("FlagMaterial");
            go.AddComponent<MeshRenderer>();
            go.AddComponent<GatrixFlagMaterial>();

            GameObjectUtility.SetParentAndAlign(go, menuCommand.context as GameObject);
            Undo.RegisterCreatedObjectUndo(go, "Create Flag Material");
            Selection.activeObject = go;
        }

        [MenuItem(RootMenu + "Visual/Flag Particles", false, 41)]
        public static void CreateFlagParticles(MenuCommand menuCommand)
        {
            GameObject go = new GameObject("FlagParticles");
            go.AddComponent<ParticleSystem>();
            go.AddComponent<GatrixFlagParticles>();

            GameObjectUtility.SetParentAndAlign(go, menuCommand.context as GameObject);
            Undo.RegisterCreatedObjectUndo(go, "Create Flag Particles");
            Selection.activeObject = go;
        }

        [MenuItem(RootMenu + "Visual/Flag Transform", false, 42)]
        public static void CreateFlagTransform(MenuCommand menuCommand)
        {
            GameObject go = new GameObject("FlagTransform");
            go.AddComponent<GatrixFlagTransform>();

            GameObjectUtility.SetParentAndAlign(go, menuCommand.context as GameObject);
            Undo.RegisterCreatedObjectUndo(go, "Create Flag Transform");
            Selection.activeObject = go;
        }

        // ── Logic Components ──

        [MenuItem(RootMenu + "Logic/Flag Event", false, 22)]
        public static void CreateFlagEvent(MenuCommand menuCommand)
        {
            GameObject go = new GameObject("FlagEvent");
            go.AddComponent<GatrixFlagEvent>();

            GameObjectUtility.SetParentAndAlign(go, menuCommand.context as GameObject);
            Undo.RegisterCreatedObjectUndo(go, "Create Flag Event");
            Selection.activeObject = go;
        }

        [MenuItem(RootMenu + "Logic/Event Listener", false, 23)]
        public static void CreateEventListener(MenuCommand menuCommand)
        {
            GameObject go = new GameObject("EventListener");
            go.AddComponent<GatrixEventListener>();

            GameObjectUtility.SetParentAndAlign(go, menuCommand.context as GameObject);
            Undo.RegisterCreatedObjectUndo(go, "Create Event Listener");
            Selection.activeObject = go;
        }

        [MenuItem(RootMenu + "Logic/Flag Scene Redirect", false, 24)]
        public static void CreateFlagSceneRedirect(MenuCommand menuCommand)
        {
            GameObject go = new GameObject("FlagSceneRedirect");
            go.AddComponent<GatrixFlagSceneRedirect>();

            GameObjectUtility.SetParentAndAlign(go, menuCommand.context as GameObject);
            Undo.RegisterCreatedObjectUndo(go, "Create Flag Scene Redirect");
            Selection.activeObject = go;
        }

        // ── Audio & Animation ──

        [MenuItem(RootMenu + "Audio & Animation/Flag Audio", false, 50)]
        public static void CreateFlagAudio(MenuCommand menuCommand)
        {
            GameObject go = new GameObject("FlagAudio");
            go.AddComponent<AudioSource>();
            go.AddComponent<GatrixFlagAudio>();

            GameObjectUtility.SetParentAndAlign(go, menuCommand.context as GameObject);
            Undo.RegisterCreatedObjectUndo(go, "Create Flag Audio");
            Selection.activeObject = go;
        }

        [MenuItem(RootMenu + "Audio & Animation/Flag Animator", false, 51)]
        public static void CreateFlagAnimator(MenuCommand menuCommand)
        {
            GameObject go = new GameObject("FlagAnimator");
            go.AddComponent<Animator>();
            go.AddComponent<GatrixFlagAnimator>();

            GameObjectUtility.SetParentAndAlign(go, menuCommand.context as GameObject);
            Undo.RegisterCreatedObjectUndo(go, "Create Flag Animator");
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
