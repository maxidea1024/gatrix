// WebGLWebSocket - WebGL-compatible WebSocket wrapper using JS interop
// Falls back to System.Net.WebSockets.ClientWebSocket on non-WebGL platforms
// This file provides a unified IWebSocketClient interface for cross-platform use

using System;
using System.Collections.Generic;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
#if !UNITY_WEBGL || UNITY_EDITOR
using System.Net.WebSockets;
#endif
#if UNITY_WEBGL && !UNITY_EDITOR
using System.Runtime.InteropServices;
#endif

namespace Gatrix.Unity.SDK
{
    /// <summary>
    /// WebSocket connection state
    /// </summary>
    internal enum WsState
    {
        Connecting = 0,
        Open = 1,
        Closing = 2,
        Closed = 3
    }

    /// <summary>
    /// WebSocket event type from the JS interop layer
    /// </summary>
    internal enum WsEventType
    {
        None = 0,
        Open = 1,
        Message = 2,
        Error = 3,
        Close = 4
    }

    /// <summary>
    /// WebSocket event data
    /// </summary>
    internal struct WsEvent
    {
        public WsEventType Type;
        public string Data;
    }

    /// <summary>
    /// Cross-platform WebSocket client abstraction.
    /// Uses browser native WebSocket on WebGL, ClientWebSocket on other platforms.
    /// </summary>
    internal interface IGatrixWebSocket : IDisposable
    {
        WsState State { get; }
        Task ConnectAsync(Uri uri, CancellationToken ct);
        Task SendAsync(string message, CancellationToken ct);
        Task CloseAsync(CancellationToken ct);

        /// <summary>
        /// Poll for next available event. Returns null if no event pending.
        /// On non-WebGL, internally converts async receive into polled events.
        /// </summary>
        WsEvent? PollEvent();

        void SetRequestHeader(string name, string value);
    }

#if UNITY_WEBGL && !UNITY_EDITOR
    /// <summary>
    /// WebGL WebSocket implementation using JS interop plugin.
    /// Uses a polling model since WebGL doesn't support blocking/async socket operations.
    /// </summary>
    internal class WebGLWebSocket : IGatrixWebSocket
    {
        [DllImport("__Internal")] private static extern int GatrixWS_Create(string url);
        [DllImport("__Internal")] private static extern int GatrixWS_Send(int id, string msg);
        [DllImport("__Internal")] private static extern void GatrixWS_Close(int id, int code, string reason);
        [DllImport("__Internal")] private static extern int GatrixWS_GetState(int id);
        [DllImport("__Internal")] private static extern int GatrixWS_PollEvent(int id, ref int outType, byte[] outData, int outDataMaxLen);
        [DllImport("__Internal")] private static extern void GatrixWS_Destroy(int id);

        private int _instanceId = -1;
        private bool _disposed;
        private readonly byte[] _pollBuffer = new byte[8192];

        public WsState State
        {
            get
            {
                if (_instanceId < 0) return WsState.Closed;
                return (WsState)GatrixWS_GetState(_instanceId);
            }
        }

        public Task ConnectAsync(Uri uri, CancellationToken ct)
        {
            if (_disposed) throw new ObjectDisposedException(nameof(WebGLWebSocket));
            _instanceId = GatrixWS_Create(uri.ToString());
            // In WebGL, connection is async via events - caller should poll for Open event
            return Task.CompletedTask;
        }

        public Task SendAsync(string message, CancellationToken ct)
        {
            if (_disposed || _instanceId < 0)
                throw new InvalidOperationException("WebSocket is not connected");
            GatrixWS_Send(_instanceId, message);
            return Task.CompletedTask;
        }

        public Task CloseAsync(CancellationToken ct)
        {
            if (_instanceId >= 0)
            {
                GatrixWS_Close(_instanceId, 1000, "SDK disconnect");
            }
            return Task.CompletedTask;
        }

        public WsEvent? PollEvent()
        {
            if (_instanceId < 0) return null;

            int eventType = 0;
            int result = GatrixWS_PollEvent(_instanceId, ref eventType, _pollBuffer, _pollBuffer.Length);
            if (result == 0) return null;

            // Find null terminator
            int len = 0;
            while (len < _pollBuffer.Length && _pollBuffer[len] != 0) len++;
            string data = len > 0 ? Encoding.UTF8.GetString(_pollBuffer, 0, len) : "";

            return new WsEvent
            {
                Type = (WsEventType)eventType,
                Data = data
            };
        }

        public void SetRequestHeader(string name, string value)
        {
            // Browser WebSocket does not support custom headers.
            // Auth is passed via query parameter instead.
        }

        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;
            if (_instanceId >= 0)
            {
                GatrixWS_Destroy(_instanceId);
                _instanceId = -1;
            }
        }
    }
#endif

#if !UNITY_WEBGL || UNITY_EDITOR
    /// <summary>
    /// Standard WebSocket implementation using System.Net.WebSockets.ClientWebSocket.
    /// Wraps async receive into a polled event queue for uniform API.
    /// </summary>
    internal class StandaloneWebSocket : IGatrixWebSocket
    {
        private ClientWebSocket _ws;
        private bool _disposed;
        private readonly Queue<WsEvent> _eventQueue = new Queue<WsEvent>();
        private CancellationTokenSource _receiveCts;
        private readonly byte[] _receiveBuffer = new byte[8192];
        private readonly StringBuilder _messageBuilder = new StringBuilder();

        public WsState State
        {
            get
            {
                if (_ws == null) return WsState.Closed;
                switch (_ws.State)
                {
                    case WebSocketState.Connecting: return WsState.Connecting;
                    case WebSocketState.Open: return WsState.Open;
                    case WebSocketState.CloseSent:
                    case WebSocketState.CloseReceived: return WsState.Closing;
                    default: return WsState.Closed;
                }
            }
        }

        public void SetRequestHeader(string name, string value)
        {
            if (_ws == null)
                _ws = new ClientWebSocket();
            _ws.Options.SetRequestHeader(name, value);
        }

        public async Task ConnectAsync(Uri uri, CancellationToken ct)
        {
            if (_disposed) throw new ObjectDisposedException(nameof(StandaloneWebSocket));
            if (_ws == null)
                _ws = new ClientWebSocket();

            await _ws.ConnectAsync(uri, ct);

            _eventQueue.Enqueue(new WsEvent { Type = WsEventType.Open, Data = "" });

            // Start background receive loop
            _receiveCts?.Cancel();
            _receiveCts?.Dispose();
            _receiveCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            _ = ReceiveLoopAsync(_receiveCts.Token);
        }

        public async Task SendAsync(string message, CancellationToken ct)
        {
            if (_ws == null || _ws.State != WebSocketState.Open)
                throw new InvalidOperationException("WebSocket is not connected");
            var bytes = Encoding.UTF8.GetBytes(message);
            await _ws.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, ct);
        }

        public async Task CloseAsync(CancellationToken ct)
        {
            _receiveCts?.Cancel();
            if (_ws != null && (_ws.State == WebSocketState.Open || _ws.State == WebSocketState.CloseReceived))
            {
                try
                {
                    await _ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "SDK disconnect", ct);
                }
                catch { /* Ignore close errors */ }
            }
        }

        public WsEvent? PollEvent()
        {
            if (_eventQueue.Count == 0) return null;
            return _eventQueue.Dequeue();
        }

        private async Task ReceiveLoopAsync(CancellationToken ct)
        {
            try
            {
                while (!ct.IsCancellationRequested && _ws?.State == WebSocketState.Open)
                {
                    var segment = new ArraySegment<byte>(_receiveBuffer);
                    WebSocketReceiveResult result;
                    try
                    {
                        result = await _ws.ReceiveAsync(segment, ct);
                    }
                    catch (OperationCanceledException) { break; }

                    if (result.MessageType == WebSocketMessageType.Close)
                    {
                        var closeCode = ((int?)result.CloseStatus ?? 1000).ToString();
                        _eventQueue.Enqueue(new WsEvent
                        {
                            Type = WsEventType.Close,
                            Data = closeCode + "|" + (result.CloseStatusDescription ?? "")
                        });
                        break;
                    }

                    if (result.MessageType == WebSocketMessageType.Text)
                    {
                        _messageBuilder.Append(Encoding.UTF8.GetString(_receiveBuffer, 0, result.Count));
                        if (result.EndOfMessage)
                        {
                            _eventQueue.Enqueue(new WsEvent
                            {
                                Type = WsEventType.Message,
                                Data = _messageBuilder.ToString()
                            });
                            _messageBuilder.Clear();
                        }
                    }
                }
            }
            catch (OperationCanceledException) { /* Expected */ }
            catch (Exception ex)
            {
                _eventQueue.Enqueue(new WsEvent
                {
                    Type = WsEventType.Error,
                    Data = ex.Message
                });
            }
        }

        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;
            _receiveCts?.Cancel();
            _receiveCts?.Dispose();
            _ws?.Dispose();
            _ws = null;
        }
    }
#endif

    /// <summary>
    /// Factory for creating the appropriate platform WebSocket client.
    /// </summary>
    internal static class GatrixWebSocketFactory
    {
        public static IGatrixWebSocket Create()
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            return new WebGLWebSocket();
#else
            return new StandaloneWebSocket();
#endif
        }
    }
}
