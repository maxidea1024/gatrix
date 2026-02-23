// GatrixWebSocket.jslib - WebGL WebSocket plugin for Gatrix Unity SDK
// Wraps the browser's native WebSocket API for use via C# [DllImport]

var GatrixWebSocketPlugin = {

    $GatrixWS: {
        instances: {},
        nextId: 1,
        buffer: {},

        // Allocate a string on the Unity heap so C# can read it
        AllocString: function(str) {
            var bufferSize = lengthBytesUTF8(str) + 1;
            var buffer = _malloc(bufferSize);
            stringToUTF8(str, buffer, bufferSize);
            return buffer;
        }
    },

    GatrixWS_Create: function(urlPtr) {
        var url = UTF8ToString(urlPtr);
        var id = GatrixWS.nextId++;
        GatrixWS.buffer[id] = [];

        try {
            var ws = new WebSocket(url);
            ws.binaryType = 'arraybuffer';

            ws.onopen = function() {
                GatrixWS.buffer[id].push({ type: 1, data: '' }); // 1 = Open
            };
            ws.onmessage = function(evt) {
                var msg = (typeof evt.data === 'string') ? evt.data : '';
                GatrixWS.buffer[id].push({ type: 2, data: msg }); // 2 = Message
            };
            ws.onerror = function() {
                GatrixWS.buffer[id].push({ type: 3, data: 'WebSocket error' }); // 3 = Error
            };
            ws.onclose = function(evt) {
                var reason = evt.reason || '';
                GatrixWS.buffer[id].push({ type: 4, data: evt.code + '|' + reason }); // 4 = Close
            };

            GatrixWS.instances[id] = ws;
        } catch (e) {
            GatrixWS.buffer[id].push({ type: 3, data: e.message || 'Failed to create WebSocket' });
            GatrixWS.instances[id] = null;
        }

        return id;
    },

    GatrixWS_Send: function(id, msgPtr) {
        var ws = GatrixWS.instances[id];
        if (ws && ws.readyState === WebSocket.OPEN) {
            var msg = UTF8ToString(msgPtr);
            ws.send(msg);
            return 0; // success
        }
        return -1; // not connected
    },

    GatrixWS_Close: function(id, code, reasonPtr) {
        var ws = GatrixWS.instances[id];
        if (ws) {
            try {
                var reason = UTF8ToString(reasonPtr);
                ws.close(code, reason);
            } catch (e) {
                // ignore
            }
        }
    },

    GatrixWS_GetState: function(id) {
        var ws = GatrixWS.instances[id];
        if (!ws) return 3; // CLOSED
        return ws.readyState; // 0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED
    },

    GatrixWS_PollEvent: function(id, outTypePtr, outDataPtr, outDataMaxLen) {
        var buf = GatrixWS.buffer[id];
        if (!buf || buf.length === 0) return 0; // no event

        var evt = buf.shift();
        HEAP32[outTypePtr >> 2] = evt.type;

        if (evt.data && outDataMaxLen > 0) {
            var maxBytes = outDataMaxLen - 1;
            var dataBytes = lengthBytesUTF8(evt.data);
            if (dataBytes > maxBytes) {
                // Truncate - shouldn't happen with reasonable buffer sizes
                var truncated = evt.data.substring(0, maxBytes);
                stringToUTF8(truncated, outDataPtr, outDataMaxLen);
            } else {
                stringToUTF8(evt.data, outDataPtr, outDataMaxLen);
            }
        } else if (outDataMaxLen > 0) {
            HEAP8[outDataPtr] = 0;
        }

        return 1; // had event
    },

    GatrixWS_Destroy: function(id) {
        var ws = GatrixWS.instances[id];
        if (ws) {
            try {
                if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
                    ws.close(1000, 'SDK destroy');
                }
            } catch (e) { /* ignore */ }
            ws.onopen = null;
            ws.onmessage = null;
            ws.onerror = null;
            ws.onclose = null;
        }
        delete GatrixWS.instances[id];
        delete GatrixWS.buffer[id];
    }
};

autoAddDeps(GatrixWebSocketPlugin, '$GatrixWS');
mergeInto(LibraryManager.library, GatrixWebSocketPlugin);
