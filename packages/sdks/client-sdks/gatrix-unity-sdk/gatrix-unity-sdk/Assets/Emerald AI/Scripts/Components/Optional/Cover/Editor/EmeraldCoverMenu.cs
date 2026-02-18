using UnityEditor;
using UnityEngine;

namespace EmeraldAI.Utility
{
    /// <summary>
    /// This allows the creation of Cover Nodes both through a menu and through right clicking within the hierarchy. 
    /// </summary>
    public static class EmeraldCoverMenu
    {
        [MenuItem("GameObject/Emerald AI/Create Cover Node", false, 1)]
        private static void CreateCustomObject(MenuCommand menuCommand)
        {
            GameObject coverNode = new GameObject("Emerald Cover Node");
            coverNode.AddComponent<CoverNode>();

            GameObject context = menuCommand.context as GameObject;
            if (context != null)
            {
                coverNode.transform.SetParent(context.transform);
                coverNode.transform.localPosition = Vector3.zero;
            }
            else
            {
                Camera sceneCamera = SceneView.lastActiveSceneView.camera;
                Vector3 spawnPosition = sceneCamera.transform.position + sceneCamera.transform.forward * 5f;
                coverNode.transform.position = spawnPosition;
            }

            Undo.RegisterCreatedObjectUndo(coverNode, "Create Cover Node");
            Selection.activeObject = coverNode;
        }
    }
}