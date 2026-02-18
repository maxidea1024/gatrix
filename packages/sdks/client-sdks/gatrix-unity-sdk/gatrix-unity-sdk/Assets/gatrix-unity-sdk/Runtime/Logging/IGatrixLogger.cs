// Logger interface for Gatrix Unity Client SDK

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Logger interface for Gatrix SDK.
    /// Users can provide their own logger implementation.
    /// </summary>
    public interface IGatrixLogger
    {
        void Debug(string message);
        void Info(string message);
        void Warn(string message);
        void Error(string message);
    }
}
