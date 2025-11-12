using Microsoft.Extensions.Logging;
using Gatrix.ServerSDK.Types;

namespace Gatrix.ServerSDK.Utils;

/// <summary>
/// Logger for GatrixServerSDK
/// </summary>
public class GatrixLogger
{
    private readonly ILogger<GatrixLogger> _logger;
    private readonly LoggerConfig _config;

    public GatrixLogger(ILogger<GatrixLogger> logger, LoggerConfig config)
    {
        _logger = logger;
        _config = config;
    }

    /// <summary>
    /// Get formatted timestamp based on configuration
    /// </summary>
    private string GetFormattedTimestamp()
    {
        var now = DateTime.UtcNow;
        var offsetMs = _config.TimeOffset * 60 * 60 * 1000;
        var offsetDate = now.AddMilliseconds(offsetMs);

        if (_config.TimestampFormat == TimestampFormat.Local)
        {
            return offsetDate.ToString("yyyy-MM-dd HH:mm:ss.fff");
        }

        return offsetDate.ToString("O"); // ISO 8601 format
    }

    /// <summary>
    /// Format log message with timestamp and level
    /// </summary>
    private string FormatMessage(string level, string message)
    {
        var timestamp = GetFormattedTimestamp();
        return $"[{timestamp}] [{level}] [GatrixServerSDK] {message}";
    }

    /// <summary>
    /// Log debug message
    /// </summary>
    public void Debug(string message, object? meta = null)
    {
        if (_config.Level > LogLevel.Debug)
            return;

        var formatted = FormatMessage("DEBUG", message);
        if (meta != null)
        {
            _logger.LogDebug("{Message}: {@Meta}", formatted, meta);
        }
        else
        {
            _logger.LogDebug("{Message}", formatted);
        }
    }

    /// <summary>
    /// Log info message
    /// </summary>
    public void Info(string message, object? meta = null)
    {
        if (_config.Level > LogLevel.Information)
            return;

        var formatted = FormatMessage("INFO", message);
        if (meta != null)
        {
            _logger.LogInformation("{Message}: {@Meta}", formatted, meta);
        }
        else
        {
            _logger.LogInformation("{Message}", formatted);
        }
    }

    /// <summary>
    /// Log warning message
    /// </summary>
    public void Warn(string message, object? meta = null)
    {
        if (_config.Level > LogLevel.Warning)
            return;

        var formatted = FormatMessage("WARN", message);
        if (meta != null)
        {
            _logger.LogWarning("{Message}: {@Meta}", formatted, meta);
        }
        else
        {
            _logger.LogWarning("{Message}", formatted);
        }
    }

    /// <summary>
    /// Log error message
    /// </summary>
    public void Error(string message, object? meta = null)
    {
        var formatted = FormatMessage("ERROR", message);
        if (meta != null)
        {
            _logger.LogError("{Message}: {@Meta}", formatted, meta);
        }
        else
        {
            _logger.LogError("{Message}", formatted);
        }
    }

    /// <summary>
    /// Set time offset
    /// </summary>
    public void SetTimeOffset(int hours)
    {
        _config.TimeOffset = hours;
    }

    /// <summary>
    /// Get time offset
    /// </summary>
    public int GetTimeOffset()
    {
        return _config.TimeOffset;
    }

    /// <summary>
    /// Set timestamp format
    /// </summary>
    public void SetTimestampFormat(TimestampFormat format)
    {
        _config.TimestampFormat = format;
    }

    /// <summary>
    /// Get timestamp format
    /// </summary>
    public TimestampFormat GetTimestampFormat()
    {
        return _config.TimestampFormat;
    }
}

