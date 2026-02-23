// Verbose Logger interface for Gatrix Unity Client SDK

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Extended logger interface for Gatrix SDK supporting verbose logging.
    /// </summary>
    public interface IGatrixLoggerVerbose
    {
        void Verbose(string message);
    }
}
