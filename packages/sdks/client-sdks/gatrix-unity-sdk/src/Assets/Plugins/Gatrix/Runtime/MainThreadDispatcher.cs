// MainThreadDispatcher - Ensures callbacks execute on Unity's main thread
// Critical for thread safety: Unity API calls must happen on the main thread

using System;
using System.Collections.Generic;
using System.Threading;
using UnityEngine;

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// Dispatches actions to Unity's main thread.
    /// Unity API (PlayerPrefs, Debug.Log, etc.) can only be called from the main thread.
    /// HttpClient responses and Task.Run come back on thread pool threads,
    /// so we need this to safely bridge back.
    /// </summary>
    public class MainThreadDispatcher : MonoBehaviour
    {
        private static MainThreadDispatcher _instance;
        private static SynchronizationContext _unitySyncContext;
        private static int _mainThreadId;
        private static bool _initialized;

        // Domain reload support: reset all static state
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        private static void ResetStaticState()
        {
            _instance = null;
            _unitySyncContext = null;
            _mainThreadId = 0;
            _initialized = false;
        }

        // Lock-free queue using swap pattern to minimize GC
        private readonly List<Action> _pendingActions = new List<Action>(16);
        private readonly List<Action> _executingActions = new List<Action>(16);
        private readonly object _lock = new object();

        /// <summary>Check if currently on the main thread</summary>
        public static bool IsMainThread => Thread.CurrentThread.ManagedThreadId == _mainThreadId;

        /// <summary>
        /// Initialize the dispatcher. Called automatically by GatrixBehaviour.
        /// Must be called from the main thread.
        /// </summary>
        public static void Initialize()
        {
            if (_initialized) return;

            _mainThreadId = Thread.CurrentThread.ManagedThreadId;
            _unitySyncContext = SynchronizationContext.Current;
            _initialized = true;

            if (_instance == null)
            {
                var go = new GameObject("[GatrixMainThreadDispatcher]");
                DontDestroyOnLoad(go);
                go.hideFlags = HideFlags.HideInHierarchy;
                _instance = go.AddComponent<MainThreadDispatcher>();
            }
        }

        /// <summary>
        /// Enqueue an action to run on the main thread.
        /// If already on the main thread, executes immediately.
        /// </summary>
        public static void Enqueue(Action action)
        {
            if (action == null) return;

            // Fast path: already on main thread
            if (IsMainThread)
            {
                action();
                return;
            }

            if (_instance != null)
            {
                lock (_instance._lock)
                {
                    _instance._pendingActions.Add(action);
                }
            }
            else if (_unitySyncContext != null)
            {
                // Fallback: use SynchronizationContext
                _unitySyncContext.Post(_ => action(), null);
            }
        }

        /// <summary>
        /// Post an action using the captured Unity SynchronizationContext.
        /// Works even after the dispatcher GameObject is destroyed.
        /// </summary>
        public static void Post(Action action)
        {
            if (action == null) return;

            if (IsMainThread)
            {
                action();
                return;
            }

            if (_unitySyncContext != null)
            {
                _unitySyncContext.Post(_ => action(), null);
            }
            else if (_instance != null)
            {
                lock (_instance._lock)
                {
                    _instance._pendingActions.Add(action);
                }
            }
        }

        /// <summary>Get the Unity SynchronizationContext</summary>
        public static SynchronizationContext UnitySyncContext => _unitySyncContext;

        private void Update()
        {
            // Swap-and-execute pattern: minimize lock holding time
            lock (_lock)
            {
                if (_pendingActions.Count == 0) return;

                // Swap lists
                _executingActions.AddRange(_pendingActions);
                _pendingActions.Clear();
            }

            // Execute outside lock
            for (int i = 0; i < _executingActions.Count; i++)
            {
                try
                {
                    _executingActions[i]();
                }
                catch (Exception e)
                {
                    Debug.LogException(e);
                }
            }
            _executingActions.Clear();
        }

        private void OnDestroy()
        {
            if (_instance == this)
            {
                _instance = null;
            }
        }

        /// <summary>Shutdown and clean up</summary>
        public static void Shutdown()
        {
            if (_instance != null)
            {
                Destroy(_instance.gameObject);
                _instance = null;
            }
        }
    }
}
