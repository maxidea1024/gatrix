using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.AI;
using System.Linq;

namespace EmeraldAI
{
    /// <summary>
    /// Gives AI the ability to use Cover Nodes during combat.
    /// </summary>
    [HelpURL("https://black-horizon-studios.gitbook.io/emerald-ai-wiki/emerald-components-optional/cover-component")]
    public class EmeraldCover : MonoBehaviour
    {
        #region Cover Variables
        [Range(3f, 15f)]
        public float MinCoverDistance = 5f;
        [Range(5f, 30f)]
        public float MaxTravelDistance = 15f;
        [Range(8f, 40f)]
        public float CoverSearchRadius = 20f;
        public LayerMask CoverNodeLayerMask;
        public bool HasCover;

        //How long the AI stays hiding
        [Range(1, 10)]
        public float HideSecondsMin = 1.5f;
        [Range(1, 10)]
        public float HideSecondsMax = 3f;

        //How long the AI will attack when standing
        [Range(1, 15)]
        public float AttackSecondsMin = 2f;
        [Range(1, 15)]
        public float AttackSecondsMax = 4f;

        //How many times the AI will peak. After reaching 0, the AI will find another Cover Node.
        [Range(1, 10)]
        public int PeakTimesMin = 1;
        [Range(1, 10)]
        public int PeakTimesMax = 3;

        public enum CoverStates { Inactive, MovingToCover, Hiding, Peaking };
        public CoverStates CoverState;

        EmeraldSystem EmeraldComponent;
        Coroutine MovingToCoverCoroutine;
        Coroutine CoverStateCoroutine;
        float CheckForCoverTimer;
        float CheckForCoverSeconds;
        int maxConsideredCoverNodes = 6; //Number of closest Cover Nodes to consider 
        public CoverNode CurrentCoverNode = null; //To keep track of last used Cover Node
        public bool ConfirmInfoMessage = false;

        List<CoverNode> OccupiedCoverNodes = new List<CoverNode>();

        [SerializeField]
        List<CoverPointData> ValidCoverNodes = new List<CoverPointData>();
        private class CoverPointData
        {
            public CoverNode coverNode;
            public float distanceToAgent;
        }
        #endregion

        #region Editor Variables
        public bool HideSettingsFoldout;
        public bool SettingsFoldout;
        #endregion

        void Start()
        {
            InitializeCover();
        }

        ///<summary>
        ///Initialize the cover component.
        ///</summary>
        void InitializeCover()
        {
            EmeraldComponent = GetComponent<EmeraldSystem>();
            CheckForCoverSeconds = Random.Range(0.9f, 1.15f);
            EmeraldComponent.MovementComponent.OnBackup += CancelCover;
            EmeraldComponent.CombatComponent.OnKilledTarget += CancelCover;
            if (EmeraldComponent.MovementComponent.MovingTurnSpeedCombat < 500) EmeraldComponent.MovementComponent.MovingTurnSpeedCombat = 500;
        }

        ///<summary>
        ///Cancels the currently generated cover state. 
        ///</summary>
        void CancelCover ()
        {
            if (CoverStateCoroutine != null) StopCoroutine(CoverStateCoroutine);
            if (MovingToCoverCoroutine != null) StopCoroutine(MovingToCoverCoroutine);
            EmeraldComponent.MovementComponent.DefaultMovementPaused = false;
            EmeraldComponent.MovementComponent.LockTurning = false;
            EmeraldComponent.m_NavMeshAgent.stoppingDistance = EmeraldComponent.CombatComponent.AttackDistance;
            EmeraldComponent.AIAnimator.SetBool("Cover Active", false);
            HasCover = false;
            CoverState = CoverStates.Inactive;
            if (CurrentCoverNode != null)
            {
                CurrentCoverNode.ClearOccupant();
                CurrentCoverNode = null;
            }
        }

        void Update()
        {
            if (EmeraldComponent.CombatComponent.CombatState)
            {
                if (CoverState == CoverStates.Inactive)
                {
                    if (!HasCover && !EmeraldComponent.MovementComponent.DefaultMovementPaused)
                    {
                        CheckForCoverTimer += Time.deltaTime;

                        if (CheckForCoverTimer >= CheckForCoverSeconds)
                        {
                            FindCover();
                        }
                    }
                }

                //If at any point the AI dies, cancel cover.
                if (!EmeraldComponent.m_NavMeshAgent.enabled || EmeraldComponent.AnimationComponent.IsDead)
                {
                    CancelCover();
                }
            }
        }

        /// <summary>
        /// Finds a new Cover Node for the AI to move to. This also cancels all previous actions and movements so they don't interfere. 
        /// </summary>
        public void FindCover()
        {
            //Return if the CombatTarget is null (which can happen if the CombatTarget gets cleared rght before this function gets called).
            if (EmeraldComponent.CombatTarget == null) return;

            CoverState = CoverStates.Inactive;
            HasCover = false;
            CheckForCoverSeconds = Random.Range(0.9f, 1.15f);
            CheckForCoverTimer = 0;

            Transform coverNode = FindCoverNode();
            if (coverNode != null)
            {
                InitializeCoverNode(coverNode);
            } 
            else
            {
                //There are currently no free Cover Nodes. The AI will generate an unobstructed position to fire from or repeat its current node and try again soon.
                if (CurrentCoverNode != null)
                {
                    if (CurrentCoverNode.GetLineOfSightPosition == YesOrNo.No || 
                        CurrentCoverNode.GetLineOfSightPosition == YesOrNo.Yes && !EmeraldComponent.DetectionComponent.TargetObstructed)
                    {
                        InitializeCoverNode(CurrentCoverNode.transform);
                    }
                    else if (CurrentCoverNode.GetLineOfSightPosition == YesOrNo.Yes && EmeraldComponent.DetectionComponent.TargetObstructed)
                    {
                        Vector3 Destination = EmeraldAPI.Internal.FindUnobstructedPosition(EmeraldComponent);
                        StartCoroutine(Moving(Destination));
                    }
                }
            }
        }

        void InitializeCoverNode (Transform coverNode)
        {
            EmeraldComponent.CombatComponent.CancelAllCombatActions();
            EmeraldComponent.MovementComponent.StopBackingUp();
            EmeraldComponent.m_NavMeshAgent.stoppingDistance = 0.25f;

            if (MovingToCoverCoroutine != null) StopCoroutine(MovingToCoverCoroutine);
            EmeraldComponent.m_NavMeshAgent.ResetPath();
            EmeraldComponent.m_NavMeshAgent.SetDestination(coverNode.position);
            MovingToCoverCoroutine = StartCoroutine(MoveToCoverNode(coverNode.position));
        }

        /// <summary>
        /// Moves an AI to their currently picked Cover Node. Cancel if certain condiions are met.
        /// </summary>
        IEnumerator MoveToCoverNode(Vector3 Destination)
        {
            CoverState = CoverStates.MovingToCover;
            EmeraldComponent.MovementComponent.DefaultMovementPaused = true;
            EmeraldComponent.m_NavMeshAgent.stoppingDistance = 0.5f;
            EmeraldComponent.MovementComponent.LockTurning = false;
            yield return new WaitForSeconds(0.01f); //These brief pauses are needed to smooth out transitions

            //Only wait for has path if the destination is greater than 0.25f.
            if (Vector3.Distance(Destination, transform.position) > 0.25f) yield return new WaitUntil(() => EmeraldComponent.m_NavMeshAgent.hasPath);

            //Move to the Cover Node
            while (EmeraldComponent.m_NavMeshAgent.enabled && !EmeraldComponent.AnimationComponent.IsDead && EmeraldComponent.m_NavMeshAgent.remainingDistance >= 0.5f)
            {
                EmeraldComponent.m_NavMeshAgent.stoppingDistance = 0.5f;
                Vector3 Direction = new Vector3(EmeraldComponent.m_NavMeshAgent.steeringTarget.x, 0, EmeraldComponent.m_NavMeshAgent.steeringTarget.z) - new Vector3(EmeraldComponent.transform.position.x, 0, EmeraldComponent.transform.position.z);
                EmeraldComponent.MovementComponent.UpdateRotations(Direction);

                //If multiple AI happen to get the same waypoint, cancel cover.
                if (CurrentCoverNode != null && CurrentCoverNode.IsOccupied && CurrentCoverNode.Occupant != transform)
                {
                    CancelCover();
                }

                yield return null;
            }

            //yield return new WaitForSeconds(0.01f); //These brief pauses are needed to smooth out transitions

            //Lerps the AI near the Cover Node upon arrival to avoid overshooting or inaccurate cover.
            StartCoroutine(LerpToDestination(EmeraldComponent.m_NavMeshAgent.destination));

            yield return new WaitForSeconds(0.5f); //These brief pauses are needed to smooth out transitions

            bool AngleLimitMet = false;

            //Rotate towards the current target from the new Cover Node
            float t = 0;
            while (t < 2.5f && EmeraldComponent.CombatTarget != null && !AngleLimitMet)
            {
                t += Time.deltaTime;

                Vector3 Direction = new Vector3(EmeraldComponent.CombatTarget.position.x, 0, EmeraldComponent.CombatTarget.position.z) - new Vector3(EmeraldComponent.transform.position.x, 0, EmeraldComponent.transform.position.z);
                EmeraldComponent.MovementComponent.UpdateRotations(Direction);

                if (EmeraldComponent.CombatComponent.TargetAngle <= EmeraldComponent.MovementComponent.CombatAngleToTurn)
                {
                    AngleLimitMet = true;
                }

                yield return null;
            }

            yield return new WaitForSeconds(0.3f); //These brief pauses are needed to smooth out transitions

            EmeraldComponent.MovementComponent.LockTurning = false;

            if (CoverStateCoroutine != null) StopCoroutine(CoverStateCoroutine);

            if (CurrentCoverNode.CoverType == CoverTypes.CrouchAndPeak)
            {
                CoverStateCoroutine = StartCoroutine(HideAndPeak());
            }
            else
            {
                CoverStateCoroutine = StartCoroutine(HideAndAttack());
            }
        }

        /// <summary>
        /// Lerps the AI near the Cover Node upon arrival to avoid overshooting or inaccurate cover.
        /// </summary>
        IEnumerator LerpToDestination(Vector3 destination)
        {
            while (!EmeraldComponent.AnimationComponent.IsDead && Vector3.Distance(transform.position, destination) >= 0.15f)
            {
                EmeraldComponent.m_NavMeshAgent.Warp(Vector3.Lerp(transform.position, destination, 3 * Time.deltaTime));
                yield return null;
            }
        }

        /// <summary>
        /// Allows an AI to hide and peak using its current Cover Node. While an AI is peaking, they can attack, given they have a clear shot of their current target.
        /// </summary>
        IEnumerator HideAndPeak ()
        {
            void SetPeakState()
            {
                EmeraldComponent.AIAnimator.SetBool("Cover Active", false);
                EmeraldComponent.MovementComponent.LockTurning = false;
                EmeraldComponent.MovementComponent.DefaultMovementPaused = false;
                CoverState = CoverStates.Peaking;
            }

            void SetCoverState()
            {
                EmeraldComponent.AIAnimator.SetBool("Cover Active", true);
                HasCover = true;
                CoverState = CoverStates.Hiding;
                EmeraldComponent.MovementComponent.DefaultMovementPaused = true;
                EmeraldComponent.MovementComponent.LockTurning = true;
                EmeraldComponent.DetectionComponent.TargetObstructed = true;
            }

            int PeakTimes = Random.Range(PeakTimesMin, PeakTimesMax + 1);

            //Hide and peak based on the number of user set times
            for (int i = 0; i < PeakTimes; i++)
            {
                //Activate the Cover Animation State
                SetCoverState();

                //Wait according to hide time
                float HideSeconds = Random.Range(HideSecondsMin, HideSecondsMax);
                yield return new WaitForSeconds(HideSeconds);

                SetPeakState();

                yield return new WaitForSeconds(0.5f);

                //Only generate a fire destination if the AI's current target is obstructed and it's enabled for this Cover Node.
                if (CurrentCoverNode.GetLineOfSightPosition == YesOrNo.Yes && EmeraldComponent.DetectionComponent.TargetObstructed)
                {
                    Vector3 Destination = EmeraldAPI.Internal.FindUnobstructedPosition(EmeraldComponent);
                    yield return StartCoroutine(Moving(Destination));
                    yield return new WaitForSeconds(0.25f);
                }

                //Wait according to peak time. Durng this time the AI can attack if they see their target.
                float PeakSeconds = Random.Range(AttackSecondsMin, AttackSecondsMax);
                yield return new WaitForSeconds(PeakSeconds);

                //Repeat for each iteration. Once done, the AI will find another Cover Node.
            }

            //Add a random delay to help keep AI from switching Cover Nodes at the same time
            float RandomOffset = Random.Range(0, 0.5f);
            yield return new WaitForSeconds(RandomOffset);

            HasCover = false;
            CoverState = CoverStates.Inactive;
            EmeraldComponent.m_NavMeshAgent.stoppingDistance = EmeraldComponent.CombatComponent.AttackDistance;
        }

        /// <summary>
        /// Allows an AI to hide using its current Cover Node until the HideSeconds has lapsed. Once this happens, allow the AI to attack until it picks another Cover Node.
        /// </summary>
        IEnumerator HideAndAttack()
        {
            void SetAttackState()
            {
                EmeraldComponent.AIAnimator.SetBool("Cover Active", false);
                EmeraldComponent.MovementComponent.LockTurning = false;
                EmeraldComponent.MovementComponent.DefaultMovementPaused = true;
                CoverState = CoverStates.MovingToCover;
                HasCover = false;
            }

            void SetCoverState()
            {
                EmeraldComponent.AIAnimator.SetBool("Cover Active", true);
                HasCover = true;
                CoverState = CoverStates.Hiding;
                EmeraldComponent.MovementComponent.DefaultMovementPaused = true;
                EmeraldComponent.MovementComponent.LockTurning = true;
            }

            if (CurrentCoverNode != null && CurrentCoverNode.CoverType == CoverTypes.CrouchOnce)
            {
                //Set the AI's cover state while it's hiding
                SetCoverState();

                //Wait according to hide time
                float HideSeconds = Random.Range(HideSecondsMin, HideSecondsMax);
                yield return new WaitForSeconds(HideSeconds);
            }
            
            SetAttackState(); //Set the values needed for the AI to switch to its attack state while using the Cover Component

            //Give the cover animation time to transition
            yield return new WaitForSeconds(0.5f);

            //Only generate a fire destination if the AI's current target is obstructed and it's enabled for this Cover Node.
            if (CurrentCoverNode.GetLineOfSightPosition == YesOrNo.Yes && EmeraldComponent.DetectionComponent.TargetObstructed)
            {
                Vector3 Destination = EmeraldAPI.Internal.FindUnobstructedPosition(EmeraldComponent);
                yield return StartCoroutine(Moving(Destination));
                yield return new WaitForSeconds(0.25f);
            }
            
            HasCover = false;
            CoverState = CoverStates.Peaking;

            EmeraldComponent.MovementComponent.DefaultMovementPaused = false;
            EmeraldComponent.MovementComponent.LockTurning = true;
            EmeraldComponent.m_NavMeshAgent.stoppingDistance = EmeraldComponent.CombatComponent.AttackDistance;

            //Wait according to peak time. Durng this time the AI can attack if they see their target.
            float PeakSeconds = Random.Range(AttackSecondsMin, AttackSecondsMax);
            yield return new WaitForSeconds(PeakSeconds);

            //Add a random delay to help keep AI from switching Cover Nodes at the same time
            float RandomOffset = Random.Range(0, 0.5f);
            yield return new WaitForSeconds(RandomOffset);

            //Set the CoverState to Inactive so the AI can look for another Cover Node
            CoverState = CoverStates.Inactive;
        }

        IEnumerator Moving(Vector3 Destination)
        {
            //Return if the CombatTarget is null (which can happen if the CombatTarget gets cleared rght before this function gets called).
            if (EmeraldComponent.CombatTarget == null) yield break;

            EmeraldComponent.m_NavMeshAgent.stoppingDistance = 0.5f;
            EmeraldComponent.CombatComponent.CancelAllCombatActions();
            EmeraldComponent.MovementComponent.StopBackingUp();
            EmeraldComponent.MovementComponent.LockTurning = true;
            EmeraldComponent.MovementComponent.DefaultMovementPaused = false;
            EmeraldComponent.m_NavMeshAgent.ResetPath();
            EmeraldComponent.m_NavMeshAgent.destination = Destination;
            yield return new WaitForSeconds(0.01f);
            EmeraldComponent.MovementComponent.LockTurning = false;
            EmeraldComponent.MovementComponent.DefaultMovementPaused = true;

            //Only wait for has path if the destination is greater than 0.25f.
            if (Vector3.Distance(Destination, transform.position) > 0.25f) yield return new WaitUntil(() => EmeraldComponent.m_NavMeshAgent.hasPath);

            while (EmeraldComponent.m_NavMeshAgent.enabled && !EmeraldComponent.AnimationComponent.IsDead && EmeraldComponent.m_NavMeshAgent.remainingDistance >= 0.5f)
            {
                EmeraldComponent.m_NavMeshAgent.stoppingDistance = 0.5f;
                Vector3 Direction = new Vector3(EmeraldComponent.m_NavMeshAgent.steeringTarget.x, 0, EmeraldComponent.m_NavMeshAgent.steeringTarget.z) - new Vector3(EmeraldComponent.transform.position.x, 0, EmeraldComponent.transform.position.z);
                EmeraldComponent.MovementComponent.UpdateRotations(Direction);
                yield return null;
            }

            //Lerps the AI near the Cover Node upon arrival to avoid overshooting or inaccurate cover.
            StartCoroutine(LerpToDestination(EmeraldComponent.m_NavMeshAgent.destination));
            yield return new WaitForSeconds(0.33f);

            float t = 0;

            while (t < 2.5f && EmeraldComponent.CombatTarget != null)
            {
                t += Time.deltaTime;

                Vector3 Direction = new Vector3(EmeraldComponent.CombatTarget.position.x, 0, EmeraldComponent.CombatTarget.position.z) - new Vector3(EmeraldComponent.transform.position.x, 0, EmeraldComponent.transform.position.z);
                EmeraldComponent.MovementComponent.UpdateRotations(Direction);

                yield return null;
            }

            EmeraldComponent.MovementComponent.DefaultMovementPaused = false;
            EmeraldComponent.MovementComponent.LockTurning = true;
            EmeraldComponent.m_NavMeshAgent.stoppingDistance = EmeraldComponent.CombatComponent.AttackDistance;
        }

        ///<summary>
        ///Finds the best Cover Node based on specified conditions.
        ///</summary>
        public Transform FindCoverNode()
        {
            List<Transform> targets = EmeraldComponent.DetectionComponent.LineOfSightTargets.Select(collider => collider.transform).ToList();

            float maxAngleFromTargetForward = 110f; //Max angle from any target's forward direction

            Collider[] hitColliders = Physics.OverlapSphere(transform.position, CoverSearchRadius, CoverNodeLayerMask);
            ValidCoverNodes.Clear(); //Clear the validCoverPoints list
            OccupiedCoverNodes.Clear(); //Clear the OccupiedCoverNodes list

            foreach (var hitCollider in hitColliders)
            {
                CoverNode coverPoint = hitCollider.transform.GetComponent<CoverNode>();

                if (!coverPoint) 
                    continue;

                //Condition 1: Cover Node must be unoccupied
                if (coverPoint.IsOccupied)
                {
                    OccupiedCoverNodes.Add(coverPoint); //Store occupied Cover Nodes for a final condition later
                    continue;
                }              

                //Condition 2: Cover Node must be within maxAngleFromTargetForward degrees of any target's forward direction
                bool withinAngleOfAnyTarget = false;
                foreach (var target in targets)
                {
                    Vector3 directionToCover = (coverPoint.transform.position - target.position).normalized;
                    float angleToCover = Vector3.Angle(target.forward, directionToCover);
                    if (angleToCover <= maxAngleFromTargetForward)
                    {
                        withinAngleOfAnyTarget = true;
                        break;
                    }
                }
                if (!withinAngleOfAnyTarget)
                    continue;

                //Condition 3: Cover Node must be further than minDistanceFromTarget from all targets
                bool tooCloseToAnyTarget = false;
                foreach (var target in targets)
                {
                    float distanceCoverToTarget = Vector3.Distance(coverPoint.transform.position, target.position);
                    if (distanceCoverToTarget < MinCoverDistance)
                    {
                        tooCloseToAnyTarget = true;
                        break;
                    }
                }
                if (tooCloseToAnyTarget)
                    continue;

                //Condition 4: Cover Node's forward direction must be within coverPointFacingAngle degrees to any target
                bool exceededAngleLimitToAnyTarget = false;
                foreach (var target in targets)
                {
                    Vector3 directionFromCoverToTarget = (target.position - coverPoint.transform.position).normalized;
                    float angleBetweenCoverForwardAndTarget = Vector3.Angle(coverPoint.transform.forward, directionFromCoverToTarget);
                    if (angleBetweenCoverForwardAndTarget > coverPoint.CoverAngleLimit / 2f)
                    {
                        exceededAngleLimitToAnyTarget = true;
                        break;
                    }
                }
                if (exceededAngleLimitToAnyTarget)
                    continue;

                //Condition 5: Max allowed distance to travel
                float distanceToTarget = Vector3.Distance(transform.position, coverPoint.transform.position);

                if (distanceToTarget > MaxTravelDistance)
                    continue;

                //All conditions met, add to valid Cover Nodes
                float distanceToCover = Vector3.Distance(transform.position, coverPoint.transform.position);

                ValidCoverNodes.Add(new CoverPointData
                {
                    coverNode = coverPoint,
                    distanceToAgent = distanceToCover
                });
            }

            //Remove last used Cover Node to avoid repetition
            if (CurrentCoverNode != null)
            {
                ValidCoverNodes.RemoveAll(cp => cp.coverNode == CurrentCoverNode);
            }

            //Final Condition
            //Do a distance check for each OccupiedCoverNodes with each ValidCoverNodes. Remove any node from ValidCoverNodes that's lower than the MinCoverDistance. This ensures nodes aren't picked that are too close to enemies.
            for (int i = ValidCoverNodes.Count - 1; i >= 0; i--)
            {
                Vector3 nodePosition = ValidCoverNodes[i].coverNode.transform.position;

                for (int j = 0; j < OccupiedCoverNodes.Count; j++)
                {
                    if (OccupiedCoverNodes[j].Occupant && EmeraldAPI.Faction.GetTargetFactionRelation(EmeraldComponent, OccupiedCoverNodes[j].Occupant) == "Enemy")
                    {
                        float Distance = Vector3.Distance(OccupiedCoverNodes[j].transform.position, nodePosition);
                        if (Distance < MinCoverDistance)
                        {
                            Debug.DrawRay(ValidCoverNodes[i].coverNode.transform.position, transform.up * 6, Color.black, 5);
                            ValidCoverNodes.RemoveAt(i);
                            break;
                        }
                    }
                }
            }

            if (ValidCoverNodes.Count > 0)
            {
                //Sort the valid Cover Nodes by distance to the agent
                ValidCoverNodes.Sort((a, b) => a.distanceToAgent.CompareTo(b.distanceToAgent));

                //Consider a subset of the closest Cover Nodes
                int count = Mathf.Min(maxConsideredCoverNodes, ValidCoverNodes.Count);
                List<CoverPointData> closestCoverPoints = ValidCoverNodes.GetRange(0, count);

                //Randomly select one from the closest Cover Nodes
                int index = Random.Range(0, closestCoverPoints.Count);
                CoverNode selectedCoverPoint = closestCoverPoints[index].coverNode;

                //Draw the points, if the DebuggerComponent is present and the setting is enabled
                if (EmeraldComponent.DebuggerComponent != null && EmeraldComponent.DebuggerComponent.DrawDetectedCoverNodes == YesOrNo.Yes)
                {
                    for (int i = 0; i < closestCoverPoints.Count; i++)
                    {
                        if (closestCoverPoints[i].coverNode != selectedCoverPoint)
                            DrawCircle(closestCoverPoints[i].coverNode.transform.position - Vector3.up * 0.5f, 0.5f, Color.yellow, 3f);
                        else
                            DrawCircle(selectedCoverPoint.transform.position - Vector3.up * 0.5f, 0.5f, Color.green, 3f);
                    }
                }

                //Remember the selected Cover Node
                if (CurrentCoverNode != null) CurrentCoverNode.ClearOccupant();
                CurrentCoverNode = selectedCoverPoint;
                CurrentCoverNode.SetOccupant(transform);

                return selectedCoverPoint.transform;
            }
            else
            {
                return null; //No valid Cover Nodes found
            }
        }

        /// <summary>
        /// Draws a circle around each detected Cover Node. 
        /// </summary>
        void DrawCircle(Vector3 center, float radius, Color color, float DrawTime)
        {
            Vector3 prevPos = center + new Vector3(radius, 0, 0);
            for (int i = 0; i < 30; i++)
            {
                float angle = (float)(i + 1) / 30.0f * Mathf.PI * 2.0f;
                Vector3 newPos = center + new Vector3(Mathf.Cos(angle) * radius, 0, Mathf.Sin(angle) * radius);
                Debug.DrawLine(prevPos, newPos, color, DrawTime);
                prevPos = newPos;
            }
        }
    }
}