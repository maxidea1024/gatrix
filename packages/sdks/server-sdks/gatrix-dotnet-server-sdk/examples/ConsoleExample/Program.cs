using Gatrix.Server.Sdk;
using Gatrix.Server.Sdk.DependencyInjection;
using Gatrix.Server.Sdk.Models;
using Gatrix.Server.Sdk.Services;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

// ═══════════════════════════════════════════════════════════════════
//  Gatrix .NET Server SDK — Console Example
//  Demonstrates: initialization, feature flags, game worlds,
//  popup notices, surveys, whitelist, maintenance, and events.
// ═══════════════════════════════════════════════════════════════════

var builder = Host.CreateApplicationBuilder(args);

// Configure logging
builder.Logging.SetMinimumLevel(LogLevel.Information);

// Register Gatrix Server SDK
builder.Services.AddGatrixServerSdk(options =>
{
    // Connection
    options.ApiUrl = "http://localhost:45000/api/v1";
    options.ApiToken = "gatrix-unsecured-server-api-token";

    // Application identity
    options.ApplicationName = "console-example";
    options.Service = "example-service";
    options.Group = "default";
    options.Environment = "development";

    // Cache: use Redis Pub/Sub for real-time updates
    options.Cache.Enabled = true;
    options.Cache.RefreshMethod = "event";
    options.Cache.Ttl = 300;

    // Redis
    options.Redis = new Gatrix.Server.Sdk.Options.RedisOptions
    {
        Host = "localhost",
        Port = 46379,
    };

    // Enable ALL features
    options.Features.FeatureFlag = true;
    options.Features.GameWorld = true;
    options.Features.PopupNotice = true;
    options.Features.Survey = true;
    options.Features.Whitelist = true;
    options.Features.ServiceMaintenance = true;
    options.Features.StoreProduct = true;
    options.Features.ClientVersion = true;
    options.Features.ServiceNotice = true;
    options.Features.Banner = true;
});

// Register our demo service
builder.Services.AddHostedService<DemoWorker>();

var app = builder.Build();
await app.RunAsync();

// ═══════════════════════════════════════════════════════════════════
//  Demo Worker — runs after CacheManager has initialized
// ═══════════════════════════════════════════════════════════════════

class DemoWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<DemoWorker> _logger;

    public DemoWorker(IServiceScopeFactory scopeFactory, ILogger<DemoWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Wait a moment for CacheManager to finish initial fetch
        await Task.Delay(3000, stoppingToken);

        // Create a scope to resolve scoped services (IGatrixServerSdk)
        using var scope = _scopeFactory.CreateScope();
        var _sdk = scope.ServiceProvider.GetRequiredService<IGatrixServerSdk>();

        _logger.LogInformation("══════════════════════════════════════════");
        _logger.LogInformation("  Gatrix .NET Server SDK — Demo Start");
        _logger.LogInformation("══════════════════════════════════════════");

        // ── 1. Feature Flags ────────────────────────────────────
        _logger.LogInformation("\n📌 Feature Flags:");

        var isEnabled = _sdk.FeatureFlag.IsEnabled("my-feature", false);
        _logger.LogInformation("  my-feature enabled: {Enabled}", isEnabled);

        var theme = _sdk.FeatureFlag.StringVariation("ui-theme", "default");
        _logger.LogInformation("  ui-theme variant: {Theme}", theme);

        var maxItems = _sdk.FeatureFlag.IntVariation("max-items", 10);
        _logger.LogInformation("  max-items variant: {MaxItems}", maxItems);

        // Details method — returns reason and variant name
        var detail = _sdk.FeatureFlag.BoolVariationDetails("premium-tier", false);
        _logger.LogInformation("  premium-tier: value={Value}, reason={Reason}, variant={Variant}",
            detail.Value, detail.Reason, detail.VariantName);

        // ── 2. Game Worlds ──────────────────────────────────────
        _logger.LogInformation("\n🌍 Game Worlds:");

        var worlds = _sdk.GameWorld.GetAll("development");
        _logger.LogInformation("  Total worlds: {Count}", worlds.Count);

        foreach (var world in worlds.Take(5))
        {
            var maintenance = _sdk.GameWorld.IsWorldMaintenanceActive(world.WorldId, "development");
            _logger.LogInformation("  [{WorldId}] {Name} (order={Order}, maintenance={Maint})",
                world.WorldId, world.Name, world.DisplayOrder, maintenance);
        }

        // ── 3. Popup Notices ────────────────────────────────────
        _logger.LogInformation("\n📢 Popup Notices:");

        var notices = _sdk.PopupNotice.GetActive("development");
        _logger.LogInformation("  Active notices: {Count}", notices.Count);

        foreach (var notice in notices.Take(3))
        {
            _logger.LogInformation("  [#{Id}] priority={Priority}, showOnce={ShowOnce}",
                notice.Id, notice.DisplayPriority, notice.ShowOnce);
        }

        // ── 4. Surveys ──────────────────────────────────────────
        _logger.LogInformation("\n📋 Surveys:");

        var surveys = _sdk.Survey.GetAll("development");
        _logger.LogInformation("  Total surveys: {Count}", surveys.Count);

        var settings = _sdk.Survey.GetSettings("development");
        if (settings is not null)
        {
            _logger.LogInformation("  Survey URL: {Url}", settings.DefaultSurveyUrl);
        }

        // ── 5. Whitelist ────────────────────────────────────────
        _logger.LogInformation("\n🔐 Whitelist:");

        var whitelisted = _sdk.Whitelist.IsIpWhitelisted("127.0.0.1", "development");
        _logger.LogInformation("  127.0.0.1 whitelisted: {Result}", whitelisted);

        var accountWhitelisted = _sdk.Whitelist.IsAccountWhitelisted("admin", "development");
        _logger.LogInformation("  admin account whitelisted: {Result}", accountWhitelisted);

        // ── 6. Service Maintenance ──────────────────────────────
        _logger.LogInformation("\n🔧 Service Maintenance:");

        var maintenanceActive = _sdk.ServiceMaintenance.IsActive("development");
        _logger.LogInformation("  Maintenance active: {Active}", maintenanceActive);

        if (maintenanceActive)
        {
            var msg = _sdk.ServiceMaintenance.GetMessage("development", "en");
            _logger.LogInformation("  Message: {Msg}", msg);
        }

        // ── 7. Store Products ───────────────────────────────────
        _logger.LogInformation("\n🛒 Store Products:");

        var products = _sdk.StoreProduct.GetAll("development");
        _logger.LogInformation("  Total products: {Count}", products.Count);

        // ── Done ────────────────────────────────────────────────
        _logger.LogInformation("\n══════════════════════════════════════════");
        _logger.LogInformation("  Demo complete! SDK is running with Redis events.");
        _logger.LogInformation("  Press Ctrl+C to stop.");
        _logger.LogInformation("══════════════════════════════════════════");

        // Keep running to receive Redis events
        await Task.Delay(Timeout.Infinite, stoppingToken);
    }
}
