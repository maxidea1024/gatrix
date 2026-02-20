#ifndef GATRIX_STREAMING_H
#define GATRIX_STREAMING_H

#include "GatrixEventEmitter.h"
#include "GatrixTypes.h"
#include <chrono>
#include <functional>
#include <mutex>
#include <random>
#include <set>
#include <string>
#include <thread>
#include <vector>

namespace cocos2d {
namespace network {
class WebSocket;
}
} // namespace cocos2d

namespace gatrix {

class FeaturesClient;

/**
 * StreamingManager - Manages SSE and WebSocket streaming connections
 * for real-time flag invalidation.
 *
 * Handles connection lifecycle, reconnection with exponential backoff + jitter,
 * event parsing, and gap recovery.
 */
class StreamingManager {
public:
  using InvalidationCallback = std::function<void(const std::vector<std::string>&)>;
  using FetchCallback = std::function<void()>;

  StreamingManager(const GatrixClientConfig& config, GatrixEventEmitter& emitter);
  ~StreamingManager();

  // No copy/move
  StreamingManager(const StreamingManager&) = delete;
  StreamingManager& operator=(const StreamingManager&) = delete;

  /// Start streaming connection (SSE or WebSocket based on config)
  void connect();

  /// Disconnect and stop all streaming
  void disconnect();

  /// Get current connection state
  StreamingConnectionState getState() const { return _state; }

  /// Set callback for when flags are invalidated
  void setInvalidationCallback(InvalidationCallback cb) { _onInvalidation = std::move(cb); }

  /// Set callback for full fetch request (gap recovery)
  void setFetchCallback(FetchCallback cb) { _onFetchRequest = std::move(cb); }

  /// Set connection ID for API headers
  void setConnectionId(const std::string& connectionId) { _connectionId = connectionId; }

  // Statistics
  int getReconnectCount() const { return _reconnectCount; }
  int getEventCount() const { return _eventCount; }
  int getErrorCount() const { return _errorCount; }
  int getRecoveryCount() const { return _recoveryCount; }
  std::string getLastError() const { return _lastError; }
  std::string getLastEventTime() const;
  std::string getLastErrorTime() const;
  std::string getLastRecoveryTime() const;
  std::string getTransportName() const;
  std::string getStateName() const;

private:
  // SSE connection
  void connectSse();
  void runSseLoop();
  void parseSseChunk(const std::string& chunk);

  // WebSocket connection
  void connectWebSocket();

  // Common event processing
  void processStreamingEvent(const std::string& eventType, const std::string& eventData);

  // Reconnection
  void scheduleReconnect();
  int calculateReconnectDelay();

  // Error/recovery tracking
  void trackError(const std::string& errorMessage);
  void trackRecovery();

  // Helpers
  std::string buildSseUrl() const;
  std::string buildWsUrl() const;
  std::string buildQueryParams() const;

  // Config
  const GatrixClientConfig& _config;
  GatrixEventEmitter& _emitter;
  std::string _connectionId;

  // State
  StreamingConnectionState _state = StreamingConnectionState::DISCONNECTED;
  long _localGlobalRevision = 0;
  bool _stopRequested = false;

  // Callbacks
  InvalidationCallback _onInvalidation;
  FetchCallback _onFetchRequest;

  // Reconnection state
  int _reconnectAttempt = 0;
  int _reconnectCount = 0;

  // SSE thread
  std::thread _sseThread;

  // WebSocket
  cocos2d::network::WebSocket* _ws = nullptr;

  // Reconnect timer thread
  std::thread _reconnectThread;

  // WebSocket ping thread
  std::thread _pingThread;
  bool _pingStopRequested = false;

  // Statistics
  int _eventCount = 0;
  int _errorCount = 0;
  int _recoveryCount = 0;
  std::string _lastError;
  std::chrono::system_clock::time_point _lastEventTime;
  std::chrono::system_clock::time_point _lastErrorTime;
  std::chrono::system_clock::time_point _lastRecoveryTime;

  // SSE parser state
  std::string _sseCurrentEventType;
  std::string _sseDataBuffer;
  std::string _sseLineBuffer;

  // Thread safety
  mutable std::mutex _mutex;
  std::mt19937 _rng;
};

} // namespace gatrix

#endif // GATRIX_STREAMING_H
