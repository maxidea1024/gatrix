// GatrixStreaming.cpp - SSE and WebSocket streaming for real-time flag updates
//
// SSE: Uses Cocos2d-x HttpClient for chunked streaming
// WebSocket: Uses Cocos2d-x WebSocket class (Delegate pattern)

#include "GatrixStreaming.h"
#include "GatrixEvents.h"
#include "GatrixVersion.h"
#include "cocos2d.h"
#include "json/document.h"
#include "json/stringbuffer.h"
#include "json/writer.h"
#include "network/HttpClient.h"
#include "network/WebSocket.h"
#include <algorithm>
#include <chrono>
#include <cmath>
#include <sstream>

using namespace cocos2d;
using namespace cocos2d::network;

namespace gatrix {

// ==================== WebSocket Delegate ====================

class GatrixWsDelegate : public WebSocket::Delegate {
public:
  GatrixWsDelegate(StreamingManager* owner) : _owner(owner) {}

  void onOpen(WebSocket* ws) override {
    if (!_owner)
      return;
    Director::getInstance()->getScheduler()->performFunctionInCocosThread([this]() {
      if (_onOpen)
        _onOpen();
    });
  }

  void onMessage(WebSocket* ws, const WebSocket::Data& data) override {
    if (!_owner)
      return;
    std::string msg(data.bytes, data.len);
    Director::getInstance()->getScheduler()->performFunctionInCocosThread([this, msg]() {
      if (_onMessage)
        _onMessage(msg);
    });
  }

  void onClose(WebSocket* ws) override {
    if (!_owner)
      return;
    Director::getInstance()->getScheduler()->performFunctionInCocosThread([this]() {
      if (_onClose)
        _onClose();
    });
  }

  void onError(WebSocket* ws, const WebSocket::ErrorCode& error) override {
    if (!_owner)
      return;
    std::string errorMsg = "WebSocket error code: " + std::to_string(static_cast<int>(error));
    Director::getInstance()->getScheduler()->performFunctionInCocosThread([this, errorMsg]() {
      if (_onError)
        _onError(errorMsg);
    });
  }

  void detach() { _owner = nullptr; }

  std::function<void()> _onOpen;
  std::function<void(const std::string&)> _onMessage;
  std::function<void()> _onClose;
  std::function<void(const std::string&)> _onError;

private:
  StreamingManager* _owner;
};

// ==================== StreamingManager ====================

StreamingManager::StreamingManager(const GatrixClientConfig& config, GatrixEventEmitter& emitter)
    : _config(config), _emitter(emitter) {
  // Seed RNG for jitter
  std::random_device rd;
  _rng.seed(rd());
}

StreamingManager::~StreamingManager() {
  disconnect();
}

void StreamingManager::connect() {
  std::lock_guard<std::mutex> lock(_mutex);

  if (_state == StreamingConnectionState::CONNECTED ||
      _state == StreamingConnectionState::CONNECTING) {
    return;
  }

  _state = StreamingConnectionState::CONNECTING;
  _stopRequested = false;

  if (_config.streaming.transport == StreamingTransport::WEBSOCKET) {
    connectWebSocket();
  } else {
    connectSse();
  }
}

void StreamingManager::disconnect() {
  {
    std::lock_guard<std::mutex> lock(_mutex);
    _state = StreamingConnectionState::DISCONNECTED;
    _stopRequested = true;
    _pingStopRequested = true;
  }

  // Stop SSE thread
  if (_sseThread.joinable()) {
    _sseThread.join();
  }

  // Stop reconnect thread
  if (_reconnectThread.joinable()) {
    _reconnectThread.join();
  }

  // Stop ping thread
  if (_pingThread.joinable()) {
    _pingThread.join();
  }

  // Close WebSocket
  if (_ws) {
    auto delegate = dynamic_cast<GatrixWsDelegate*>(_ws->getDelegate());
    if (delegate)
      delegate->detach();
    _ws->close();
    _ws = nullptr;
  }
}

// ==================== SSE ====================

std::string StreamingManager::buildSseUrl() const {
  std::string baseUrl = _config.streaming.sse.url;
  if (baseUrl.empty()) {
    baseUrl = _config.apiUrl + "/client/features/" + _config.environment + "/stream/sse";
  }

  // Add query params
  auto params = buildQueryParams();
  if (baseUrl.find('?') != std::string::npos) {
    baseUrl += "&" + params;
  } else {
    baseUrl += "?" + params;
  }
  return baseUrl;
}

std::string StreamingManager::buildWsUrl() const {
  std::string baseUrl = _config.streaming.ws.url;
  if (baseUrl.empty()) {
    // Convert http(s):// to ws(s)://
    baseUrl = _config.apiUrl;
    if (baseUrl.find("https://") == 0) {
      baseUrl.replace(0, 8, "wss://");
    } else if (baseUrl.find("http://") == 0) {
      baseUrl.replace(0, 7, "ws://");
    }
    baseUrl += "/client/features/" + _config.environment + "/stream/ws";
  }

  // Add query params
  auto params = buildQueryParams();
  if (baseUrl.find('?') != std::string::npos) {
    baseUrl += "&" + params;
  } else {
    baseUrl += "?" + params;
  }
  return baseUrl;
}

std::string StreamingManager::buildQueryParams() const {
  std::string params;
  params += "x-api-token=" + _config.apiToken;
  params += "&appName=" + _config.appName;
  params += "&environment=" + _config.environment;
  params += "&connectionId=" + _connectionId;
  params += "&sdkVersion=" + std::string(SDK_NAME) + "/" + std::string(SDK_VERSION);
  return params;
}

void StreamingManager::connectSse() {
  CCLOG("[Gatrix] Connecting to SSE streaming endpoint...");

  // Stop existing SSE thread
  _stopRequested = true;
  if (_sseThread.joinable()) {
    _sseThread.join();
  }
  _stopRequested = false;

  _sseThread = std::thread([this]() { runSseLoop(); });
}

void StreamingManager::runSseLoop() {
  auto streamUrl = buildSseUrl();
  CCLOG("[Gatrix] SSE stream URL: %s", streamUrl.c_str());

  // Use Cocos2d-x HttpClient for the SSE request
  auto request = new HttpRequest();
  request->setRequestType(HttpRequest::Type::GET);
  request->setUrl(streamUrl);

  // Set SSE headers
  std::vector<std::string> headers;
  headers.push_back("Accept: text/event-stream");
  headers.push_back("Cache-Control: no-cache");
  headers.push_back("X-API-Token: " + _config.apiToken);
  headers.push_back("X-Application-Name: " + _config.appName);
  headers.push_back("X-Environment: " + _config.environment);
  headers.push_back("X-Connection-Id: " + _connectionId);
  headers.push_back("X-SDK-Version: " + std::string(SDK_NAME) + "/" + std::string(SDK_VERSION));
  for (auto& kv : _config.customHeaders) {
    headers.push_back(kv.first + ": " + kv.second);
  }
  request->setHeaders(headers);

  // Response callback (runs on main thread via Cocos2d-x scheduler)
  request->setResponseCallback([this](HttpClient* client, HttpResponse* response) {
    if (_stopRequested)
      return;

    if (!response || !response->isSucceed()) {
      std::string errorMsg = "SSE connection failed";
      if (response) {
        errorMsg += ": HTTP " + std::to_string(response->getResponseCode());
      }
      trackError(errorMsg);
      _state = StreamingConnectionState::RECONNECTING;
      _emitter.emit(EVENTS::FLAGS_STREAMING_ERROR, {errorMsg});
      _emitter.emit(EVENTS::FLAGS_STREAMING_DISCONNECTED);
      scheduleReconnect();
      return;
    }

    auto statusCode = response->getResponseCode();
    if (statusCode != 200) {
      std::string errorMsg = "SSE HTTP error: " + std::to_string(statusCode);
      trackError(errorMsg);
      _state = StreamingConnectionState::RECONNECTING;
      _emitter.emit(EVENTS::FLAGS_STREAMING_ERROR, {errorMsg});
      _emitter.emit(EVENTS::FLAGS_STREAMING_DISCONNECTED);
      scheduleReconnect();
      return;
    }

    // Track recovery if this was a reconnection
    if (_reconnectCount > 0) {
      trackRecovery();
    }
    _state = StreamingConnectionState::CONNECTED;
    _reconnectAttempt = 0;
    CCLOG("[Gatrix] SSE streaming connected");
    _emitter.emit(EVENTS::FLAGS_STREAMING_CONNECTED);

    // Parse SSE data from the response body
    auto* data = response->getResponseData();
    if (data && !data->empty()) {
      std::string body(data->begin(), data->end());
      parseSseChunk(body);
    }

    // SSE connection ended (server closed) - schedule reconnect
    if (!_stopRequested && _state != StreamingConnectionState::DISCONNECTED) {
      CCLOG("[Gatrix] SSE connection closed by server");
      _state = StreamingConnectionState::RECONNECTING;
      _emitter.emit(EVENTS::FLAGS_STREAMING_DISCONNECTED);
      scheduleReconnect();
    }
  });

  HttpClient::getInstance()->send(request);
  request->release();
}

void StreamingManager::parseSseChunk(const std::string& chunk) {
  _sseLineBuffer += chunk;

  // Process complete lines
  size_t pos = 0;
  while (pos < _sseLineBuffer.size()) {
    auto newlinePos = _sseLineBuffer.find('\n', pos);
    if (newlinePos == std::string::npos)
      break;

    std::string line = _sseLineBuffer.substr(pos, newlinePos - pos);
    pos = newlinePos + 1;

    // Remove trailing \r
    if (!line.empty() && line.back() == '\r') {
      line.pop_back();
    }

    if (line.empty()) {
      // Empty line = dispatch event
      if (!_sseCurrentEventType.empty() || !_sseDataBuffer.empty()) {
        auto eventType = _sseCurrentEventType.empty() ? "message" : _sseCurrentEventType;
        auto eventData = _sseDataBuffer;
        _sseCurrentEventType.clear();
        _sseDataBuffer.clear();
        processStreamingEvent(eventType, eventData);
      }
    } else if (line.find("event:") == 0) {
      _sseCurrentEventType = line.substr(6);
      // Trim leading whitespace
      auto start = _sseCurrentEventType.find_first_not_of(' ');
      if (start != std::string::npos) {
        _sseCurrentEventType = _sseCurrentEventType.substr(start);
      }
    } else if (line.find("data:") == 0) {
      auto data = line.substr(5);
      auto start = data.find_first_not_of(' ');
      if (start != std::string::npos) {
        data = data.substr(start);
      }
      if (!_sseDataBuffer.empty())
        _sseDataBuffer += "\n";
      _sseDataBuffer += data;
    }
    // Ignore 'id:', 'retry:', and comment lines starting with ':'
  }

  // Keep remaining incomplete data
  if (pos < _sseLineBuffer.size()) {
    _sseLineBuffer = _sseLineBuffer.substr(pos);
  } else {
    _sseLineBuffer.clear();
  }
}

// ==================== WebSocket ====================

void StreamingManager::connectWebSocket() {
  CCLOG("[Gatrix] Connecting to WebSocket streaming endpoint...");

  // Close existing WebSocket
  if (_ws) {
    auto delegate = dynamic_cast<GatrixWsDelegate*>(_ws->getDelegate());
    if (delegate)
      delegate->detach();
    _ws->close();
    _ws = nullptr;
  }

  auto wsUrl = buildWsUrl();
  CCLOG("[Gatrix] WebSocket URL: %s", wsUrl.c_str());

  auto delegate = new GatrixWsDelegate(this);

  // On open
  delegate->_onOpen = [this]() {
    if (_stopRequested)
      return;

    if (_reconnectCount > 0) {
      trackRecovery();
    }
    _state = StreamingConnectionState::CONNECTED;
    _reconnectAttempt = 0;
    CCLOG("[Gatrix] WebSocket streaming connected");
    _emitter.emit(EVENTS::FLAGS_STREAMING_CONNECTED);

    // Start ping loop
    _pingStopRequested = false;
    if (_pingThread.joinable())
      _pingThread.join();
    _pingThread = std::thread([this]() {
      int pingIntervalMs = _config.streaming.ws.pingInterval * 1000;
      while (!_pingStopRequested) {
        std::this_thread::sleep_for(std::chrono::milliseconds(pingIntervalMs));
        if (_pingStopRequested)
          break;

        // Send ping on main thread
        Director::getInstance()->getScheduler()->performFunctionInCocosThread([this]() {
          if (_ws && _state == StreamingConnectionState::CONNECTED) {
            _ws->send("{\"type\":\"ping\"}");
          }
        });
      }
    });
  };

  // On message
  delegate->_onMessage = [this](const std::string& msg) {
    if (_stopRequested)
      return;

    // Parse JSON message
    rapidjson::Document doc;
    doc.Parse(msg.c_str());

    if (doc.HasParseError() || !doc.IsObject()) {
      CCLOG("[Gatrix] Failed to parse WebSocket message");
      return;
    }

    if (!doc.HasMember("type") || !doc["type"].IsString())
      return;

    std::string eventType = doc["type"].GetString();

    // Handle pong locally
    if (eventType == "pong")
      return;

    std::string eventData;
    if (doc.HasMember("data") && doc["data"].IsObject()) {
      rapidjson::StringBuffer sb;
      rapidjson::Writer<rapidjson::StringBuffer> writer(sb);
      doc["data"].Accept(writer);
      eventData = sb.GetString();
    }

    processStreamingEvent(eventType, eventData);
  };

  // On close
  delegate->_onClose = [this]() {
    if (_stopRequested || _state == StreamingConnectionState::DISCONNECTED)
      return;

    CCLOG("[Gatrix] WebSocket connection closed by server");
    _state = StreamingConnectionState::RECONNECTING;
    _emitter.emit(EVENTS::FLAGS_STREAMING_DISCONNECTED);
    _pingStopRequested = true;
    scheduleReconnect();
  };

  // On error
  delegate->_onError = [this](const std::string& errorMsg) {
    if (_stopRequested)
      return;

    trackError(errorMsg);
    CCLOG("[Gatrix] WebSocket error: %s", errorMsg.c_str());
    _emitter.emit(EVENTS::FLAGS_STREAMING_ERROR, {errorMsg});

    if (_state != StreamingConnectionState::RECONNECTING) {
      _state = StreamingConnectionState::RECONNECTING;
      _emitter.emit(EVENTS::FLAGS_STREAMING_DISCONNECTED);
    }
    _pingStopRequested = true;
    scheduleReconnect();
  };

  _ws = new WebSocket();
  // Custom headers via the protocols param is not supported in cocos2d-x
  // WebSocket. Query params are used instead (set in buildWsUrl).
  _ws->init(*delegate, wsUrl);
}

// ==================== Event Processing ====================

void StreamingManager::processStreamingEvent(const std::string& eventType,
                                             const std::string& eventData) {
  _lastEventTime = std::chrono::system_clock::now();
  _eventCount++;

  if (eventType == "connected") {
    rapidjson::Document doc;
    doc.Parse(eventData.c_str());

    if (!doc.HasParseError() && doc.IsObject()) {
      long serverRevision = 0;
      if (doc.HasMember("globalRevision")) {
        if (doc["globalRevision"].IsInt64()) {
          serverRevision = doc["globalRevision"].GetInt64();
        } else if (doc["globalRevision"].IsInt()) {
          serverRevision = doc["globalRevision"].GetInt();
        } else if (doc["globalRevision"].IsDouble()) {
          serverRevision = static_cast<long>(doc["globalRevision"].GetDouble());
        }
      }

      CCLOG("[Gatrix] Streaming 'connected' event: globalRevision=%ld", serverRevision);

      // Gap recovery: check if we missed any changes
      if (serverRevision > _localGlobalRevision && _localGlobalRevision > 0) {
        CCLOG("[Gatrix] Gap detected: server=%ld, local=%ld. Triggering "
              "recovery.",
              serverRevision, _localGlobalRevision);
        _localGlobalRevision = serverRevision;
        if (_onFetchRequest)
          _onFetchRequest();
      } else if (_localGlobalRevision == 0) {
        _localGlobalRevision = serverRevision;
      }
    }
  } else if (eventType == "flags_changed") {
    rapidjson::Document doc;
    doc.Parse(eventData.c_str());

    if (!doc.HasParseError() && doc.IsObject()) {
      long serverRevision = 0;
      if (doc.HasMember("globalRevision")) {
        if (doc["globalRevision"].IsInt64()) {
          serverRevision = doc["globalRevision"].GetInt64();
        } else if (doc["globalRevision"].IsInt()) {
          serverRevision = doc["globalRevision"].GetInt();
        } else if (doc["globalRevision"].IsDouble()) {
          serverRevision = static_cast<long>(doc["globalRevision"].GetDouble());
        }
      }

      std::vector<std::string> changedKeys;
      if (doc.HasMember("changedKeys") && doc["changedKeys"].IsArray()) {
        for (auto& key : doc["changedKeys"].GetArray()) {
          if (key.IsString()) {
            changedKeys.push_back(key.GetString());
          }
        }
      }

      CCLOG("[Gatrix] Streaming 'flags_changed': globalRevision=%ld, "
            "changedKeys=%zu",
            serverRevision, changedKeys.size());

      // Only process if server revision is ahead
      if (serverRevision > _localGlobalRevision) {
        _localGlobalRevision = serverRevision;
        _emitter.emit(EVENTS::FLAGS_INVALIDATED);
        if (_onInvalidation) {
          _onInvalidation(changedKeys);
        }
      } else {
        CCLOG("[Gatrix] Ignoring stale event: server=%ld <= local=%ld", serverRevision,
              _localGlobalRevision);
      }
    }
  } else if (eventType == "heartbeat") {
    CCLOG("[Gatrix] Streaming heartbeat received");
  } else {
    CCLOG("[Gatrix] Unknown streaming event: %s", eventType.c_str());
  }
}

// ==================== Reconnection ====================

int StreamingManager::calculateReconnectDelay() {
  int baseMs, maxMs;
  if (_config.streaming.transport == StreamingTransport::WEBSOCKET) {
    baseMs = _config.streaming.ws.reconnectBase * 1000;
    maxMs = _config.streaming.ws.reconnectMax * 1000;
  } else {
    baseMs = _config.streaming.sse.reconnectBase * 1000;
    maxMs = _config.streaming.sse.reconnectMax * 1000;
  }

  // Exponential backoff: base * 2^(attempt-1), capped at max
  int exponentialDelay =
      static_cast<int>(std::min(static_cast<double>(baseMs) * std::pow(2.0, _reconnectAttempt - 1),
                                static_cast<double>(maxMs)));

  // Add jitter (0 - 1000ms)
  std::uniform_int_distribution<int> dist(0, 1000);
  int jitter = dist(_rng);

  return exponentialDelay + jitter;
}

void StreamingManager::scheduleReconnect() {
  if (_state == StreamingConnectionState::DISCONNECTED || _stopRequested) {
    return;
  }

  _reconnectAttempt++;
  _reconnectCount++;

  int delayMs = calculateReconnectDelay();

  CCLOG("[Gatrix] Scheduling streaming reconnect: attempt=%d, delay=%dms", _reconnectAttempt,
        delayMs);

  _emitter.emit(EVENTS::FLAGS_STREAMING_RECONNECTING);

  // Transition to degraded after several failed attempts
  if (_reconnectAttempt >= 5 && _state != StreamingConnectionState::DEGRADED) {
    _state = StreamingConnectionState::DEGRADED;
    CCLOG("[Gatrix] Streaming degraded: falling back to polling-only mode");
  }

  // Use a thread to wait before reconnecting on main thread
  if (_reconnectThread.joinable()) {
    // Detach old reconnect thread (it may still be sleeping)
    _reconnectThread.detach();
  }
  _reconnectThread = std::thread([this, delayMs]() {
    std::this_thread::sleep_for(std::chrono::milliseconds(delayMs));
    if (_stopRequested)
      return;

    Director::getInstance()->getScheduler()->performFunctionInCocosThread([this]() {
      if (!_stopRequested && _state != StreamingConnectionState::DISCONNECTED) {
        connect();
      }
    });
  });
}

// ==================== Stats ====================

void StreamingManager::trackError(const std::string& errorMessage) {
  _errorCount++;
  _lastErrorTime = std::chrono::system_clock::now();
  _lastError = errorMessage;
}

void StreamingManager::trackRecovery() {
  _recoveryCount++;
  _lastRecoveryTime = std::chrono::system_clock::now();
}

static std::string timePointToString(const std::chrono::system_clock::time_point& tp) {
  if (tp.time_since_epoch().count() == 0)
    return "";
  auto t = std::chrono::system_clock::to_time_t(tp);
  char buf[64];
  std::strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", std::gmtime(&t));
  return std::string(buf);
}

std::string StreamingManager::getLastEventTime() const {
  return timePointToString(_lastEventTime);
}

std::string StreamingManager::getLastErrorTime() const {
  return timePointToString(_lastErrorTime);
}

std::string StreamingManager::getLastRecoveryTime() const {
  return timePointToString(_lastRecoveryTime);
}

std::string StreamingManager::getTransportName() const {
  return _config.streaming.transport == StreamingTransport::WEBSOCKET ? "websocket" : "sse";
}

std::string StreamingManager::getStateName() const {
  switch (_state) {
  case StreamingConnectionState::DISCONNECTED:
    return "disconnected";
  case StreamingConnectionState::CONNECTING:
    return "connecting";
  case StreamingConnectionState::CONNECTED:
    return "connected";
  case StreamingConnectionState::RECONNECTING:
    return "reconnecting";
  case StreamingConnectionState::DEGRADED:
    return "degraded";
  default:
    return "unknown";
  }
}

} // namespace gatrix
