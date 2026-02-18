using UnityEngine;
#if UNITY_EDITOR
using UnityEditor;
#endif

namespace EmeraldAI
{
#if UNITY_EDITOR
    [CanEditMultipleObjects]
#endif
    [RequireComponent(typeof(SphereCollider))]
    public class CoverNode : MonoBehaviour
    {
        public CoverTypes CoverType = CoverTypes.CrouchAndPeak;
        public YesOrNo GetLineOfSightPosition = YesOrNo.No;

        [Range(60, 180)]
        public int CoverAngleLimit = 180;
        public Color ArrowColor = Color.red;
        public Color NodeColor = new Color32(0, 224, 9, 154);
        public bool IsOccupied;
        public Transform Occupant;

        public bool SettingsFoldout;
        public bool HideSettingsFoldout;
        SphereCollider NodeCollider;
        AnimationCurve curvature = new AnimationCurve(new Keyframe(0, 0), new Keyframe(1, 1));

        public void SetOccupant(Transform occupant)
        {
            Occupant = occupant;
            IsOccupied = true;
        }

        public void ClearOccupant()
        {
            Occupant = null;
            IsOccupied = false;
        }

#if UNITY_EDITOR
        void OnDrawGizmosSelected()
        {
            DrawFieldOfView();
        }

        void OnDrawGizmos()
        {
            DrawNode();

            if (NodeCollider == null) NodeCollider = GetComponent<SphereCollider>();

            NodeCollider.radius = 0.05f;
            NodeCollider.isTrigger = true;

            DrawArrow();

            if (CoverType == CoverTypes.CrouchAndPeak) DrawCrouchAndPeakGizmo();
            else if (CoverType == CoverTypes.CrouchOnce) DrawCrouchOnceGizmo();
            else if (CoverType == CoverTypes.Stand) DrawStandGizmo();

            Gizmos.color = NodeColor;
            Gizmos.matrix = Matrix4x4.TRS(transform.TransformPoint(NodeCollider.center), transform.rotation, transform.lossyScale);
        }

        void DrawFieldOfView()
        {
            float CircleSize = 1;

            //Red areas not covered by the line of sight, but the areas in green are.
            Handles.color = new Color(0, 0.75f, 0, 1f);
            Handles.DrawWireArc(transform.position, transform.up, transform.forward, (float)CoverAngleLimit / 2f, CircleSize, 2f);
            Handles.DrawWireArc(transform.position, transform.up, transform.forward, -(float)CoverAngleLimit / 2f, CircleSize, 2f);

            Handles.color = Color.red;
            Handles.DrawWireArc(transform.position, transform.up, -transform.forward, (360 - CoverAngleLimit) / 2f, CircleSize, 2f);
            Handles.DrawWireArc(transform.position, transform.up, -transform.forward, -(360 - CoverAngleLimit) / 2f, CircleSize, 2f);

            Vector3 viewAngleA = DirFromAngle(transform, -CoverAngleLimit / 2f, false);
            Vector3 viewAngleB = DirFromAngle(transform, CoverAngleLimit / 2f, false);

            Handles.color = new Color(1, 0, 0, 1f);
            if (CoverAngleLimit < 360)
            {
                Handles.DrawLine(transform.position, transform.position + viewAngleA * CircleSize, 2f);
                Handles.DrawLine(transform.position, transform.position + viewAngleB * CircleSize, 2f);
            }
            Handles.color = Color.white;
        }

        Vector3 DirFromAngle(Transform transform, float angleInDegrees, bool angleIsGlobal)
        {
            if (!angleIsGlobal)
                angleInDegrees += transform.eulerAngles.y;
            return transform.rotation * Quaternion.Euler(new Vector3(0, -transform.eulerAngles.y, 0)) * new Vector3(Mathf.Sin(angleInDegrees * Mathf.Deg2Rad), 0, Mathf.Cos(angleInDegrees * Mathf.Deg2Rad));
        }

        void DrawArrow()
        {
            Color arrowColor = Color.red;
            float arrowLength = 0.55f;
            float arrowHeadLength = 0.15f;
            float arrowHeadAngle = 20.0f;

            Gizmos.color = arrowColor;

            Vector3 NodeHeight = transform.position + transform.forward * 0.2f;

            //Draw the main line of the arrow
            Vector3 endPosition = NodeHeight + transform.forward.normalized * arrowLength;
            Handles.DrawLine(NodeHeight, endPosition, 4f);

            //Calculate the right and left direction for the arrowhead
            Vector3 right = Quaternion.LookRotation(transform.forward) * Quaternion.Euler(0, 180 + arrowHeadAngle, 0) * Vector3.forward;
            Vector3 left = Quaternion.LookRotation(transform.forward) * Quaternion.Euler(0, 180 - arrowHeadAngle, 0) * Vector3.forward;

            //Draw the arrowhead
            Handles.DrawLine(endPosition, endPosition + right * arrowHeadLength, 4f);
            Handles.DrawLine(endPosition, endPosition + left * arrowHeadLength, 4f);
        }

        void DrawCrouchOnceGizmo()
        {
            float arrowLength = 0.55f;
            float arrowHeadLength = 0.2f;
            float arrowHeadAngle = 20.0f;
            int curveResolution = 20;
            Gizmos.color = Color.yellow;

            Vector3 startPosition = transform.position + transform.forward * 0.55f + transform.up * 0.3f;
            Vector3 forward = -transform.forward;
            Vector3 curveDir = transform.up;

            float radius = arrowLength;

            Vector3[] points = new Vector3[curveResolution + 1];

            for (int i = 0; i <= curveResolution; i++)
            {
                float t = (float)i / curveResolution;
                float angle = (Mathf.PI / 2) * curvature.Evaluate(t);
                Vector3 point = startPosition + forward * radius * Mathf.Cos(angle) + curveDir * radius * Mathf.Sin(angle);
                points[i] = point;
            }

            //Draw the curve
            Handles.color = ArrowColor;
            Handles.DrawAAPolyLine(5f, points);

            //Draw the arrowhead
            Vector3 endPosition = points[curveResolution];

            Vector3 endDirection = (points[curveResolution] - points[curveResolution - 1]).normalized;
            Vector3 normal = Vector3.Cross(endDirection, transform.right).normalized;

            //Calculate the arrowhead lines
            Vector3 right = Quaternion.AngleAxis(arrowHeadAngle, normal) * -endDirection;
            Vector3 left = Quaternion.AngleAxis(-arrowHeadAngle, normal) * -endDirection;

            Handles.DrawLine(endPosition, endPosition + right * arrowHeadLength, 4f);
            Handles.DrawLine(endPosition, endPosition + left * arrowHeadLength, 4f);

            //X
            Vector3 rightDir = transform.right;
            Vector3 forwardDir = transform.forward;
            float xSize = 0.1f;

            Vector3 topLeft = transform.position + transform.up * 0.3f + (rightDir * -xSize) + (forwardDir * xSize);
            Vector3 bottomRight = transform.position + transform.up * 0.3f + (rightDir * xSize) + (forwardDir * -xSize);

            Vector3 topRight = transform.position + transform.up * 0.3f + (rightDir * xSize) + (forwardDir * xSize);
            Vector3 bottomLeft = transform.position + transform.up * 0.3f + (rightDir * -xSize) + (forwardDir * -xSize);

            Handles.DrawLine(topLeft, bottomRight, 4f);
            Handles.DrawLine(topRight, bottomLeft, 4f);
            //X
        }

        void DrawCrouchAndPeakGizmo()
        {
            float arrowLength = 0.55f;
            float arrowHeadLength = 0.2f;
            float arrowHeadAngle = 20.0f;
            int curveResolution = 20;
            Gizmos.color = Color.yellow;

            Vector3 startPosition = transform.position + transform.forward * 0.55f + transform.up * 0.3f;
            Vector3 forward = -transform.forward;
            Vector3 curveDir = transform.up;
            float radius = arrowLength;

            Vector3[] points = new Vector3[curveResolution + 1];

            for (int i = 0; i <= curveResolution; i++)
            {
                float t = (float)i / curveResolution;
                float angle = (Mathf.PI / 2) * curvature.Evaluate(t);
                Vector3 point = startPosition + forward * radius * Mathf.Cos(angle)
                                              + curveDir * radius * Mathf.Sin(angle);
                points[i] = point;
            }

            //Draw the curve
            Handles.color = ArrowColor;
            Handles.DrawAAPolyLine(5f, points);

            //Draw the arrowhead
            Vector3 endPosition = points[curveResolution];
            Vector3 endDirection = (points[curveResolution] - points[curveResolution - 1]).normalized;
            Vector3 endNormal = Vector3.Cross(endDirection, transform.right).normalized;
            Vector3 endRight = Quaternion.AngleAxis(arrowHeadAngle, endNormal) * -endDirection;
            Vector3 endLeft = Quaternion.AngleAxis(-arrowHeadAngle, endNormal) * -endDirection;

            Handles.DrawLine(endPosition, endPosition + endRight * arrowHeadLength, 4f);
            Handles.DrawLine(endPosition, endPosition + endLeft * arrowHeadLength, 4f);

            Vector3 startCurvePos = points[0];
            Vector3 startDirection = (points[1] - points[0]).normalized;
            Vector3 startNormal = Vector3.Cross(startDirection, transform.right).normalized;

            //Calculate the arrowhead lines
            Vector3 startRight = Quaternion.AngleAxis(arrowHeadAngle, startNormal) * startDirection;
            Vector3 startLeft = Quaternion.AngleAxis(-arrowHeadAngle, startNormal) * startDirection;

            Handles.DrawLine(startCurvePos, startCurvePos + startRight * arrowHeadLength, 4f);
            Handles.DrawLine(startCurvePos, startCurvePos + startLeft * arrowHeadLength, 4f);
        }


        void DrawStandGizmo()
        {
            float lineLength = 0.75f;
            float xSize = 0.1f;

            Gizmos.color = ArrowColor;
            Handles.color = ArrowColor;

            Vector3 startPosition = transform.position + transform.up * 0.3f;
            Vector3 endPosition = startPosition + transform.up * lineLength;

            Handles.DrawAAPolyLine(5f, new Vector3[] { startPosition, endPosition });

            Vector3 rightDir = transform.right;
            Vector3 forwardDir = transform.forward;

            Vector3 topLeft = startPosition + (rightDir * -xSize) + (forwardDir * xSize);
            Vector3 bottomRight = startPosition + (rightDir * xSize) + (forwardDir * -xSize);

            Vector3 topRight = startPosition + (rightDir * xSize) + (forwardDir * xSize);
            Vector3 bottomLeft = startPosition + (rightDir * -xSize) + (forwardDir * -xSize);

            Handles.DrawLine(topLeft, bottomRight, 4f);
            Handles.DrawLine(topRight, bottomLeft, 4f);

            float arrowHeadLength = 0.2f;
            float arrowHeadAngle = 25f;

            Vector3 arrowDir = transform.up;

            Vector3 arrowNormal = Vector3.Cross(arrowDir, transform.right).normalized;

            Vector3 arrowRight = Quaternion.AngleAxis(+arrowHeadAngle, arrowNormal) * -arrowDir;
            Vector3 arrowLeft = Quaternion.AngleAxis(-arrowHeadAngle, arrowNormal) * -arrowDir;

            Handles.DrawLine(endPosition, endPosition + arrowRight * arrowHeadLength, 4f);
            Handles.DrawLine(endPosition, endPosition + arrowLeft * arrowHeadLength, 4f);
        }


        void DrawNode ()
        {
            Gizmos.color = NodeColor;
            Gizmos.DrawSphere(transform.position, 0.2f);
        }
#endif
    }
}