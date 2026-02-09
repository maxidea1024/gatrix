// SimplitMain - Entry point for Simplit example
// Manages Config → Dashboard screen transitions

using UnityEngine;
using UnityEngine.UI;

namespace Gatrix.Unity.SDK.Examples
{
    /// <summary>
    /// Main controller for the Simplit example.
    /// Handles screen transitions and SDK lifecycle.
    /// </summary>
    public class SimplitMain : MonoBehaviour
    {
        [Header("Screen References")]
        [SerializeField] private GameObject _configScreen;
        [SerializeField] private GameObject _dashboardScreen;

        [Header("Config Form")]
        [SerializeField] private InputField _apiUrlInput;
        [SerializeField] private InputField _apiTokenInput;
        [SerializeField] private InputField _appNameInput;
        [SerializeField] private InputField _environmentInput;
        [SerializeField] private Button _connectButton;
        [SerializeField] private Text _statusText;

        [Header("Dashboard")]
        [SerializeField] private Button _disconnectButton;

        private SimplitDashboard _dashboard;

        private void Start()
        {
            _dashboard = _dashboardScreen.GetComponent<SimplitDashboard>();

            // Set defaults
            _apiUrlInput.text = "http://localhost:45000/api/v1";
            _apiTokenInput.text = "gatrix-unsecured-client-api-token";
            _appNameInput.text = "simplit-unity";
            _environmentInput.text = "development";

            _connectButton.onClick.AddListener(OnConnectClicked);
            _disconnectButton.onClick.AddListener(OnDisconnectClicked);

            // Show config screen
            ShowConfigScreen();
        }

        private async void OnConnectClicked()
        {
            var apiUrl = _apiUrlInput.text.Trim();
            var apiToken = _apiTokenInput.text.Trim();
            var appName = _appNameInput.text.Trim();
            var environment = _environmentInput.text.Trim();

            if (string.IsNullOrEmpty(apiUrl) || string.IsNullOrEmpty(apiToken) ||
                string.IsNullOrEmpty(appName) || string.IsNullOrEmpty(environment))
            {
                _statusText.text = "All fields are required.";
                _statusText.color = Color.red;
                return;
            }

            _connectButton.interactable = false;
            _statusText.text = "Connecting...";
            _statusText.color = Color.yellow;

            try
            {
                var config = new GatrixClientConfig
                {
                    ApiUrl = apiUrl,
                    ApiToken = apiToken,
                    AppName = appName,
                    Environment = environment,
                    StorageProvider = new InMemoryStorageProvider()
                };

                await GatrixBehaviour.InitializeAsync(config);
                ShowDashboard();
            }
            catch (System.Exception e)
            {
                _statusText.text = $"Error: {e.Message}";
                _statusText.color = Color.red;
                _connectButton.interactable = true;
            }
        }

        private void OnDisconnectClicked()
        {
            GatrixBehaviour.Shutdown();
            ShowConfigScreen();
        }

        private void ShowConfigScreen()
        {
            _configScreen.SetActive(true);
            _dashboardScreen.SetActive(false);
            _connectButton.interactable = true;
            _statusText.text = "";
        }

        private void ShowDashboard()
        {
            _configScreen.SetActive(false);
            _dashboardScreen.SetActive(true);
            _dashboard?.Refresh();
        }

        private void OnDestroy()
        {
            _connectButton?.onClick.RemoveListener(OnConnectClicked);
            _disconnectButton?.onClick.RemoveListener(OnDisconnectClicked);
        }
    }
}
