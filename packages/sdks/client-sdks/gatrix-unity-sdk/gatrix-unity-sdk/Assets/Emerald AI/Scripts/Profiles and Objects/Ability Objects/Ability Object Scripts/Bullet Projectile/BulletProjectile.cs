using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using EmeraldAI.Utility;
using System.Linq;
using UnityEngine.Audio;

namespace EmeraldAI
{
    [RequireComponent(typeof(AudioSource))]
    public class BulletProjectile : MonoBehaviour, IAvoidable
    {
        #region Variables
        BulletProjectileAbility CurrentAbilityData;
        EmeraldSystem EmeraldComponent;
        Transform CurrentTarget;
        public Transform AbilityTarget { get => CurrentTarget; set => CurrentTarget = value; }
        Vector3 InitialTargetPosition;
        ICombat StartingICombat;
        AudioSource m_AudioSource;
        GameObject m_SoundEffect;
        GameObject Owner;
        List<Collider> IgnoredColliders = new List<Collider>();
        float StartTime;
        bool Initialized;
        float TargetAngle;
        #endregion

        /// <summary>
        /// Used to initialize the needed components and settings the first time the projectile is used.
        /// </summary>
        void Awake()
        {
            m_AudioSource = GetComponent<AudioSource>();
            m_AudioSource.loop = true;
            m_AudioSource.rolloffMode = AudioRolloffMode.Linear;
            m_AudioSource.spatialBlend = 1;
            m_AudioSource.maxDistance = 20;
            m_SoundEffect = Resources.Load("Emerald Sound") as GameObject;
        }

        /// <summary>
        /// Initialize the projectile with the passed information.
        /// </summary>
        /// <param name="owner">The owner of this projectile.</param>
        /// <param name="currentTarget">The current target for this projectile.</param>
        /// <param name="abilityData">The current ability data for this projectile.</param>
        public void Initialize (GameObject owner, Transform currentTarget, BulletProjectileAbility abilityData)
        {
            Owner = owner;
            CurrentTarget = currentTarget;
            if (CurrentTarget != null)
            {
                StartingICombat = CurrentTarget.GetComponent<ICombat>();
                InitialTargetPosition = StartingICombat.DamagePosition();
            }

            EmeraldComponent = Owner.GetComponent<EmeraldSystem>();
            CurrentAbilityData = abilityData;

            GetLBDColliders(); //Get a reference to the Owner's LBD component so internal colliders can be ignored.

            Initialized = false;
            InitializeProjectile(); //Intialize the projectile's settings.

            StartTime = Time.time;
        }

        void GetLBDColliders()
        {
            //Get a reference to the Owner's LBD component so internal colliders can be ignored.
            LocationBasedDamage LBDComponent = Owner.GetComponent<LocationBasedDamage>();
            if (LBDComponent)
            {
                IgnoredColliders.Clear();
                for (int i = 0; i < LBDComponent.ColliderList.Count; i++)
                {
                    IgnoredColliders.Add(LBDComponent.ColliderList[i].ColliderObject);
                }
            }
        }

        void InitializeProjectile ()
        {
            if (EmeraldComponent.CombatComponent.TargetAngle < EmeraldComponent.MovementComponent.CombatAngleToTurn) transform.LookAt(InitialTargetPosition);
            Initialized = true;
            StartCoroutine(MoveProjectile());
        }

        IEnumerator MoveProjectile()
        {
            bool Collided = false;
            float collisionCheckTimer = 0;
            Vector3 EndPosition = Vector3.zero;

            //Add a random offset for bullet spread based on the BulletSpread settings
            Vector3 Accuracy = new Vector3(
                Random.Range(-CurrentAbilityData.BulletProjectileSettings.BulletSpreadX, CurrentAbilityData.BulletProjectileSettings.BulletSpreadX) * 0.001f,
                Random.Range(-CurrentAbilityData.BulletProjectileSettings.BulletSpreadY, CurrentAbilityData.BulletProjectileSettings.BulletSpreadY) * 0.001f,
                0);

            Vector3 lastCheckPosition = transform.position;

            while (!Collided)
            {
                //Move bullet every frame
                float step = CurrentAbilityData.BulletProjectileSettings.BulletSpeed * Time.deltaTime;
                Vector3 nextPosition = Vector3.MoveTowards(
                    transform.position,
                    transform.position + (transform.forward + Accuracy),
                    step);

                transform.position = nextPosition;

                collisionCheckTimer += Time.deltaTime;

                //If enough time has passed, do a single collision check
                if (collisionCheckTimer >= CurrentAbilityData.BulletProjectileSettings.CollisionCheckSpeed)
                {
                    //Perform the raycast from lastCheckPosition to the current position
                    Vector3 travelVector = transform.position - lastCheckPosition;
                    float travelDistance = travelVector.magnitude;

                    RaycastHit hit;
                    if (Physics.Raycast(lastCheckPosition, travelVector.normalized, out hit, travelDistance, ~CurrentAbilityData.BulletProjectileSettings.IgnoreLayers))
                    {
                        EndPosition = hit.point + (transform.forward * 0.1f);
                        Impact(hit.collider.gameObject, hit.point, hit.normal);
                        Collided = true;
                    }

                    //Reset the timer and update the last check position
                    collisionCheckTimer = 0f;
                    lastCheckPosition = transform.position;
                }

                //Stop moving, if there was a collision
                if (Collided) break;

                //If not, wait until the next frame
                yield return null;
            }

            //Finish traveling the last bit so the bullet’s trail can get to the collision point
            Vector3 startingPosition = transform.position;
            float t = 0f;
            bool complete = false;

            while (!complete)
            {
                float distance = Vector3.Distance(transform.position, EndPosition);
                t += Time.deltaTime * CurrentAbilityData.BulletProjectileSettings.BulletSpeed;
                transform.position = Vector3.Lerp(startingPosition, EndPosition, t);

                if (distance <= 0)
                    complete = true;

                yield return null;
            }
        }

        /// <summary>
        /// Used to move and track the time since the projectile has been spawned.
        /// </summary>
        void Update()
        {
            ProjectileTimeout(); //Track the time since the projectile has been active.
        }

        /// <summary>
        /// Track the time since the projectile has been active. Once the time ProjectileTimeoutSeconds 
        /// has been met, despawn the projectile and spawn an impact effect from its current position.
        /// </summary>
        void ProjectileTimeout ()
        {
            if (!Initialized) return;

            float TimeAlive = Time.time - StartTime;
            if (TimeAlive > CurrentAbilityData.BulletProjectileSettings.BulletObjectTimeout)
            {
                this.enabled = false;
                EmeraldObjectPool.Despawn(gameObject);
            }
        }

        /// <summary>
        /// Handles all impact related functionality.
        /// </summary>
        void Impact (GameObject TargetHit, Vector3 HitPosition, Vector3 HitNormal)
        {
            if (!this.enabled) return; //Only allow trigger collisions to work if the script is active

            Initialized = false; //Disable initialization so the projectile stops operating.
            BulletImpact(TargetHit, HitPosition, HitNormal);
            DamageTarget(TargetHit); //Damages the projectile's Target. If a LocationBasedDamageArea is detected, damage it. If not, damage the target's IDamageable component.
            Invoke(nameof(ImpactDespawn), CurrentAbilityData.BulletProjectileSettings.BulletCollisionTimeout);
        }

        void BulletImpact (GameObject TargetHit, Vector3 HitPosition, Vector3 HitNormal)
        {
            if (CurrentAbilityData.BulletProjectileSettings.BulletImpactData.Count == 0)
            {
                CurrentAbilityData.BulletProjectileSettings.SpawnDefaultBulletImpact(TargetHit, HitPosition, HitNormal);
                return;
            }

            for (int i = 0; i < CurrentAbilityData.BulletProjectileSettings.BulletImpactData.Count; i++)
            {
                if (TargetHit.CompareTag(CurrentAbilityData.BulletProjectileSettings.BulletImpactData[i].SurfaceTag))
                {
                    CurrentAbilityData.BulletProjectileSettings.SpawnBulletImpact(TargetHit, CurrentAbilityData.BulletProjectileSettings.BulletImpactData[i], HitPosition, HitNormal);
                    return;
                }
            }

            CurrentAbilityData.BulletProjectileSettings.SpawnDefaultBulletImpact(TargetHit, HitPosition, HitNormal);
        }

        void OnDisable ()
        {
            StopAllCoroutines();
        }

        /// <summary>
        /// Damages the projectile's Target. If a LocationBasedDamageArea is detected, damage it. If not, damage the target's IDamageable component.
        /// </summary>
        void DamageTarget(GameObject Target)
        {
            LocationBasedDamageArea m_LocationBasedDamageArea = Target.GetComponent<LocationBasedDamageArea>();

            //Only damage layers that are in the AI's DetectionLayerMask or if the target has a LBD component on it.
            if (!m_LocationBasedDamageArea && ((1 << Target.layer) & EmeraldComponent.DetectionComponent.DetectionLayerMask) == 0) return;

            //Return if the target is teleporting.
            if (m_LocationBasedDamageArea != null && m_LocationBasedDamageArea.EmeraldComponent.transform.localScale == Vector3.one * 0.003f || Target.transform.localScale == Vector3.one * 0.003f) return;

            var m_ICombat = Target.GetComponentInParent<ICombat>();

            //If knockbacks are enabled, roll for a knowckback
            if (CurrentAbilityData.KnockbackSettings.Enabled && CurrentAbilityData.KnockbackSettings.RollForKnockback())
            {
                Vector3 Direction = transform.forward;
                if (m_ICombat != null) Owner.gameObject.GetComponent<MonoBehaviour>().StartCoroutine(CurrentAbilityData.KnockbackSettings.KnockbackSequence(Direction, m_ICombat.TargetTransform(), m_ICombat));
            }

            //If an ability has a slow module, roll for a slowed effect
            if (CurrentAbilityData.SlowedSettings.Enabled && CurrentAbilityData.SlowedSettings.RollForSlowEffect())
            {
                EmeraldSystem TargetEmeraldComponent = !m_LocationBasedDamageArea ? m_ICombat.TargetTransform().GetComponent<EmeraldSystem>() : m_LocationBasedDamageArea.EmeraldComponent;

                //The slow feature only works for AI
                if (m_ICombat != null && TargetEmeraldComponent)
                {
                    if (!TargetEmeraldComponent.AnimationComponent.IsSlowed || TargetEmeraldComponent.AnimationComponent.IsSlowed && TargetEmeraldComponent.AIAnimator.speed >= CurrentAbilityData.SlowedSettings.SlowPercentage * 0.01f)
                    {
                        MonoBehaviour MonoBehaviourRef = Owner.gameObject.GetComponent<MonoBehaviour>();
                        if (TargetEmeraldComponent.CombatComponent.SlowedCoroutine != null) MonoBehaviourRef.StopCoroutine(TargetEmeraldComponent.CombatComponent.SlowedCoroutine);
                        TargetEmeraldComponent.CombatComponent.SlowedCoroutine = MonoBehaviourRef.StartCoroutine(CurrentAbilityData.SlowedSettings.SlowEffectSequence(m_ICombat.TargetTransform(), m_ICombat));
                    }
                }
            }

            //If stuns are enabled, roll for a stun
            if (CurrentAbilityData.StunnedSettings.Enabled && CurrentAbilityData.StunnedSettings.RollForStun())
            {
                if (m_ICombat != null) m_ICombat.TriggerStun(CurrentAbilityData.StunnedSettings.StunLength);
            }

            //Only cause damage if it's enabled
            if (!CurrentAbilityData.DamageSettings.Enabled) return;

            if (m_LocationBasedDamageArea == null)
            {
                var m_IDamageable = Target.GetComponent<IDamageable>();
                if (m_IDamageable != null)
                {
                    bool IsCritHit = CurrentAbilityData.DamageSettings.GenerateCritHit();
                    m_IDamageable.Damage(CurrentAbilityData.DamageSettings.GenerateDamage(IsCritHit), Owner.transform, CurrentAbilityData.DamageSettings.BaseDamageSettings.RagdollForce, IsCritHit);
                    CurrentAbilityData.DamageSettings.DamageTargetOverTime(CurrentAbilityData, CurrentAbilityData.DamageSettings, Owner, Target);
                    m_AudioSource.Stop();
                }
                else
                {
                    Debug.Log(Target.gameObject + " is missing IDamageable Component, apply one");
                }
            }
            else if (m_LocationBasedDamageArea != null)
            {
                bool IsCritHit = CurrentAbilityData.DamageSettings.GenerateCritHit();
                m_LocationBasedDamageArea.DamageArea(CurrentAbilityData.DamageSettings.GenerateDamage(IsCritHit), Owner.transform, CurrentAbilityData.DamageSettings.BaseDamageSettings.RagdollForce, IsCritHit);
                CurrentAbilityData.DamageSettings.DamageTargetOverTime(CurrentAbilityData, CurrentAbilityData.DamageSettings, Owner, m_ICombat.TargetTransform().gameObject);
                m_AudioSource.Stop();
            }
        }

        /// <summary>
        /// Despawns the impact effect after the CollisionTimeout has been met.
        /// </summary>
        void ImpactDespawn ()
        {
            this.enabled = false; //Disable the script so it doesn't interfere with other objects that may use the same object through Object Pooling
            EmeraldObjectPool.Despawn(gameObject);
        }
    }
}