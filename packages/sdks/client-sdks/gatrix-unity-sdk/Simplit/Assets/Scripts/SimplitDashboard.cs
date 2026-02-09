// SimplitDashboard - Main dashboard view for Simplit example
// Shows stats panel and a scrollable grid of flag cards

using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace Gatrix.Unity.SDK.Examples
{
    /// <summary>
    /// Dashboard showing SDK stats and a scrollable list of flag cards.
    /// Auto-refreshes flag cards when flags change.
    /// </summary>
    public class SimplitDashboard : MonoBehaviour
    {
        [Header("References")]
        [SerializeField] private SimplitStatsPanel _statsPanel;
        [SerializeField] private Transform _flagCardContainer;
        [SerializeField] private GameObject _flagCardPrefab;
        [SerializeField] private Text _flagCountText;
        [SerializeField] private Button _fetchButton;
        [SerializeField] private Text _fetchButtonText;
        [SerializeField] private GameObject _emptyState;

        private readonly List<SimplitFlagCard> _activeCards = new List<SimplitFlagCard>();
        private readonly Queue<GameObject> _cardPool = new Queue<GameObject>();

        private GatrixClient _client;
        private bool _isFetching;

        private void OnEnable()
        {
            if (_fetchButton != null)
                _fetchButton.onClick.AddListener(OnFetchClicked);
        }

        private void OnDisable()
        {
            if (_fetchButton != null)
                _fetchButton.onClick.RemoveListener(OnFetchClicked);

            UnsubscribeEvents();
        }

        /// <summary>Called when dashboard becomes visible</summary>
        public void Refresh()
        {
            UnsubscribeEvents();

            _client = GatrixBehaviour.Client;
            if (_client == null) return;

            // Subscribe to events
            _client.On(GatrixEvents.Change, OnFlagsChanged);
            _client.On(GatrixEvents.Ready, OnFlagsChanged);
            _client.On(GatrixEvents.Sync, OnFlagsChanged);
            _client.On(GatrixEvents.FetchStart, OnFetchStart);
            _client.On(GatrixEvents.FetchEnd, OnFetchEnd);

            // Initial render
            RenderFlags();
            _statsPanel?.ForceRefresh();
        }

        private void OnFlagsChanged(object[] args)
        {
            RenderFlags();
        }

        private void OnFetchStart(object[] args)
        {
            _isFetching = true;
            UpdateFetchButton();
        }

        private void OnFetchEnd(object[] args)
        {
            _isFetching = false;
            UpdateFetchButton();
        }

        private async void OnFetchClicked()
        {
            if (_client == null || _isFetching) return;
            await _client.Features.FetchFlagsAsync();
        }

        private void UpdateFetchButton()
        {
            if (_fetchButton != null)
                _fetchButton.interactable = !_isFetching;
            if (_fetchButtonText != null)
                _fetchButtonText.text = _isFetching ? "FETCHING..." : "FETCH FLAGS";
        }

        private void RenderFlags()
        {
            if (_client == null) return;

            var flags = _client.GetAllFlags();

            // Update flag count
            if (_flagCountText != null)
                _flagCountText.text = $"FEATURE FLAGS ({flags.Count})";

            // Show/hide empty state
            if (_emptyState != null)
                _emptyState.SetActive(flags.Count == 0);

            // Return excess cards to pool
            while (_activeCards.Count > flags.Count)
            {
                var idx = _activeCards.Count - 1;
                var card = _activeCards[idx];
                _activeCards.RemoveAt(idx);
                card.gameObject.SetActive(false);
                _cardPool.Enqueue(card.gameObject);
            }

            // Create or reuse cards
            for (int i = 0; i < flags.Count; i++)
            {
                SimplitFlagCard card;
                if (i < _activeCards.Count)
                {
                    card = _activeCards[i];
                }
                else
                {
                    var go = GetOrCreateCard();
                    go.SetActive(true);
                    go.transform.SetParent(_flagCardContainer, false);
                    card = go.GetComponent<SimplitFlagCard>();
                    _activeCards.Add(card);
                }

                card.SetFlag(flags[i]);
            }
        }

        private GameObject GetOrCreateCard()
        {
            if (_cardPool.Count > 0)
                return _cardPool.Dequeue();

            if (_flagCardPrefab != null)
                return Instantiate(_flagCardPrefab);

            // Fallback: create minimal card via code
            return CreateMinimalCard();
        }

        /// <summary>
        /// Creates a minimal flag card via code if no prefab is assigned.
        /// For proper UI, assign a flag card prefab in the Inspector.
        /// </summary>
        private GameObject CreateMinimalCard()
        {
            var go = new GameObject("FlagCard");
            go.AddComponent<SimplitFlagCard>();

            // Add layout element for grid sizing
            var layout = go.AddComponent<LayoutElement>();
            layout.preferredHeight = 80;
            layout.flexibleWidth = 1;

            // Background image
            var bgImage = go.AddComponent<Image>();
            bgImage.color = new Color(0.15f, 0.15f, 0.2f, 1f);

            // Use vertical layout for card contents
            var vlg = go.AddComponent<VerticalLayoutGroup>();
            vlg.padding = new RectOffset(8, 8, 4, 4);
            vlg.spacing = 2;
            vlg.childForceExpandWidth = true;
            vlg.childForceExpandHeight = false;

            // Row 1: Flag name + ON/OFF badge
            var row1 = CreateRow(go.transform, "Row1");
            var nameText = CreateText(row1.transform, "FlagName", 14, TextAnchor.MiddleLeft);
            nameText.fontStyle = FontStyle.Bold;
            var badgeGo = new GameObject("Badge");
            badgeGo.transform.SetParent(row1.transform, false);
            var badgeBg = badgeGo.AddComponent<Image>();
            badgeBg.color = Color.gray;
            var badgeLayout = badgeGo.AddComponent<LayoutElement>();
            badgeLayout.preferredWidth = 40;
            badgeLayout.preferredHeight = 20;
            CreateText(badgeGo.transform, "BadgeText", 11, TextAnchor.MiddleCenter);

            // Row 2: Variant name + Type
            var row2 = CreateRow(go.transform, "Row2");
            var variantText = CreateText(row2.transform, "Variant", 11, TextAnchor.MiddleLeft);
            variantText.color = new Color(0.6f, 0.8f, 1f);
            var typeText = CreateText(row2.transform, "Type", 10, TextAnchor.MiddleRight);
            typeText.color = new Color(0.7f, 0.7f, 0.7f);

            // Row 3: Payload + Version
            var row3 = CreateRow(go.transform, "Row3");
            var payloadText = CreateText(row3.transform, "Payload", 10, TextAnchor.MiddleLeft);
            payloadText.color = new Color(0.5f, 0.5f, 0.5f);
            var versionText = CreateText(row3.transform, "Version", 10, TextAnchor.MiddleRight);
            versionText.color = new Color(0.5f, 0.5f, 0.5f);

            return go;
        }

        private static GameObject CreateRow(Transform parent, string name)
        {
            var row = new GameObject(name);
            row.transform.SetParent(parent, false);
            var hlg = row.AddComponent<HorizontalLayoutGroup>();
            hlg.spacing = 4;
            hlg.childForceExpandWidth = true;
            hlg.childForceExpandHeight = true;
            var rowLayout = row.AddComponent<LayoutElement>();
            rowLayout.preferredHeight = 22;
            return row;
        }

        private static Text CreateText(Transform parent, string name, int fontSize, TextAnchor alignment)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            var text = go.AddComponent<Text>();
            text.font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
            text.fontSize = fontSize;
            text.alignment = alignment;
            text.color = Color.white;
            text.horizontalOverflow = HorizontalWrapMode.Overflow;
            return text;
        }

        private void UnsubscribeEvents()
        {
            if (_client == null) return;
            _client.Off(GatrixEvents.Change);
            _client.Off(GatrixEvents.Ready);
            _client.Off(GatrixEvents.Sync);
            _client.Off(GatrixEvents.FetchStart);
            _client.Off(GatrixEvents.FetchEnd);
            _client = null;
        }
    }
}
