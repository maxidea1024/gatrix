using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using EmeraldAI;

/// <summary>
/// An example script for utilizing the slowed callbacks to create a slow effect that changes the AI's color and enables a slow "ice" particle effect.
/// </summary>
namespace EmeraldAI.Example
{
    public class SlowAIEffect : MonoBehaviour
    {
        public SkinnedMeshRenderer CharacterMesh;
        public Color SlowColor = Color.blue;
        public GameObject SlowEffect;
        EmeraldSystem EmeraldComponent;

        // Start is called before the first frame update
        void Start()
        {
            EmeraldComponent = GetComponent<EmeraldSystem>();
            EmeraldComponent.CombatComponent.OnStartSlowed += StartSlowedEffect;
            EmeraldComponent.CombatComponent.OnEndSlowed += StopSlowedEffect;
        }

        void StartSlowedEffect()
        {
            CharacterMesh.material.SetColor("_Color", SlowColor);
            SlowEffect.SetActive(true);
        }

        void StopSlowedEffect()
        {
            CharacterMesh.material.SetColor("_Color", Color.white);
            SlowEffect.SetActive(false);
        }
    }
}