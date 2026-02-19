#include "GatrixFeaturesClient.h"
#include "GatrixClient.h"
#include "cocos2d.h"
#include "network/HttpClient.h"
#include "json/document.h"
#include "json/stringbuffer.h"
#include "json/writer.h"
#include <algorithm>
#include <cmath>
#include <sstream>

using namespace cocos2d;
using namespace cocos2d::network;

namespace gatrix {

// ==================== FeaturesClient ====================

FeaturesClient::FeaturesClient(const GatrixClientConfig &config,
                               GatrixEventEmitter &emitter)
    : _config(config), _emitter(emitter), _context(config.context) {
  // Generate connection ID
  auto genHex = [](int len) {
    static const char chars[] = "0123456789abcdef";
    std::string s;
    s.reserve(len);
    for (int i = 0; i < len; i++)
      s += chars[rand() % 16];
    return s;
  };
  _connectionId = genHex(8) + "-" + genHex(4) + "-" + genHex(4) + "-" +
                  genHex(4) + "-" + genHex(12);

  // Set system context
  _context.properties["appName"] = _config.appName;
  _context.properties["environment"] = _config.environment;

  // Storage
  _storage = &_defaultStorage;
  _explicitSyncMode = _config.explicitSyncMode;
}

FeaturesClient::~FeaturesClient() {
  stop();
  for (auto *group : _watchGroups) {
    delete group;
  }
  _watchGroups.clear();
}

void FeaturesClient::start() {
  if (_started)
    return;
  _started = true;
  _consecutiveFailures = 0;
  _pollingStopped = false;
  if (_config.enableDevMode) {
    CCLOG("[GatrixSDK][DEV] start() called. offlineMode=%s, "
          "refreshInterval=%d, explicitSyncMode=%s",
          _config.offlineMode ? "True" : "False", _config.refreshInterval,
          _explicitSyncMode ? "True" : "False");
  }
  _stats.startTime = GatrixEventEmitter::nowISO(); // Would need to make this
                                                   // public or use a utility

  // 1. Init from bootstrap if available
  if (!_config.bootstrap.empty()) {
    initFromBootstrap();
  }

  // 2. Init from storage
  initFromStorage();

  // 3. Fetch from server (unless offline mode)
  // scheduleNextRefresh() is called by the response callback after each fetch
  if (!_config.offlineMode) {
    fetchFlags();
  }
}

void FeaturesClient::stop() {
  if (_config.enableDevMode) {
    CCLOG("[GatrixSDK][DEV] stop() called");
  }
  unschedulePolling();
  _started = false;
  _sdkState = SdkState::STOPPED;
  _pollingStopped = true;
  _consecutiveFailures = 0;
}

// ==================== Context ====================

GatrixContext FeaturesClient::getContext() const { return _context; }

void FeaturesClient::updateContext(const GatrixContext &context) {
  _context.userId = context.userId;
  _context.sessionId = context.sessionId;
  if (!context.currentTime.empty())
    _context.currentTime = context.currentTime;

  for (const auto &[key, val] : context.properties) {
    _context.properties[key] = val;
  }

  _stats.contextChangeCount++;

  if (_started && !_config.offlineMode) {
    fetchFlags();
  }
}

// ==================== Flag Access ====================

const std::map<std::string, EvaluatedFlag> &
FeaturesClient::selectFlags(bool forceRealtime) const {
  if (forceRealtime)
    return _realtimeFlags;
  return _explicitSyncMode ? _synchronizedFlags : _realtimeFlags;
}

// Shared flag lookup: handles missing count, trackAccess, trackImpression
const EvaluatedFlag *FeaturesClient::lookupFlag(const std::string &flagName,
                                                const std::string &eventType,
                                                bool forceRealtime) {
  const auto &flags = selectFlags(forceRealtime);
  auto it = flags.find(flagName);
  if (it == flags.end()) {
    _stats.missingFlags[flagName]++;
    return nullptr;
  }
  trackAccess(flagName, it->second.enabled, it->second.variant.name, eventType);
  if (it->second.impressionData || _config.impressionDataAll)
    trackImpression(it->second, eventType);
  return &it->second;
}

bool FeaturesClient::isEnabled(const std::string &flagName,
                               bool forceRealtime) {
  auto *flag = lookupFlag(flagName, "isEnabled", forceRealtime);
  if (!flag)
    return false;
  return flag->enabled;
}

Variant FeaturesClient::getVariant(const std::string &flagName,
                                   bool forceRealtime) {
  return getVariantInternal(flagName, forceRealtime);
}

std::vector<EvaluatedFlag> FeaturesClient::getAllFlags() const {
  std::vector<EvaluatedFlag> result;
  for (const auto &[name, f] : selectFlags()) {
    result.push_back(f);
  }
  return result;
}

FlagProxy FeaturesClient::createProxy(const std::string &flagName,
                                      bool forceRealtime) {
  // Track access for initial proxy creation
  const auto &flags = selectFlags(forceRealtime);
  auto it = flags.find(flagName);
  const EvaluatedFlag *flag = (it != flags.end()) ? &it->second : nullptr;

  if (flag) {
    trackAccess(flagName, flag->enabled, flag->variant.name, "watch");
    if (flag->impressionData || _config.impressionDataAll)
      trackImpression(*flag, "watch");
  } else {
    _stats.missingFlags[flagName]++;
  }

  return FlagProxy(this, flagName, forceRealtime);
}

bool FeaturesClient::hasFlag(const std::string &flagName) const {
  const auto &flags = selectFlags();
  return flags.find(flagName) != flags.end();
}

// ==================== Variations ====================

std::string FeaturesClient::variation(const std::string &flagName,
                                      const std::string &fallbackValue,
                                      bool forceRealtime) {
  auto *flag = lookupFlag(flagName, "getVariant", forceRealtime);
  if (!flag)
    return fallbackValue;
  return flag->variant.name.empty() ? fallbackValue : flag->variant.name;
}

bool FeaturesClient::boolVariation(const std::string &flagName,
                                   bool fallbackValue, bool forceRealtime) {
  return boolVariationInternal(flagName, fallbackValue, forceRealtime);
}

std::string FeaturesClient::stringVariation(const std::string &flagName,
                                            const std::string &fallbackValue,
                                            bool forceRealtime) {
  return stringVariationInternal(flagName, fallbackValue, forceRealtime);
}

int FeaturesClient::intVariation(const std::string &flagName, int fallbackValue,
                                 bool forceRealtime) {
  return intVariationInternal(flagName, fallbackValue, forceRealtime);
}

float FeaturesClient::floatVariation(const std::string &flagName,
                                     float fallbackValue, bool forceRealtime) {
  return floatVariationInternal(flagName, fallbackValue, forceRealtime);
}

double FeaturesClient::doubleVariation(const std::string &flagName,
                                       double fallbackValue,
                                       bool forceRealtime) {
  return doubleVariationInternal(flagName, fallbackValue, forceRealtime);
}

std::string FeaturesClient::jsonVariation(const std::string &flagName,
                                          const std::string &fallbackValue,
                                          bool forceRealtime) {
  return jsonVariationInternal(flagName, fallbackValue, forceRealtime);
}

// ==================== Variation Details ====================

VariationResult<bool>
FeaturesClient::boolVariationDetails(const std::string &flagName,
                                     bool fallbackValue, bool forceRealtime) {
  return boolVariationDetailsInternal(flagName, fallbackValue, forceRealtime);
}

VariationResult<std::string>
FeaturesClient::stringVariationDetails(const std::string &flagName,
                                       const std::string &fallbackValue,
                                       bool forceRealtime) {
  return stringVariationDetailsInternal(flagName, fallbackValue, forceRealtime);
}

VariationResult<int>
FeaturesClient::intVariationDetails(const std::string &flagName,
                                    int fallbackValue, bool forceRealtime) {
  return intVariationDetailsInternal(flagName, fallbackValue, forceRealtime);
}

VariationResult<float>
FeaturesClient::floatVariationDetails(const std::string &flagName,
                                      float fallbackValue, bool forceRealtime) {
  return floatVariationDetailsInternal(flagName, fallbackValue, forceRealtime);
}

VariationResult<double> FeaturesClient::doubleVariationDetails(
    const std::string &flagName, double fallbackValue, bool forceRealtime) {
  return doubleVariationDetailsInternal(flagName, fallbackValue, forceRealtime);
}

VariationResult<std::string>
FeaturesClient::jsonVariationDetails(const std::string &flagName,
                                     const std::string &fallbackValue,
                                     bool forceRealtime) {
  return jsonVariationDetailsInternal(flagName, fallbackValue, forceRealtime);
}

// ==================== OrThrow ====================

bool FeaturesClient::boolVariationOrThrow(const std::string &flagName,
                                          bool forceRealtime) {
  return boolVariationOrThrowInternal(flagName, forceRealtime);
}

std::string FeaturesClient::stringVariationOrThrow(const std::string &flagName,
                                                   bool forceRealtime) {
  return stringVariationOrThrowInternal(flagName, forceRealtime);
}

float FeaturesClient::floatVariationOrThrow(const std::string &flagName,
                                            bool forceRealtime) {
  return floatVariationOrThrowInternal(flagName, forceRealtime);
}

int FeaturesClient::intVariationOrThrow(const std::string &flagName,
                                        bool forceRealtime) {
  return intVariationOrThrowInternal(flagName, forceRealtime);
}

double FeaturesClient::doubleVariationOrThrow(const std::string &flagName,
                                              bool forceRealtime) {
  return doubleVariationOrThrowInternal(flagName, forceRealtime);
}

std::string FeaturesClient::jsonVariationOrThrow(const std::string &flagName,
                                                 bool forceRealtime) {
  return jsonVariationOrThrowInternal(flagName, forceRealtime);
}

// ==================== Explicit Sync Mode ====================

bool FeaturesClient::isExplicitSync() const { return _explicitSyncMode; }

bool FeaturesClient::canSyncFlags() const { return _pendingSync; }

bool FeaturesClient::hasPendingSyncFlags() const { return _pendingSync; }

void FeaturesClient::setExplicitSyncMode(bool enabled) {
  if (_explicitSyncMode == enabled)
    return;
  _explicitSyncMode = enabled;
  _synchronizedFlags = _realtimeFlags;
  _pendingSync = false;
}

void FeaturesClient::syncFlags(bool fetchNow) {
  if (!_explicitSyncMode)
    return;

  auto oldSynchronizedFlags = _synchronizedFlags;
  _synchronizedFlags = _realtimeFlags;
  invokeWatchCallbacks(_syncedWatchCallbacks, oldSynchronizedFlags,
                       _synchronizedFlags);
  _pendingSync = false;
  _stats.syncFlagsCount++;
  _emitter.emit(EVENTS::FLAGS_SYNC);
  _emitter.emit(EVENTS::FLAGS_CHANGE);

  if (fetchNow) {
    fetchFlags();
  }
}

// ==================== Watch Pattern ====================

std::function<void()>
FeaturesClient::watchRealtimeFlag(const std::string &flagName,
                                  WatchCallback callback,
                                  const std::string &name) {
  _watchCallbacks[flagName].push_back(callback);

  // Capture a copy of the callback for removal
  auto cbPtr = &_watchCallbacks[flagName].back();
  return [this, flagName, cbPtr]() {
    auto it = _watchCallbacks.find(flagName);
    if (it != _watchCallbacks.end()) {
      auto &cbs = it->second;
      for (auto cbIt = cbs.begin(); cbIt != cbs.end(); ++cbIt) {
        if (&(*cbIt) == cbPtr) {
          cbs.erase(cbIt);
          break;
        }
      }
    }
  };
}

std::function<void()>
FeaturesClient::watchRealtimeFlagWithInitialState(const std::string &flagName,
                                                  WatchCallback callback,
                                                  const std::string &name) {
  auto unwatchFn = watchRealtimeFlag(flagName, callback, name);

  // Fire immediately with current state — always use realtimeFlags for realtime
  // watchers
  callback(FlagProxy(this, flagName, true));

  return unwatchFn;
}

std::function<void()>
FeaturesClient::watchSyncedFlag(const std::string &flagName,
                                WatchCallback callback,
                                const std::string &name) {
  _syncedWatchCallbacks[flagName].push_back(callback);

  auto cbPtr = &_syncedWatchCallbacks[flagName].back();
  return [this, flagName, cbPtr]() {
    auto it = _syncedWatchCallbacks.find(flagName);
    if (it != _syncedWatchCallbacks.end()) {
      auto &cbs = it->second;
      for (auto cbIt = cbs.begin(); cbIt != cbs.end(); ++cbIt) {
        if (&(*cbIt) == cbPtr) {
          cbs.erase(cbIt);
          break;
        }
      }
    }
  };
}

std::function<void()>
FeaturesClient::watchSyncedFlagWithInitialState(const std::string &flagName,
                                                WatchCallback callback,
                                                const std::string &name) {
  auto unwatchFn = watchSyncedFlag(flagName, callback, name);

  // Fire immediately — respect explicitSyncMode for synced watchers
  callback(FlagProxy(this, flagName, false));

  return unwatchFn;
}

WatchFlagGroup *FeaturesClient::createWatchFlagGroup(const std::string &name) {
  auto *group = new WatchFlagGroup(*this, name);
  _watchGroups.push_back(group);
  _stats.activeWatchGroups.push_back(name);
  return group;
}

// ==================== Network ====================

void FeaturesClient::fetchFlags() {
  if (_config.enableDevMode) {
    CCLOG("[GatrixSDK][DEV] fetchFlags: starting fetch. etag=%s",
          _etag.c_str());
  }
  _emitter.emit(EVENTS::FLAGS_FETCH_START, {_etag});
  _stats.fetchFlagsCount++;

  auto request = new HttpRequest();
  request->setUrl((_config.apiUrl + "/evaluate-all").c_str());
  request->setRequestType(HttpRequest::Type::POST);

  // Headers
  std::vector<std::string> headers;
  headers.push_back("Content-Type: application/json");
  headers.push_back("X-API-Token: " + _config.apiToken);
  headers.push_back("X-Application-Name: " + _config.appName);
  headers.push_back("X-Environment: " + _config.environment);
  headers.push_back("X-Connection-Id: " + _connectionId);
  headers.push_back("X-SDK-Version: " + std::string(SDK_NAME) + "/" +
                    std::string(SDK_VERSION));
  if (!_etag.empty())
    headers.push_back("If-None-Match: " + _etag);
  for (const auto &[key, val] : _config.customHeaders) {
    headers.push_back(key + ": " + val);
  }
  request->setHeaders(headers);

  // Body - serialize context
  rapidjson::Document doc;
  doc.SetObject();
  auto &alloc = doc.GetAllocator();

  rapidjson::Value ctxObj(rapidjson::kObjectType);
  if (!_context.userId.empty())
    ctxObj.AddMember("userId", rapidjson::Value(_context.userId.c_str(), alloc),
                     alloc);
  if (!_context.sessionId.empty())
    ctxObj.AddMember("sessionId",
                     rapidjson::Value(_context.sessionId.c_str(), alloc),
                     alloc);

  for (const auto &[key, val] : _context.properties) {
    ctxObj.AddMember(rapidjson::Value(key.c_str(), alloc),
                     rapidjson::Value(val.c_str(), alloc), alloc);
  }
  doc.AddMember("context", ctxObj, alloc);

  rapidjson::StringBuffer buffer;
  rapidjson::Writer<rapidjson::StringBuffer> writer(buffer);
  doc.Accept(writer);
  request->setRequestData(buffer.GetString(), buffer.GetSize());

  // Response callback
  request->setResponseCallback([this](HttpClient *client,
                                      HttpResponse *response) {
    if (!response) {
      onFetchError(-1, "No response");
      // Network error: schedule with backoff
      _consecutiveFailures++;
      scheduleNextRefresh();
      return;
    }

    int statusCode = static_cast<int>(response->getResponseCode());
    if (response->isSucceed() && statusCode == 200) {
      auto *data = response->getResponseData();
      std::string body(data->begin(), data->end());

      // Extract etag from response headers
      std::string newEtag;
      auto *responseHeaders = response->getResponseHeader();
      if (responseHeaders) {
        std::string headerStr(responseHeaders->begin(), responseHeaders->end());
        auto pos = headerStr.find("etag:");
        if (pos == std::string::npos)
          pos = headerStr.find("ETag:");
        if (pos != std::string::npos) {
          auto start = headerStr.find_first_not_of(" ", pos + 5);
          auto end = headerStr.find("\r\n", start);
          if (start != std::string::npos) {
            newEtag = headerStr.substr(start, end - start);
          }
        }
      }
      onFetchResponse(statusCode, body, newEtag);

      // Success: reset failure counter and schedule at normal interval
      _consecutiveFailures = 0;
      scheduleNextRefresh();
    } else if (statusCode == 304) {
      _stats.notModifiedCount++;
      _emitter.emit(EVENTS::FLAGS_FETCH_END);

      // 304 Not Modified: reset failure counter and schedule at normal interval
      _consecutiveFailures = 0;
      scheduleNextRefresh();
    } else {
      // Check for non-retryable status codes
      const auto &nonRetryable =
          _config.fetchRetryOptions.nonRetryableStatusCodes;
      bool isNonRetryable = std::find(nonRetryable.begin(), nonRetryable.end(),
                                      statusCode) != nonRetryable.end();

      auto *data = response->getResponseData();
      std::string errBody =
          data ? std::string(data->begin(), data->end()) : "unknown error";
      onFetchError(statusCode, errBody);

      if (isNonRetryable) {
        // Non-retryable error: stop polling entirely
        _pollingStopped = true;
      } else {
        // Retryable error: schedule with backoff
        _consecutiveFailures++;
        scheduleNextRefresh();
      }
    }
  });

  HttpClient::getInstance()->send(request);
  request->release();
}

void FeaturesClient::onFetchResponse(int statusCode, const std::string &body,
                                     const std::string &newEtag) {
  rapidjson::Document doc;
  doc.Parse(body.c_str());

  if (doc.HasParseError()) {
    onFetchError(statusCode, "JSON parse error");
    return;
  }

  // Navigate to data.flags
  const rapidjson::Value *flagsArray = nullptr;
  if (doc.HasMember("data") && doc["data"].HasMember("flags") &&
      doc["data"]["flags"].IsArray()) {
    flagsArray = &doc["data"]["flags"];
  } else if (doc.HasMember("flags") && doc["flags"].IsArray()) {
    flagsArray = &doc["flags"];
  }

  if (!flagsArray) {
    onFetchError(statusCode, "No flags array in response");
    return;
  }

  if (!newEtag.empty())
    _etag = newEtag;
  _stats.etag = _etag;

  bool changed = false;
  std::map<std::string, EvaluatedFlag> newFlags;

  for (rapidjson::SizeType i = 0; i < flagsArray->Size(); i++) {
    const auto &fj = (*flagsArray)[i];
    EvaluatedFlag flag;
    flag.name = fj["name"].GetString();
    flag.enabled = fj["enabled"].GetBool();
    flag.version = fj.HasMember("version") ? fj["version"].GetInt() : 0;
    flag.impressionData =
        fj.HasMember("impressionData") ? fj["impressionData"].GetBool() : false;
    if (fj.HasMember("reason") && fj["reason"].IsString())
      flag.reason = fj["reason"].GetString();

    if (fj.HasMember("variant") && fj["variant"].IsObject()) {
      const auto &vj = fj["variant"];
      flag.variant.name = vj["name"].GetString();
      flag.variant.enabled = vj["enabled"].GetBool();
      if (vj.HasMember("value")) {
        if (vj["value"].IsString()) {
          flag.variant.value = vj["value"].GetString();
        } else if (vj["value"].IsNumber()) {
          flag.variant.value = std::to_string(vj["value"].GetDouble());
        } else if (vj["value"].IsObject() || vj["value"].IsArray()) {
          rapidjson::StringBuffer sb;
          rapidjson::Writer<rapidjson::StringBuffer> w(sb);
          vj["value"].Accept(w);
          flag.variant.value = sb.GetString();
        }
      }
    }

    if (fj.HasMember("valueType") && fj["valueType"].IsString()) {
      std::string vt = fj["valueType"].GetString();
      if (vt == "string")
        flag.valueType = ValueType::STRING;
      else if (vt == "number")
        flag.valueType = ValueType::NUMBER;
      else if (vt == "json")
        flag.valueType = ValueType::JSON;
    }

    newFlags[flag.name] = flag;

    // Per-flag change detection
    auto oldIt = _realtimeFlags.find(flag.name);
    if (oldIt == _realtimeFlags.end() ||
        oldIt->second.version != flag.version) {
      changed = true;
      std::string changeType =
          (oldIt == _realtimeFlags.end()) ? "created" : "updated";
      _stats.flagLastChangedTimes[flag.name] = "now"; // simplified
      _emitter.emit(EVENTS::flagChange(flag.name));
    }
  }

  // Detect removed flags - emit bulk event
  std::vector<std::string> removedNames;
  for (const auto &pair : _realtimeFlags) {
    if (newFlags.find(pair.first) == newFlags.end()) {
      removedNames.push_back(pair.first);
      changed = true;
    }
  }
  if (!removedNames.empty()) {
    _emitter.emit(EVENTS::FLAGS_REMOVED);
  }

  if (changed || _realtimeFlags.size() != newFlags.size()) {
    auto oldRealtimeFlags = _realtimeFlags;
    _realtimeFlags = newFlags;
    _stats.updateCount++;
    _stats.lastUpdateTime = "now"; // simplified
    _stats.totalFlagCount = static_cast<int>(_realtimeFlags.size());

    // Always invoke realtime watch callbacks
    invokeWatchCallbacks(_watchCallbacks, oldRealtimeFlags, _realtimeFlags);

    if (!_explicitSyncMode) {
      _synchronizedFlags = _realtimeFlags;
      _pendingSync = false;
      // In non-explicit mode, also invoke synced callbacks
      invokeWatchCallbacks(_syncedWatchCallbacks, oldRealtimeFlags,
                           _realtimeFlags);
      _emitter.emit(EVENTS::FLAGS_CHANGE);
    } else {
      if (!_pendingSync) {
        _pendingSync = true;
        _emitter.emit(EVENTS::FLAGS_PENDING_SYNC);
      }
    }
    saveToStorage();
  }

  _stats.lastFetchTime = "now"; // simplified
  _emitter.emit(EVENTS::FLAGS_FETCH_SUCCESS);
  _emitter.emit(EVENTS::FLAGS_FETCH_END);

  // Error recovery
  if (_sdkState == SdkState::ERROR) {
    _sdkState = SdkState::READY;
    _stats.recoveryCount++;
    _emitter.emit(EVENTS::FLAGS_RECOVERED);
  }

  if (!_readyEventEmitted) {
    _readyEventEmitted = true;
    _sdkState = SdkState::READY;
    _emitter.emit(EVENTS::FLAGS_READY);
  }
}

void FeaturesClient::onFetchError(int statusCode, const std::string &error) {
  _stats.errorCount++;
  _stats.lastErrorTime = "now"; // simplified
  _stats.lastError = error;
  _sdkState = SdkState::ERROR;

  _emitter.emit(EVENTS::FLAGS_FETCH_ERROR, {std::to_string(statusCode), error});
  _emitter.emit(EVENTS::SDK_ERROR, {"fetch", error});
  _emitter.emit(EVENTS::FLAGS_FETCH_END);
}

// ==================== Internal ====================

void FeaturesClient::trackAccess(const std::string &flagName, bool enabled,
                                 const std::string &variantName,
                                 const std::string &eventType) {
  if (_config.disableStats)
    return;
  if (enabled) {
    _stats.flagEnabledCounts[flagName].yes++;
  } else {
    _stats.flagEnabledCounts[flagName].no++;
  }
  if (!variantName.empty()) {
    _stats.flagVariantCounts[flagName][variantName]++;
  }
}

void FeaturesClient::trackImpression(const EvaluatedFlag &flag,
                                     const std::string &eventType) {
  if (_config.disableMetrics)
    return;
  _stats.impressionCount++;
  _emitter.emit(EVENTS::FLAGS_IMPRESSION,
                {flag.name, flag.enabled ? "true" : "false", flag.variant.name,
                 eventType});
}

void FeaturesClient::initFromBootstrap() {
  for (const auto &flag : _config.bootstrap) {
    _realtimeFlags[flag.name] = flag;
  }
  _synchronizedFlags = _realtimeFlags;
  _stats.totalFlagCount = static_cast<int>(_realtimeFlags.size());
  _emitter.emit(EVENTS::FLAGS_INIT);
}

void FeaturesClient::initFromStorage() {
  std::string stored = _storage->get("gatrix_flags");
  if (stored.empty())
    return;

  // Parse stored JSON flags
  rapidjson::Document doc;
  doc.Parse(stored.c_str());
  if (doc.HasParseError() || !doc.IsObject())
    return;

  for (auto it = doc.MemberBegin(); it != doc.MemberEnd(); ++it) {
    EvaluatedFlag flag;
    flag.name = it->name.GetString();
    const auto &fj = it->value;
    flag.enabled = fj.HasMember("enabled") ? fj["enabled"].GetBool() : false;
    flag.version = fj.HasMember("version") ? fj["version"].GetInt() : 0;
    if (fj.HasMember("variant") && fj["variant"].IsObject()) {
      const auto &vj = fj["variant"];
      flag.variant.name = vj.HasMember("name") ? vj["name"].GetString() : "";
      flag.variant.enabled =
          vj.HasMember("enabled") ? vj["enabled"].GetBool() : false;
    }
    _realtimeFlags[flag.name] = flag;
  }

  if (!_config.bootstrapOverride || _config.bootstrap.empty()) {
    _synchronizedFlags = _realtimeFlags;
  }

  _stats.totalFlagCount = static_cast<int>(_realtimeFlags.size());
  _emitter.emit(EVENTS::FLAGS_INIT);
}

void FeaturesClient::saveToStorage() {
  rapidjson::Document doc;
  doc.SetObject();
  auto &alloc = doc.GetAllocator();

  for (const auto &[name, flag] : _realtimeFlags) {
    rapidjson::Value flagObj(rapidjson::kObjectType);
    flagObj.AddMember("enabled", flag.enabled, alloc);
    flagObj.AddMember("version", flag.version, alloc);

    rapidjson::Value varObj(rapidjson::kObjectType);
    varObj.AddMember("name", rapidjson::Value(flag.variant.name.c_str(), alloc),
                     alloc);
    varObj.AddMember("enabled", flag.variant.enabled, alloc);
    if (!flag.variant.value.empty()) {
      varObj.AddMember(
          "value", rapidjson::Value(flag.variant.value.c_str(), alloc), alloc);
    }
    flagObj.AddMember("variant", varObj, alloc);

    doc.AddMember(rapidjson::Value(name.c_str(), alloc), flagObj, alloc);
  }

  rapidjson::StringBuffer sb;
  rapidjson::Writer<rapidjson::StringBuffer> writer(sb);
  doc.Accept(writer);

  _storage->save("gatrix_flags", sb.GetString());
  if (!_etag.empty())
    _storage->save("gatrix_etag", _etag);
}

void FeaturesClient::scheduleNextRefresh() {
  if (!_started || _config.disableRefresh || _pollingStopped) {
    return;
  }

  // Cancel existing timer
  unschedulePolling();

  float delay = static_cast<float>(_config.refreshInterval);

  // Apply exponential backoff on consecutive failures
  if (_consecutiveFailures > 0) {
    int initialBackoff = _config.fetchRetryOptions.initialBackoffMs;
    int maxBackoff = _config.fetchRetryOptions.maxBackoffMs;
    int backoffMs =
        std::min(static_cast<int>(initialBackoff *
                                  std::pow(2, _consecutiveFailures - 1)),
                 maxBackoff);
    delay = static_cast<float>(backoffMs) / 1000.0f;
  }

  if (_config.enableDevMode) {
    CCLOG("[GatrixSDK][DEV] scheduleNextRefresh: delay=%.1fs, "
          "consecutiveFailures=%d, pollingStopped=%s",
          delay, _consecutiveFailures, _pollingStopped ? "True" : "False");
  }

  Director::getInstance()->getScheduler()->schedule(
      [this](float) { this->fetchFlags(); }, this, delay, 0, 0, false,
      "GatrixPolling");
}

void FeaturesClient::unschedulePolling() {
  if (Director::getInstance()) {
    Director::getInstance()->getScheduler()->unschedule("GatrixPolling", this);
  }
}

GatrixSdkStats FeaturesClient::getStats() const {
  auto stats = _stats;
  stats.totalFlagCount = static_cast<int>(selectFlags().size());
  stats.sdkState = _sdkState;
  stats.etag = _etag;
  stats.offlineMode = _config.offlineMode;
  stats.missingFlags = stats.missingFlags;
  stats.flagEnabledCounts = stats.flagEnabledCounts;
  stats.flagVariantCounts = stats.flagVariantCounts;
  stats.flagLastChangedTimes = stats.flagLastChangedTimes;

  // Active watch groups
  std::vector<std::string> groups;
  for (const auto &wg : _watchGroups) {
    if (wg->size() > 0)
      groups.push_back(wg->getName());
  }
  stats.activeWatchGroups = groups;
  stats.eventHandlerStats = _emitter.getHandlerStats();
  return stats;
}

// ==================== WatchFlagGroup ====================

WatchFlagGroup::WatchFlagGroup(FeaturesClient &client, const std::string &name)
    : _client(client), _name(name) {}

WatchFlagGroup::~WatchFlagGroup() { unwatchAll(); }

WatchFlagGroup &
WatchFlagGroup::watchRealtimeFlag(const std::string &flagName,
                                  FeaturesClient::WatchCallback callback) {
  auto unwatcher =
      _client.watchRealtimeFlag(flagName, callback, _name + "_" + flagName);
  _unwatchers.push_back(unwatcher);
  return *this;
}

WatchFlagGroup &WatchFlagGroup::watchRealtimeFlagWithInitialState(
    const std::string &flagName, FeaturesClient::WatchCallback callback) {
  auto unwatcher = _client.watchRealtimeFlagWithInitialState(
      flagName, callback, _name + "_" + flagName);
  _unwatchers.push_back(unwatcher);
  return *this;
}

WatchFlagGroup &
WatchFlagGroup::watchSyncedFlag(const std::string &flagName,
                                FeaturesClient::WatchCallback callback) {
  auto unwatcher =
      _client.watchSyncedFlag(flagName, callback, _name + "_" + flagName);
  _unwatchers.push_back(unwatcher);
  return *this;
}

WatchFlagGroup &WatchFlagGroup::watchSyncedFlagWithInitialState(
    const std::string &flagName, FeaturesClient::WatchCallback callback) {
  auto unwatcher = _client.watchSyncedFlagWithInitialState(
      flagName, callback, _name + "_" + flagName);
  _unwatchers.push_back(unwatcher);
  return *this;
}

void WatchFlagGroup::unwatchAll() {
  for (auto &unwatcher : _unwatchers) {
    unwatcher();
  }
  _unwatchers.clear();
}

void WatchFlagGroup::destroy() { unwatchAll(); }

// ==================== Metadata Access Internal Methods ====================

bool FeaturesClient::hasFlagInternal(const std::string &flagName,
                                     bool forceRealtime) const {
  const auto &flags = selectFlags(forceRealtime);
  return flags.find(flagName) != flags.end();
}

ValueType FeaturesClient::getValueTypeInternal(const std::string &flagName,
                                               bool forceRealtime) const {
  const auto &flags = selectFlags(forceRealtime);
  auto it = flags.find(flagName);
  if (it == flags.end())
    return ValueType::NONE;
  return it->second.valueType;
}

int FeaturesClient::getVersionInternal(const std::string &flagName,
                                       bool forceRealtime) const {
  const auto &flags = selectFlags(forceRealtime);
  auto it = flags.find(flagName);
  if (it == flags.end())
    return 0;
  return it->second.version;
}

std::string FeaturesClient::getReasonInternal(const std::string &flagName,
                                              bool forceRealtime) const {
  const auto &flags = selectFlags(forceRealtime);
  auto it = flags.find(flagName);
  if (it == flags.end())
    return "";
  return it->second.reason;
}

bool FeaturesClient::getImpressionDataInternal(const std::string &flagName,
                                               bool forceRealtime) const {
  const auto &flags = selectFlags(forceRealtime);
  auto it = flags.find(flagName);
  if (it == flags.end())
    return false;
  return it->second.impressionData;
}

const EvaluatedFlag *
FeaturesClient::getRawFlagInternal(const std::string &flagName,
                                   bool forceRealtime) const {
  const auto &flags = selectFlags(forceRealtime);
  auto it = flags.find(flagName);
  if (it == flags.end())
    return nullptr;
  return &it->second;
}

// ==================== InvokeWatchCallbacks ====================

void FeaturesClient::invokeWatchCallbacks(
    std::map<std::string, std::vector<WatchCallback>> &callbackMap,
    const std::map<std::string, EvaluatedFlag> &oldFlags,
    const std::map<std::string, EvaluatedFlag> &newFlags) {
  // Check for changed/new flags
  for (const auto &[name, newFlag] : newFlags) {
    auto oldIt = oldFlags.find(name);
    if (oldIt == oldFlags.end() || oldIt->second.version != newFlag.version) {
      _stats.flagLastChangedTimes[name] = "now";

      auto cbIt = callbackMap.find(name);
      if (cbIt != callbackMap.end() && !cbIt->second.empty()) {
        FlagProxy proxy(this, name, true);
        // Copy to avoid mutation during iteration
        auto callbacks = cbIt->second;
        for (const auto &cb : callbacks) {
          try {
            cb(proxy);
          } catch (const std::exception &e) {
            CCLOG("[GatrixSDK] Error in watch callback for %s: %s",
                  name.c_str(), e.what());
          }
        }
      }
    }
  }

  // Check for removed flags
  for (const auto &[name, oldFlag] : oldFlags) {
    if (newFlags.find(name) == newFlags.end()) {
      auto cbIt = callbackMap.find(name);
      if (cbIt != callbackMap.end() && !cbIt->second.empty()) {
        FlagProxy proxy(this, name, true);
        auto callbacks = cbIt->second;
        for (const auto &cb : callbacks) {
          try {
            cb(proxy);
          } catch (const std::exception &e) {
            CCLOG("[GatrixSDK] Error in watch callback for removed flag "
                  "%s: %s",
                  name.c_str(), e.what());
          }
        }
      }
    }
  }
}

} // namespace gatrix
