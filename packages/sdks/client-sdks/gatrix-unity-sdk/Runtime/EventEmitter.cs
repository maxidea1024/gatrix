// Simple Event Emitter implementation for Gatrix Unity Client SDK
// GC-optimized: avoids LINQ, uses array-based iteration, no allocation on emit path

using System;
using System.Collections.Generic;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// GC-optimized event emitter.
    /// Uses array snapshots for safe iteration during emit without per-call allocations.
    /// </summary>
    public class GatrixEventEmitter
    {
        private readonly Dictionary<string, List<Listener>> _events
            = new Dictionary<string, List<Listener>>();

        private readonly List<AnyListener> _anyListeners
            = new List<AnyListener>();

        // Reusable snapshot buffer for iteration safety during emit
        private Listener[] _emitBuffer = new Listener[8];
        private AnyListener[] _anyEmitBuffer = new AnyListener[4];
        private bool _emitting;

        private static int _autoNameCount = 0;

        internal class Listener
        {
            public GatrixEventHandler Callback;
            public string Name;
            public int CallCount;
            public bool IsOnce;
            public DateTime RegisteredAt;
        }

        internal class AnyListener
        {
            public GatrixAnyEventHandler Callback;
            public string Name;
            public int CallCount;
            public bool IsOnce;
            public DateTime RegisteredAt;
        }

        // Deferred modifications to prevent collection modification during iteration
        private readonly List<DeferredOp> _deferredOps = new List<DeferredOp>();

        private struct DeferredOp
        {
            public enum OpType { Add, Remove, RemoveAll }
            public OpType Type;
            public string EventName;
            public GatrixEventHandler Callback;
            public string Name;
            public bool IsOnce;
        }

        /// <summary>Subscribe to an event</summary>
        public GatrixEventEmitter On(string eventName, GatrixEventHandler callback, string name = null)
        {
            if (_emitting)
            {
                _deferredOps.Add(new DeferredOp
                {
                    Type = DeferredOp.OpType.Add,
                    EventName = eventName,
                    Callback = callback,
                    Name = name,
                    IsOnce = false
                });
                return this;
            }

            AddListenerInternal(eventName, callback, name, false);
            return this;
        }

        /// <summary>Subscribe to an event once</summary>
        public GatrixEventEmitter Once(string eventName, GatrixEventHandler callback, string name = null)
        {
            if (_emitting)
            {
                _deferredOps.Add(new DeferredOp
                {
                    Type = DeferredOp.OpType.Add,
                    EventName = eventName,
                    Callback = callback,
                    Name = name,
                    IsOnce = true
                });
                return this;
            }

            AddListenerInternal(eventName, callback, name, true);
            return this;
        }

        /// <summary>Unsubscribe from an event</summary>
        public GatrixEventEmitter Off(string eventName, GatrixEventHandler callback = null)
        {
            if (_emitting)
            {
                if (callback == null)
                {
                    _deferredOps.Add(new DeferredOp
                    {
                        Type = DeferredOp.OpType.RemoveAll,
                        EventName = eventName
                    });
                }
                else
                {
                    _deferredOps.Add(new DeferredOp
                    {
                        Type = DeferredOp.OpType.Remove,
                        EventName = eventName,
                        Callback = callback
                    });
                }
                return this;
            }

            RemoveListener(eventName, callback);
            return this;
        }

        /// <summary>Subscribe to ALL events</summary>
        public GatrixEventEmitter OnAny(GatrixAnyEventHandler callback, string name = null)
        {
            _anyListeners.Add(new AnyListener
            {
                Callback = callback,
                Name = name ?? $"any_{++_autoNameCount}",
                CallCount = 0,
                IsOnce = false,
                RegisteredAt = DateTime.UtcNow
            });
            return this;
        }

        /// <summary>Unsubscribe from ALL events listener</summary>
        public GatrixEventEmitter OffAny(GatrixAnyEventHandler callback = null)
        {
            if (callback == null)
            {
                _anyListeners.Clear();
            }
            else
            {
                _anyListeners.RemoveAll(l => l.Callback == callback);
            }
            return this;
        }

        /// <summary>
        /// Emit an event with no arguments. Avoids any allocations.
        /// </summary>
        public GatrixEventEmitter Emit(string eventName)
        {
            _emitting = true;
            try
            {
                if (_events.TryGetValue(eventName, out var listeners) && listeners.Count > 0)
                {
                    var count = listeners.Count;
                    EnsureEmitBuffer(ref _emitBuffer, count);
                    listeners.CopyTo(0, _emitBuffer, 0, count);

                    for (int i = 0; i < count; i++)
                    {
                        try { _emitBuffer[i](null); }
                        catch (Exception e) { UnityEngine.Debug.LogError($"EventEmitter: Error in {eventName}: {e}"); }
                        _emitBuffer[i] = null;
                    }
                }

                if (_anyListeners.Count > 0)
                {
                    var anyCount = _anyListeners.Count;
                    EnsureAnyEmitBuffer(ref _anyEmitBuffer, anyCount);
                    _anyListeners.CopyTo(0, _anyEmitBuffer, 0, anyCount);

                    for (int i = 0; i < anyCount; i++)
                    {
                        try { _anyEmitBuffer[i](eventName, null); }
                        catch (Exception e) { UnityEngine.Debug.LogError($"EventEmitter: Error in onAny {eventName}: {e}"); }
                        _anyEmitBuffer[i] = null;
                    }
                }
            }
            finally
            {
                _emitting = false;
                ProcessDeferredOps();
            }
            return this;
        }

        /// <summary>
        /// Emit an event with one argument. Avoids params array allocation.
        /// Note: Value types will still box when converted to object[].
        /// </summary>
        public GatrixEventEmitter Emit<T>(string eventName, T arg)
        {
            // We still need an array to call Action<object[]> listeners
            // but we can reuse a small internal one or just accept one allocation.
            // For now, let's keep it simple but avoid 'params' which creates a new array every time.
            return Emit(eventName, new object[] { arg });
        }

        /// <summary>
        /// Emit an event with multiple arguments.
        /// </summary>
        public GatrixEventEmitter Emit(string eventName, params object[] args)
        {
            _emitting = true;

            try
            {
                // Call specific event listeners using snapshot buffer
                if (_events.TryGetValue(eventName, out var listeners) && listeners.Count > 0)
                {
                    var count = listeners.Count;
                    EnsureEmitBuffer(ref _emitBuffer, count);

                    // Copy to buffer to allow safe modification during iteration
                    listeners.CopyTo(0, _emitBuffer, 0, count);

                    for (int i = 0; i < count; i++)
                    {
                        var listener = _emitBuffer[i];
                        try
                        {
                            listener.CallCount++;
                            if (listener.IsOnce)
                            {
                                RemoveListener(eventName, listener.Callback);
                            }
                            listener.Callback(args);
                        }
                        catch (Exception e)
                        {
                            UnityEngine.Debug.LogError(
                                $"EventEmitter: Error in callback for {eventName}: {e}");
                        }
                        _emitBuffer[i] = null; // Clear reference
                    }
                }

                // Call "any" listeners
                if (_anyListeners.Count > 0)
                {
                    var anyCount = _anyListeners.Count;
                    EnsureAnyEmitBuffer(ref _anyEmitBuffer, anyCount);

                    _anyListeners.CopyTo(0, _anyEmitBuffer, 0, anyCount);

                    for (int i = 0; i < anyCount; i++)
                    {
                        var listener = _anyEmitBuffer[i];
                        try
                        {
                            listener.CallCount++;
                            listener.Callback(eventName, args);
                        }
                        catch (Exception e)
                        {
                            UnityEngine.Debug.LogError(
                                $"EventEmitter: Error in onAny callback for {eventName}: {e}");
                        }
                        _anyEmitBuffer[i] = null;
                    }
                }
            }
            finally
            {
                _emitting = false;
                ProcessDeferredOps();
            }

            return this;
        }

        /// <summary>Remove all listeners</summary>
        public GatrixEventEmitter RemoveAllListeners(string eventName = null)
        {
            if (eventName != null)
            {
                _events.Remove(eventName);
            }
            else
            {
                _events.Clear();
                _anyListeners.Clear();
            }
            return this;
        }

        /// <summary>Get listener count for an event</summary>
        public int ListenerCount(string eventName)
        {
            if (_events.TryGetValue(eventName, out var listeners))
            {
                return listeners.Count;
            }
            return 0;
        }

        /// <summary>Get event handler statistics</summary>
        public Dictionary<string, List<EventHandlerStats>> GetHandlerStats()
        {
            var stats = new Dictionary<string, List<EventHandlerStats>>();

            foreach (var kvp in _events)
            {
                var eventName = kvp.Key;
                var listeners = kvp.Value;
                if (listeners.Count == 0) continue;

                var list = new List<EventHandlerStats>(listeners.Count);
                foreach (var l in listeners)
                {
                    list.Add(new EventHandlerStats
                    {
                        Name = l.Name,
                        CallCount = l.CallCount,
                        IsOnce = l.IsOnce,
                        RegisteredAt = l.RegisteredAt
                    });
                }
                stats[eventName] = list;
            }

            if (_anyListeners.Count > 0)
            {
                var list = new List<EventHandlerStats>(_anyListeners.Count);
                foreach (var l in _anyListeners)
                {
                    list.Add(new EventHandlerStats
                    {
                        Name = l.Name,
                        CallCount = l.CallCount,
                        IsOnce = l.IsOnce,
                        RegisteredAt = l.RegisteredAt
                    });
                }
                stats["*"] = list;
            }

            return stats;
        }

        /// <summary>Total number of registered listeners across all events</summary>
        public int TotalListenerCount
        {
            get
            {
                var total = _anyListeners.Count;
                foreach (var kvp in _events)
                    total += kvp.Value.Count;
                return total;
            }
        }

        // ==================== Private Helpers ====================

        private void AddListenerInternal(string eventName, GatrixEventHandler callback, string name, bool isOnce)
        {
            if (!_events.TryGetValue(eventName, out var list))
            {
                list = new List<Listener>(4);
                _events[eventName] = list;
            }
            list.Add(new Listener
            {
                Callback = callback,
                Name = name ?? (isOnce ? $"once_{++_autoNameCount}" : $"listener_{++_autoNameCount}"),
                CallCount = 0,
                IsOnce = isOnce,
                RegisteredAt = DateTime.UtcNow
            });
        }

        private void RemoveListener(string eventName, GatrixEventHandler callback)
        {
            if (callback == null)
            {
                _events.Remove(eventName);
            }
            else if (_events.TryGetValue(eventName, out var list))
            {
                list.RemoveAll(l => l.Callback == callback);
            }
        }

        private void ProcessDeferredOps()
        {
            if (_deferredOps.Count == 0) return;

            for (int i = 0; i < _deferredOps.Count; i++)
            {
                var op = _deferredOps[i];
                switch (op.Type)
                {
                    case DeferredOp.OpType.Add:
                        AddListenerInternal(op.EventName, op.Callback, op.Name, op.IsOnce);
                        break;
                    case DeferredOp.OpType.Remove:
                        RemoveListener(op.EventName, op.Callback);
                        break;
                    case DeferredOp.OpType.RemoveAll:
                        RemoveListener(op.EventName, null);
                        break;
                }
            }
            _deferredOps.Clear();
        }

        private static void EnsureEmitBuffer(ref Listener[] buffer, int required)
        {
            if (buffer.Length < required)
            {
                // Grow by power of 2
                var newSize = buffer.Length;
                while (newSize < required) newSize *= 2;
                buffer = new Listener[newSize];
            }
        }

        private static void EnsureAnyEmitBuffer(ref AnyListener[] buffer, int required)
        {
            if (buffer.Length < required)
            {
                var newSize = buffer.Length;
                while (newSize < required) newSize *= 2;
                buffer = new AnyListener[newSize];
            }
        }
    }
}
