// SimplitFlagCard - Individual flag card UI for Simplit example
// Supports both prefab-based (SerializeField) and code-created (auto-bind by name) setup

using UnityEngine;
using UnityEngine.UI;

namespace Gatrix.Unity.SDK.Examples
{
    /// <summary>
    /// Displays a single feature flag's information.
    /// Instantiated by SimplitDashboard for each flag.
    /// </summary>
    public class SimplitFlagCard : MonoBehaviour
    {
        [SerializeField] private Text _flagNameText;
        [SerializeField] private Text _enabledBadgeText;
        [SerializeField] private Image _enabledBadgeBg;
        [SerializeField] private Text _variantNameText;
        [SerializeField] private Text _variantTypeText;
        [SerializeField] private Text _payloadText;
        [SerializeField] private Text _versionText;
        [SerializeField] private Image _cardBackground;

        private static readonly Color ColorEnabled = new Color(0.2f, 0.7f, 0.3f, 1f);
        private static readonly Color ColorDisabled = new Color(0.7f, 0.2f, 0.2f, 1f);
        private static readonly Color ColorBgEnabled = new Color(0.15f, 0.25f, 0.15f, 1f);
        private static readonly Color ColorBgDisabled = new Color(0.25f, 0.15f, 0.15f, 1f);

        private string _flagName;
        private int _lastVersion = -1;
        private float _flashTimer;
        private bool _isFlashing;
        private Color _baseColor;
        private bool _bound;

        private void Awake()
        {
            AutoBind();
        }

        /// <summary>
        /// Auto-bind child UI elements by name if SerializeField references are null.
        /// Allows cards created via code (without prefab) to work.
        /// </summary>
        private void AutoBind()
        {
            if (_bound) return;
            _bound = true;

            if (_flagNameText == null) _flagNameText = FindText("FlagName");
            if (_enabledBadgeText == null) _enabledBadgeText = FindText("BadgeText");
            if (_enabledBadgeBg == null) _enabledBadgeBg = FindImage("Badge");
            if (_variantNameText == null) _variantNameText = FindText("Variant");
            if (_variantTypeText == null) _variantTypeText = FindText("Type");
            if (_payloadText == null) _payloadText = FindText("Payload");
            if (_versionText == null) _versionText = FindText("Version");
            if (_cardBackground == null) _cardBackground = GetComponent<Image>();
        }

        /// <summary>Bind this card to a flag</summary>
        public void SetFlag(EvaluatedFlag flag)
        {
            if (flag == null) return;
            AutoBind();

            _flagName = flag.Name;

            // Detect version change for flash effect
            if (_lastVersion >= 0 && _lastVersion != flag.Version)
            {
                _isFlashing = true;
                _flashTimer = 0.5f;
            }
            _lastVersion = flag.Version;

            SetText(_flagNameText, flag.Name);

            // Enabled/Disabled badge
            if (_enabledBadgeText != null)
                _enabledBadgeText.text = flag.Enabled ? "ON" : "OFF";
            if (_enabledBadgeBg != null)
                _enabledBadgeBg.color = flag.Enabled ? ColorEnabled : ColorDisabled;

            // Card background
            _baseColor = flag.Enabled ? ColorBgEnabled : ColorBgDisabled;
            if (_cardBackground != null)
                _cardBackground.color = _baseColor;

            // Variant
            SetText(_variantNameText, flag.Variant?.Name ?? "-");

            // Variant type
            SetText(_variantTypeText, ValueTypeHelper.ToApiString(flag.ValueType));

            // Payload
            var payload = flag.Variant?.Value;
            if (payload != null)
            {
                var payloadStr = payload.ToString();
                if (payloadStr.Length > 60)
                    payloadStr = payloadStr.Substring(0, 57) + "...";
                SetText(_payloadText, payloadStr);
            }
            else
            {
                SetText(_payloadText, "no payload");
            }

            // Version
            SetText(_versionText, $"v{flag.Version}");
        }

        /// <summary>Get the flag name this card is bound to</summary>
        public string FlagName => _flagName;

        private void Update()
        {
            if (!_isFlashing) return;

            _flashTimer -= Time.unscaledDeltaTime;
            if (_flashTimer <= 0f)
            {
                _isFlashing = false;
                if (_cardBackground != null)
                    _cardBackground.color = _baseColor;
                return;
            }

            // Flash white briefly
            if (_cardBackground != null)
            {
                var flash = Mathf.PingPong(_flashTimer * 6f, 1f);
                _cardBackground.color = Color.Lerp(_baseColor, Color.white, flash * 0.3f);
            }
        }

        private Text FindText(string childName)
        {
            var t = transform.FindDeep(childName);
            return t != null ? t.GetComponent<Text>() : null;
        }

        private Image FindImage(string childName)
        {
            var t = transform.FindDeep(childName);
            return t != null ? t.GetComponent<Image>() : null;
        }

        private static void SetText(Text text, string value)
        {
            if (text != null) text.text = value;
        }
    }

    /// <summary>
    /// Extension for recursive child search without using reflection.
    /// </summary>
    internal static class TransformExtensions
    {
        /// <summary>Recursively find a child transform by name</summary>
        public static Transform FindDeep(this Transform parent, string name)
        {
            for (int i = 0; i < parent.childCount; i++)
            {
                var child = parent.GetChild(i);
                if (child.name == name) return child;
                var found = child.FindDeep(name);
                if (found != null) return found;
            }
            return null;
        }
    }
}
