"""
Add anchor links to component names in the Zero-Code component tables
in README.md and README.ko.md.

GitHub anchor from '### `GatrixFlagToggle`':
- strip backticks, lowercase, spaces -> '-', strip special chars
=> #gatrixflagtoggle
"""

import re

# All component names that have entries in COMPONENTS.md
COMPONENTS = [
    "GatrixFlagToggle", "GatrixFlagEvent", "GatrixEventListener",
    "GatrixVariantSwitch", "GatrixFlagSceneRedirect", "GatrixFlagBehaviourEnabled",
    "GatrixFlagValue", "GatrixFlagImage", "GatrixFlagColor", "GatrixFlagCanvas",
    "GatrixFlagSlider", "GatrixFlagButtonInteractable", "GatrixFlagInputField",
    "GatrixFlagScrollRect",
    "GatrixFlagMaterial", "GatrixFlagTransform", "GatrixFlagSpriteRenderer",
    "GatrixFlagRendererToggle", "GatrixFlagParticles", "GatrixFlagQualitySettings",
    "GatrixFlagShaderProperty", "GatrixFlagTrailRenderer", "GatrixFlagLineRenderer",
    "GatrixFlagGlobalShader",
    "GatrixFlagAudio", "GatrixFlagAnimator", "GatrixFlagAudioMixer", "GatrixFlagAudioSource",
    "GatrixFlagCamera",
    "GatrixFlagLight",
    "GatrixFlagFog", "GatrixFlagAmbientLight", "GatrixFlagSkybox", "GatrixFlagWindZone",
    "GatrixFlagRigidbody", "GatrixFlagGravity", "GatrixFlagCollider",
    "GatrixFlagRigidbody2D", "GatrixFlagSortingOrder", "GatrixFlagTilemap",
    "GatrixFlagPhysicsMaterial2D", "GatrixFlagJoint2D", "GatrixFlagEffector2D",
    "GatrixFlagNavMeshAgent", "GatrixFlagNavMeshObstacle", "GatrixFlagAIAnimator",
    "GatrixFlagDetectionRange",
    "GatrixFlagTimeScale", "GatrixFlagFrameRate",
    "GatrixFlagPostProcessVolume",
    "GatrixFlagLogger",
]

def to_anchor(name):
    """Convert component name to GitHub markdown anchor."""
    return '#' + name.lower()

def linkify_components(text, doc_path):
    """Replace bare backtick component names with links in table rows only."""
    for comp in COMPONENTS:
        anchor = to_anchor(comp)
        link = f"[`{comp}`]({doc_path}{anchor})"
        # Only replace inside table rows (lines starting with |)
        # Match "`CompName`" not already linked
        pattern = r'(?<!\[)`' + re.escape(comp) + r'`(?!\])'
        text = re.sub(pattern, link, text)
    return text

# --- README.md ---
with open('README.md', encoding='utf-8') as f:
    content = f.read()

content = linkify_components(content, 'docs/COMPONENTS.md')

with open('README.md', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"README.md done, size={len(content)}")

# --- README.ko.md ---
with open('README.ko.md', encoding='utf-8') as f:
    content = f.read()

content = linkify_components(content, 'docs/COMPONENTS.ko.md')

with open('README.ko.md', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"README.ko.md done, size={len(content)}")
