using System.Text.Json;
using Gatrix.Edge.Options;
using Gatrix.Edge.Services;
using Gatrix.Server.Sdk.DependencyInjection;
using Microsoft.AspNetCore.Server.Kestrel.Core;

var builder = WebApplication.CreateBuilder(args);

// Configure Logging
builder.Logging.ClearProviders();
builder.Logging.AddConsole(); // In production, add Serilog or similar for Loki/File support

// Bind Options
builder.Services.Configure<EdgeOptions>(
    builder.Configuration.GetSection(EdgeOptions.SectionName));

var edgeOptions = builder.Configuration.GetSection(EdgeOptions.SectionName).Get<EdgeOptions>() ?? new EdgeOptions();

// Configure Kestrel to listen on two ports
builder.WebHost.ConfigureKestrel(serverOptions =>
{
    // Main server (Client, Server, Public APIs)
    serverOptions.ListenAnyIP(edgeOptions.Port, listenOptions =>
    {
        listenOptions.Protocols = HttpProtocols.Http1AndHttp2;
    });

    // Internal server (Management APIs)
    serverOptions.ListenAnyIP(edgeOptions.InternalPort, listenOptions =>
    {
        listenOptions.Protocols = HttpProtocols.Http1AndHttp2;
    });
});

// Configure Services
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.DictionaryKeyPolicy = JsonNamingPolicy.CamelCase;
    });

// Add CORS
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

// Add Gatrix Server SDK
// The Edge server acts as a giant Gatrix SDK client that caches everything
builder.Services.AddGatrixServerSdk(options =>
{
    options.ApiUrl = edgeOptions.GatrixUrl;
    options.ApiToken = edgeOptions.ApiToken;
    options.ApplicationName = edgeOptions.ApplicationName;
    options.Service = edgeOptions.Service;
    options.Group = edgeOptions.Group;
    options.Environment = edgeOptions.Environment;

    // Multi-environment mode
    options.Environments = edgeOptions.Environments;

    options.Redis = new Gatrix.Server.Sdk.Options.RedisOptions
    {
        Host = edgeOptions.Redis.Host,
        Port = edgeOptions.Redis.Port,
        Password = edgeOptions.Redis.Password,
        Db = edgeOptions.Redis.Db
    };

    options.Cache = new Gatrix.Server.Sdk.Options.CacheOptions
    {
        Enabled = true,
        RefreshMethod = edgeOptions.Cache.SyncMethod,
        Ttl = edgeOptions.Cache.PollingIntervalMs / 1000
    };

    // Enable all required SDK features for Edge caching
    options.Features = new Gatrix.Server.Sdk.Options.FeaturesOptions
    {
        FeatureFlag = true,
        GameWorld = true,
        PopupNotice = true,
        Survey = true,
        Whitelist = true,
        ServiceMaintenance = true,
        StoreProduct = true,
        ClientVersion = true,
        ServiceNotice = true,
        Banner = true
    };
});

// Add HTTP Client for backend requests (proxies, tokens, usage, metrics)
builder.Services.AddHttpClient("GatrixBackend", client =>
{
    client.BaseAddress = new Uri(edgeOptions.GatrixUrl);
    client.Timeout = TimeSpan.FromSeconds(10);
});

// Add Edge-specific Services
builder.Services.AddSingleton<TokenMirrorService>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<TokenMirrorService>());

builder.Services.AddSingleton<TokenUsageTracker>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<TokenUsageTracker>());

builder.Services.AddSingleton<MetricsAggregator>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<MetricsAggregator>());

builder.Services.AddSingleton(new RequestStats(edgeOptions.RequestLogRateLimit));

builder.Services.AddSingleton<FlagStreamingService>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<FlagStreamingService>());

var app = builder.Build();

// Configure the HTTP request pipeline
app.UseCors();

// Request logging / tracking middleware
app.Use(async (context, next) =>
{
    var stats = context.RequestServices.GetRequiredService<RequestStats>();
    var start = System.Diagnostics.Stopwatch.GetTimestamp();
    
    // We don't have exact bytes sent/received without wrapping streams, 
    // so we use an approximation or 0 for now
    await next();
    
    var elapsed = System.Diagnostics.Stopwatch.GetElapsedTime(start).TotalMilliseconds;
    var statusCode = context.Response.StatusCode;
    
    stats.Record(context.Request.Method, context.Request.Path, statusCode, elapsed, 0, 0);
});

// Map routes based on ports
// Port 3400 -> api/v1/client, api/v1/server, /public, /health
// Port 3410 -> /internal

app.MapControllers();

app.Use(async (context, next) =>
{
    var port = context.Connection.LocalPort;
    var path = context.Request.Path;
    
    // Internal port only allows /internal
    if (port == edgeOptions.InternalPort)
    {
        if (!path.StartsWithSegments("/internal"))
        {
            context.Response.StatusCode = 404;
            return;
        }
    }
    // Main port blocks /internal
    else if (port == edgeOptions.Port)
    {
        if (path.StartsWithSegments("/internal"))
        {
            context.Response.StatusCode = 404;
            return;
        }
    }
    
    await next();
});

await app.RunAsync();
