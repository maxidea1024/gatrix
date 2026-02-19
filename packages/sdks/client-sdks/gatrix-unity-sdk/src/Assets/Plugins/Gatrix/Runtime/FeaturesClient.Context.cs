// FeaturesClient.Context - Context management partial
// Handles context get/set/remove/update operations

using System.Collections.Generic;
using System.Globalization;
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

        /// <summary>Set a single context field and re-fetch flags</summary>
        public async UniTask SetContextFieldAsync(string field, object value)
        {
            if (SystemContextFields.Contains(field))
            {
                _logger.Warn($"Cannot modify system context field: {field}");
                return;
            }

            if (DefinedFields.Contains(field))
            {
                switch (field)
                {
                    case "userId": _context.UserId = value?.ToString(); break;
                    case "sessionId": _context.SessionId = value?.ToString(); break;
                    case "currentTime": _context.CurrentTime = value?.ToString(); break;
                }
            }
            else
            {
                if (_context.Properties == null)
                    _context.Properties = new Dictionary<string, object>();
                _context.Properties[field] = value;
            }

            await ApplyContextChange();
        }

        /// <summary>Set a string context field and re-fetch flags (boxing-free for system fields)</summary>
        public async UniTask SetContextFieldAsync(string field, string value)
        {
            if (SystemContextFields.Contains(field))
            {
                _logger.Warn($"Cannot modify system context field: {field}");
                return;
            }

            if (DefinedFields.Contains(field))
            {
                switch (field)
                {
                    case "userId": _context.UserId = value; break;
                    case "sessionId": _context.SessionId = value; break;
                    case "currentTime": _context.CurrentTime = value; break;
                }
            }
            else
            {
                if (_context.Properties == null)
                    _context.Properties = new Dictionary<string, object>();
                _context.Properties[field] = value;
            }

            await ApplyContextChange();
        }

        /// <summary>Set a boolean context field and re-fetch flags</summary>
        public async UniTask SetContextFieldAsync(string field, bool value)
        {
            if (SystemContextFields.Contains(field))
            {
                _logger.Warn($"Cannot modify system context field: {field}");
                return;
            }

            if (DefinedFields.Contains(field))
            {
                switch (field)
                {
                    case "userId": _context.UserId = value.ToString(); break;
                    case "sessionId": _context.SessionId = value.ToString(); break;
                    case "currentTime": _context.CurrentTime = value.ToString(); break;
                }
            }
            else
            {
                if (_context.Properties == null)
                    _context.Properties = new Dictionary<string, object>();
                _context.Properties[field] = value;
            }

            await ApplyContextChange();
        }

        /// <summary>Set a numeric context field and re-fetch flags</summary>
        public async UniTask SetContextFieldAsync(string field, double value)
        {
            if (SystemContextFields.Contains(field))
            {
                _logger.Warn($"Cannot modify system context field: {field}");
                return;
            }

            if (DefinedFields.Contains(field))
            {
                switch (field)
                {
                    case "userId": _context.UserId = value.ToString(CultureInfo.InvariantCulture); break;
                    case "sessionId": _context.SessionId = value.ToString(CultureInfo.InvariantCulture); break;
                    case "currentTime": _context.CurrentTime = value.ToString(CultureInfo.InvariantCulture); break;
                }
            }
            else
            {
                if (_context.Properties == null)
                    _context.Properties = new Dictionary<string, object>();
                _context.Properties[field] = value;
            }

            await ApplyContextChange();
        }

        /// <summary>Set an integer context field and re-fetch flags</summary>
        public async UniTask SetContextFieldAsync(string field, int value)
        {
            await SetContextFieldAsync(field, (double)value);
        }

        /// <summary>Remove a context field and re-fetch flags</summary>
        public async UniTask RemoveContextFieldAsync(string field)
        {
            if (SystemContextFields.Contains(field))
            {
                _logger.Warn($"Cannot remove system context field: {field}");
                return;
            }

            if (DefinedFields.Contains(field))
            {
                switch (field)
                {
                    case "userId": _context.UserId = null; break;
                    case "sessionId": _context.SessionId = null; break;
                    case "currentTime": _context.CurrentTime = null; break;
                }
            }
            else
            {
                _context.Properties?.Remove(field);
            }

            await ApplyContextChange();
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
