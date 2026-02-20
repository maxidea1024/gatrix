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

        [MenuItem(RootMenu + "UI/Flag Text", false, 9)]
        public static void CreateFlagTextTmp(MenuCommand menuCommand)
        {
            GameObject go = CreateUIObject("FlagText", menuCommand);

            // Prefer TextMeshProUGUI if TMP is installed; fall back to Legacy Text
            var tmpType = System.Type.GetType("TMPro.TextMeshProUGUI, Unity.TextMeshPro");
            if (tmpType != null)
            {
                var tmp = go.AddComponent(tmpType) as Behaviour;
                // Set default text via reflection
                var textProp = tmpType.GetProperty("text");
                textProp?.SetValue(tmp, "Feature Flag Value");
                var alignProp = tmpType.GetProperty("alignment");
                if (alignProp != null)
                {
                    // TextAlignmentOptions.Center = 2
                    alignProp.SetValue(tmp, System.Enum.ToObject(alignProp.PropertyType, 2));
                }
            }
            else
            {
                // TMP not installed — use Legacy Text
                var text = go.AddComponent<Text>();
                text.text = "Feature Flag Value";
                text.alignment = TextAnchor.MiddleCenter;
                text.color = Color.white;
            }

            go.AddComponent<GatrixFlagValue>();
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
            
            go.AddComponent<GatrixFlagValue>();
            
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

        [MenuItem(RootMenu + "Audio & Animation/Flag Audio Mixer", false, 52)]
        public static void CreateFlagAudioMixer(MenuCommand menuCommand)
        {
            GameObject go = new GameObject("FlagAudioMixer");
            go.AddComponent<GatrixFlagAudioMixer>();

            GameObjectUtility.SetParentAndAlign(go, menuCommand.context as GameObject);
            Undo.RegisterCreatedObjectUndo(go, "Create Flag Audio Mixer");
            Selection.activeObject = go;
        }

        [MenuItem(RootMenu + "Audio & Animation/Flag AI Animator", false, 53)]
        public static void CreateFlagAIAnimator(MenuCommand menuCommand)
        {
            GameObject go = new GameObject("FlagAIAnimator");
            go.AddComponent<Animator>();
            go.AddComponent<GatrixFlagAIAnimator>();

            GameObjectUtility.SetParentAndAlign(go, menuCommand.context as GameObject);
            Undo.RegisterCreatedObjectUndo(go, "Create Flag AI Animator");
            Selection.activeObject = go;
        }

        // ── Lighting ──

        [MenuItem(RootMenu + "Lighting/Flag Light", false, 60)]
        public static void CreateFlagLight(MenuCommand menuCommand)
        {
            GameObject go = new GameObject("FlagLight");
            go.AddComponent<Light>();
            go.AddComponent<GatrixFlagLight>();

            GameObjectUtility.SetParentAndAlign(go, menuCommand.context as GameObject);
            Undo.RegisterCreatedObjectUndo(go, "Create Flag Light");
            Selection.activeObject = go;
        }

        // ── Camera ──

        [MenuItem(RootMenu + "Camera/Flag Camera", false, 70)]
        public static void CreateFlagCamera(MenuCommand menuCommand)
        {
            GameObject go = new GameObject("FlagCamera");
            go.AddComponent<Camera>();
            go.AddComponent<GatrixFlagCamera>();

            GameObjectUtility.SetParentAndAlign(go, menuCommand.context as GameObject);
            Undo.RegisterCreatedObjectUndo(go, "Create Flag Camera");
            Selection.activeObject = go;
        }

        // ── Physics ──

        [MenuItem(RootMenu + "Physics/Flag Rigidbody", false, 80)]
        public static void CreateFlagRigidbody(MenuCommand menuCommand)
        {
            GameObject go = new GameObject("FlagRigidbody");
            go.AddComponent<Rigidbody>();
            go.AddComponent<GatrixFlagRigidbody>();

            GameObjectUtility.SetParentAndAlign(go, menuCommand.context as GameObject);
            Undo.RegisterCreatedObjectUndo(go, "Create Flag Rigidbody");
            Selection.activeObject = go;
        }

        [MenuItem(RootMenu + "Physics/Flag Gravity", false, 81)]
        public static void CreateFlagGravity(MenuCommand menuCommand)
        {
            GameObject go = new GameObject("FlagGravity");
            go.AddComponent<GatrixFlagGravity>();

            GameObjectUtility.SetParentAndAlign(go, menuCommand.context as GameObject);
            Undo.RegisterCreatedObjectUndo(go, "Create Flag Gravity");
            Selection.activeObject = go;
        }

        [MenuItem(RootMenu + "Physics/Flag Collider", false, 82)]
        public static void CreateFlagCollider(MenuCommand menuCommand)
        {
            GameObject go = new GameObject("FlagCollider");
            go.AddComponent<BoxCollider>();
            go.AddComponent<GatrixFlagCollider>();

            GameObjectUtility.SetParentAndAlign(go, menuCommand.context as GameObject);
            Undo.RegisterCreatedObjectUndo(go, "Create Flag Collider");
            Selection.activeObject = go;
        }

        [MenuItem(RootMenu + "Physics/Flag Renderer Toggle", false, 83)]
        public static void CreateFlagRendererToggle(MenuCommand menuCommand)
        {
            GameObject go = new GameObject("FlagRendererToggle");
            go.AddComponent<MeshRenderer>();
            go.AddComponent<GatrixFlagRendererToggle>();

            GameObjectUtility.SetParentAndAlign(go, menuCommand.context as GameObject);
            Undo.RegisterCreatedObjectUndo(go, "Create Flag Renderer Toggle");
            Selection.activeObject = go;
        }

        // ── 2D ──

        [MenuItem(RootMenu + "2D/Flag Sprite Renderer", false, 90)]
        public static void CreateFlagSpriteRenderer(MenuCommand menuCommand)
        {
            GameObject go = new GameObject("FlagSpriteRenderer");
            go.AddComponent<SpriteRenderer>();
            go.AddComponent<GatrixFlagSpriteRenderer>();

            GameObjectUtility.SetParentAndAlign(go, menuCommand.context as GameObject);
            Undo.RegisterCreatedObjectUndo(go, "Create Flag Sprite Renderer");
            Selection.activeObject = go;
        }

        [MenuItem(RootMenu + "2D/Flag Rigidbody 2D", false, 91)]
        public static void CreateFlagRigidbody2D(MenuCommand menuCommand)
        {
            GameObject go = new GameObject("FlagRigidbody2D");
            go.AddComponent<Rigidbody2D>();
            go.AddComponent<GatrixFlagRigidbody2D>();

            GameObjectUtility.SetParentAndAlign(go, menuCommand.context as GameObject);
            Undo.RegisterCreatedObjectUndo(go, "Create Flag Rigidbody 2D");
            Selection.activeObject = go;
        }

        [MenuItem(RootMenu + "2D/Flag Sorting Order", false, 92)]
        public static void CreateFlagSortingOrder(MenuCommand menuCommand)
        {
            GameObject go = new GameObject("FlagSortingOrder");
            go.AddComponent<SpriteRenderer>();
            go.AddComponent<GatrixFlagSortingOrder>();

            GameObjectUtility.SetParentAndAlign(go, menuCommand.context as GameObject);
            Undo.RegisterCreatedObjectUndo(go, "Create Flag Sorting Order");
            Selection.activeObject = go;
        }

        [MenuItem(RootMenu + "2D/Flag Joint 2D", false, 93)]
        public static void CreateFlagJoint2D(MenuCommand menuCommand)
        {
            GameObject go = new GameObject("FlagJoint2D");
            go.AddComponent<Rigidbody2D>();
            go.AddComponent<HingeJoint2D>();
            go.AddComponent<GatrixFlagJoint2D>();

            GameObjectUtility.SetParentAndAlign(go, menuCommand.context as GameObject);
            Undo.RegisterCreatedObjectUndo(go, "Create Flag Joint 2D");
            Selection.activeObject = go;
        }

        [MenuItem(RootMenu + "2D/Flag Effector 2D", false, 94)]
        public static void CreateFlagEffector2D(MenuCommand menuCommand)
        {
            GameObject go = new GameObject("FlagEffector2D");
            go.AddComponent<Collider2D>();
            go.AddComponent<AreaEffector2D>();
            go.AddComponent<GatrixFlagEffector2D>();

            GameObjectUtility.SetParentAndAlign(go, menuCommand.context as GameObject);
            Undo.RegisterCreatedObjectUndo(go, "Create Flag Effector 2D");
            Selection.activeObject = go;
        }

        // ── Navigation / AI ──

        [MenuItem(RootMenu + "Navigation & AI/Flag NavMesh Agent", false, 100)]
        public static void CreateFlagNavMeshAgent(MenuCommand menuCommand)
        {
            GameObject go = new GameObject("FlagNavMeshAgent");
            go.AddComponent<GatrixFlagNavMeshAgent>();

            GameObjectUtility.SetParentAndAlign(go, menuCommand.context as GameObject);
            Undo.RegisterCreatedObjectUndo(go, "Create Flag NavMesh Agent");
            Selection.activeObject = go;
        }

        [MenuItem(RootMenu + "Navigation & AI/Flag NavMesh Obstacle", false, 101)]
        public static void CreateFlagNavMeshObstacle(MenuCommand menuCommand)
        {
            GameObject go = new GameObject("FlagNavMeshObstacle");
            go.AddComponent<GatrixFlagNavMeshObstacle>();

            GameObjectUtility.SetParentAndAlign(go, menuCommand.context as GameObject);
            Undo.RegisterCreatedObjectUndo(go, "Create Flag NavMesh Obstacle");
            Selection.activeObject = go;
        }

        [MenuItem(RootMenu + "Navigation & AI/Flag Detection Range", false, 102)]
        public static void CreateFlagDetectionRange(MenuCommand menuCommand)
        {
            GameObject go = new GameObject("FlagDetectionRange");
            go.AddComponent<GatrixFlagDetectionRange>();

            GameObjectUtility.SetParentAndAlign(go, menuCommand.context as GameObject);
            Undo.RegisterCreatedObjectUndo(go, "Create Flag Detection Range");
            Selection.activeObject = go;
        }

        // ── Environment ──

        [MenuItem(RootMenu + "Environment/Flag Fog", false, 110)]
        public static void CreateFlagFog(MenuCommand menuCommand)
        {
            GameObject go = new GameObject("FlagFog");
            go.AddComponent<GatrixFlagFog>();

            GameObjectUtility.SetParentAndAlign(go, menuCommand.context as GameObject);
            Undo.RegisterCreatedObjectUndo(go, "Create Flag Fog");
            Selection.activeObject = go;
        }

        [MenuItem(RootMenu + "Environment/Flag Ambient Light", false, 111)]
        public static void CreateFlagAmbientLight(MenuCommand menuCommand)
        {
            GameObject go = new GameObject("FlagAmbientLight");
            go.AddComponent<GatrixFlagAmbientLight>();

            GameObjectUtility.SetParentAndAlign(go, menuCommand.context as GameObject);
            Undo.RegisterCreatedObjectUndo(go, "Create Flag Ambient Light");
            Selection.activeObject = go;
        }

        [MenuItem(RootMenu + "Environment/Flag Skybox", false, 112)]
        public static void CreateFlagSkybox(MenuCommand menuCommand)
        {
            GameObject go = new GameObject("FlagSkybox");
            go.AddComponent<GatrixFlagSkybox>();

            GameObjectUtility.SetParentAndAlign(go, menuCommand.context as GameObject);
            Undo.RegisterCreatedObjectUndo(go, "Create Flag Skybox");
            Selection.activeObject = go;
        }

        // ── Time ──

        [MenuItem(RootMenu + "Time/Flag Time Scale", false, 120)]
        public static void CreateFlagTimeScale(MenuCommand menuCommand)
        {
            GameObject go = new GameObject("FlagTimeScale");
            go.AddComponent<GatrixFlagTimeScale>();

            GameObjectUtility.SetParentAndAlign(go, menuCommand.context as GameObject);
            Undo.RegisterCreatedObjectUndo(go, "Create Flag Time Scale");
            Selection.activeObject = go;
        }

        [MenuItem(RootMenu + "Time/Flag Frame Rate", false, 121)]
        public static void CreateFlagFrameRate(MenuCommand menuCommand)
        {
            GameObject go = new GameObject("FlagFrameRate");
            go.AddComponent<GatrixFlagFrameRate>();

            GameObjectUtility.SetParentAndAlign(go, menuCommand.context as GameObject);
            Undo.RegisterCreatedObjectUndo(go, "Create Flag Frame Rate");
            Selection.activeObject = go;
        }

        // ── Post FX ──

        [MenuItem(RootMenu + "PostFX/Flag Post Process Volume", false, 130)]
        public static void CreateFlagPostProcessVolume(MenuCommand menuCommand)
        {
            GameObject go = new GameObject("FlagPostProcessVolume");
            go.AddComponent<GatrixFlagPostProcessVolume>();

            GameObjectUtility.SetParentAndAlign(go, menuCommand.context as GameObject);
            Undo.RegisterCreatedObjectUndo(go, "Create Flag Post Process Volume");
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
