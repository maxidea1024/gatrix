// FeaturesClient.Context - Context management partial
// Handles context get/update operations

using System.Collections.Generic;
using Cysharp.Threading.Tasks;

namespace Gatrix.Unity.SDK
{
    public partial class FeaturesClient
    {
        /// <summary>Get a deep copy of the current context</summary>
        public GatrixContext GetContext() => _context.Clone();

        /// <summary>Update context and re-fetch flags</summary>
        public async UniTask UpdateContextAsync(GatrixContext context)
        {
            // Filter out system fields; apply user context
            if (context.UserId != null) _context.UserId = context.UserId;
            if (context.SessionId != null) _context.SessionId = context.SessionId;
            if (context.CurrentTime != null) _context.CurrentTime = context.CurrentTime;
            if (context.Properties != null)
            {
                if (_context.Properties == null)
                    _context.Properties = new Dictionary<string, object>();
                foreach (var kvp in context.Properties)
                {
                    _context.Properties[kvp.Key] = kvp.Value;
                }
            }

            // Check if context actually changed
            var newHash = ComputeContextHash(_context);
            if (newHash == _lastContextHash) return;

            _lastContextHash = newHash;
            _contextChangeCount++;
            await FetchFlagsAsync();
        }

        private async UniTask ApplyContextChange()
        {
            var newHash = ComputeContextHash(_context);
            if (newHash == _lastContextHash) return;
            _lastContextHash = newHash;
            _contextChangeCount++;
            await FetchFlagsAsync();
        }
    }
}
