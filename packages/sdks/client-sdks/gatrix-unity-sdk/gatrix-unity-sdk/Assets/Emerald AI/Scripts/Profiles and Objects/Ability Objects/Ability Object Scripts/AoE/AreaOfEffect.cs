using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using EmeraldAI.Utility;
using System.Linq;

namespace EmeraldAI
{
    public class AreaOfEffect : MonoBehaviour
    {
        public LayerMask Enemies;
        AreaOfEffectAbility CurrentAbilityData;
        GameObject Owner;
        EmeraldSystem EmeraldComponent;

        public void Initialize (GameObject owner, Transform AttackTransform, AreaOfEffectAbility abilityData)
        {
            EmeraldComponent = owner.GetComponent<EmeraldSystem>();
            Enemies = EmeraldComponent.DetectionComponent.DetectionLayerMask;
            CurrentAbilityData = abilityData;
            Owner = owner;
            IntitailizeInternal(Owner, AttackTransform);
        }

        void IntitailizeInternal (GameObject Owner, Transform AttackTransform)
        {
            List<Collider> DetectedAOETargets = Physics.OverlapSphere(AttackTransform.position, CurrentAbilityData.AreaOfEffectSettings.Radius, Enemies).ToList(); //Only looks for targets that have the same layer as the layers from the AI's DetectionLayerMask.
            DetectedAOETargets.Remove(Owner.GetComponent<Collider>()); //Remove the owner's collider if it happens to be detected.

            for (int i = 0; i < DetectedAOETargets.Count; i++)
            {
                //Only damage targets that the Owner has an Enemy Relation Type with.
                if (EmeraldAPI.Faction.GetTargetFactionRelation(EmeraldComponent, DetectedAOETargets[i].transform) == "Enemy")
                {
                    ICombat m_ICombat = DetectedAOETargets[i].GetComponent<ICombat>();

                    if (CurrentAbilityData.AreaOfEffectSettings.HitTargetEffect != null)
                    {
                        if (m_ICombat != null && !m_ICombat.IsDodging() && !m_ICombat.IsBlocking() && DetectedAOETargets[i].transform.localScale != Vector3.one * 0.003f)
                            EmeraldObjectPool.SpawnEffect(CurrentAbilityData.AreaOfEffectSettings.HitTargetEffect, DetectedAOETargets[i].GetComponent<ICombat>().DamagePosition(), DetectedAOETargets[i].transform.rotation, CurrentAbilityData.AreaOfEffectSettings.HitTargetEffectTimeoutSeconds);
                    }

                    DamageTarget(DetectedAOETargets[i].gameObject, m_ICombat);
                }
            }
        }

        /// <summary>
        /// Damages the projectile's StartingTarget, given that it has a IDamageable.
        /// </summary>
        void DamageTarget(GameObject Target, ICombat ICombatRef)
        {
            if (Target.transform.localScale == Vector3.one * 0.003f) return;

            //If knockbacks are enabled, roll for a knowckback
            if (CurrentAbilityData.KnockbackSettings.Enabled && CurrentAbilityData.KnockbackSettings.RollForKnockback())
            {
                Vector3 Direction = (ICombatRef.TargetTransform().transform.position - Owner.transform.position).normalized;
                if (ICombatRef != null) Owner.gameObject.GetComponent<MonoBehaviour>().StartCoroutine(CurrentAbilityData.KnockbackSettings.KnockbackSequence(Direction, ICombatRef.TargetTransform(), ICombatRef));
            }

            //If an ability has a slow module, roll for a slowed effect
            if (CurrentAbilityData.SlowedSettings.Enabled && CurrentAbilityData.SlowedSettings.RollForSlowEffect())
            {
                EmeraldSystem TargetEmeraldComponent = ICombatRef.TargetTransform().GetComponent<EmeraldSystem>();

                //The slow feature only works for AI
                if (ICombatRef != null && TargetEmeraldComponent)
                {
                    if (!TargetEmeraldComponent.AnimationComponent.IsSlowed || TargetEmeraldComponent.AnimationComponent.IsSlowed && TargetEmeraldComponent.AIAnimator.speed >= CurrentAbilityData.SlowedSettings.SlowPercentage * 0.01f)
                    {
                        MonoBehaviour MonoBehaviourRef = Owner.gameObject.GetComponent<MonoBehaviour>();
                        if (TargetEmeraldComponent.CombatComponent.SlowedCoroutine != null) MonoBehaviourRef.StopCoroutine(TargetEmeraldComponent.CombatComponent.SlowedCoroutine);
                        TargetEmeraldComponent.CombatComponent.SlowedCoroutine = MonoBehaviourRef.StartCoroutine(CurrentAbilityData.SlowedSettings.SlowEffectSequence(ICombatRef.TargetTransform(), ICombatRef));
                    }
                }
            }

            if (CurrentAbilityData.StunnedSettings.Enabled && CurrentAbilityData.StunnedSettings.RollForStun())
            {
                if (ICombatRef != null) ICombatRef.TriggerStun(CurrentAbilityData.StunnedSettings.StunLength);
            }

            //Only cause damage if it's enabled
            if (!CurrentAbilityData.DamageSettings.Enabled) return;

            var m_IDamageable = Target.GetComponent<IDamageable>();
            if (m_IDamageable != null)
            {
                bool IsCritHit = CurrentAbilityData.DamageSettings.GenerateCritHit();
                m_IDamageable.Damage(CurrentAbilityData.DamageSettings.GenerateDamage(IsCritHit), Owner.transform, CurrentAbilityData.DamageSettings.BaseDamageSettings.RagdollForce, IsCritHit);
                CurrentAbilityData.DamageSettings.DamageTargetOverTime(CurrentAbilityData, CurrentAbilityData.DamageSettings, Owner, Target);
            }
            else
            {
                Debug.Log(Target.gameObject + " is missing a IDamageable and/or ICombat Component, apply one");
            }
        }
    }
}