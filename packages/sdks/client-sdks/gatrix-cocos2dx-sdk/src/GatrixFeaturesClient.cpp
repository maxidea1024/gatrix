#include "GatrixFeaturesClient.h"
#include "cocos2d.h"
#include "network/HttpClient.h"
#include "json/document.h"
#include "json/stringbuffer.h"
#include "json/writer.h"
#include <algorithm>
#include <sstream>


using namespace cocos2d;
using namespace cocos2d::network;

namespace gatrix {

// ==================== FeaturesClient ====================

FeaturesClient::FeaturesClient(const GatrixClientConfig &config,
                               GatrixEventEmitter &emitter)
    : _config(config), _emitter(emitter), _context(config.context) {
  // Set system context
  _context.properties["appName"] = _config.appName;
  _context.properties["environment"] = _config.environment;

  // Storage
  _storage = &_defaultStorage;
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
  _stats.startTime = GatrixEventEmitter::nowISO(); // Would need to make this
                                                   // public or use a utility

  // 1. Init from bootstrap if available
  if (!_config.bootstrap.empty()) {
    initFromBootstrap();
  }

  // 2. Init from storage
  initFromStorage();

  // 3. Fetch from server (unless offline mode)
  if (!_config.offlineMode) {
    fetchFlags();
    if (!_config.disableRefresh) {
      schedulePolling();
    }
  }
}

void FeaturesClient::stop() {
  unschedulePolling();
  _started = false;
  _sdkState = SdkState::STOPPED;
}

// ==================== Context ====================

GatrixContext FeaturesClient::getContext() const { return _context; }

void FeaturesClient::updateContext(const GatrixContext &context) {
  _context.userId = context.userId;
  _context.sessionId = context.sessionId;
  _context.deviceId = context.deviceId;
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
FeaturesClient::activeFlags() const {
  return _config.explicitSyncMode ? _synchronizedFlags : _realtimeFlags;
}

bool FeaturesClient::isEnabled(const std::string &flagName) {
  auto it = activeFlags().find(flagName);
  if (it == activeFlags().end()) {
    _stats.missingFlags[flagName]++;
    return false;
  }
  trackAccess(flagName, it->second.enabled, it->second.variant.name);
  if (it->second.impressionData || _config.impressionDataAll)
    trackImpression(it->second);
  return it->second.enabled;
}

Variant FeaturesClient::getVariant(const std::string &flagName) {
  auto it = activeFlags().find(flagName);
  if (it == activeFlags().end()) {
    _stats.missingFlags[flagName]++;
    return Variant::fallbackDisabled();
  }
  trackAccess(flagName, it->second.enabled, it->second.variant.name);
  return it->second.variant;
}

std::vector<EvaluatedFlag> FeaturesClient::getAllFlags() const {
  std::vector<EvaluatedFlag> result;
  for (const auto &[name, flag] : activeFlags()) {
    result.push_back(flag);
  }
  return result;
}

FlagProxy FeaturesClient::getFlag(const std::string &flagName) {
  auto it = activeFlags().find(flagName);
  if (it == activeFlags().end()) {
    _stats.missingFlags[flagName]++;
    return FlagProxy(nullptr);
  }
  trackAccess(flagName, it->second.enabled, it->second.variant.name);
  if (it->second.impressionData || _config.impressionDataAll)
    trackImpression(it->second);
  return FlagProxy(&it->second);
}

// ==================== Variations ====================

std::string FeaturesClient::variation(const std::string &flagName,
                                      const std::string &defaultValue) {
  return getFlag(flagName).variation(defaultValue);
}

bool FeaturesClient::boolVariation(const std::string &flagName,
                                   bool defaultValue) {
  return getFlag(flagName).boolVariation(defaultValue);
}

std::string FeaturesClient::stringVariation(const std::string &flagName,
                                            const std::string &defaultValue) {
  return getFlag(flagName).stringVariation(defaultValue);
}

double FeaturesClient::numberVariation(const std::string &flagName,
                                       double defaultValue) {
  return getFlag(flagName).numberVariation(defaultValue);
}

std::string FeaturesClient::jsonVariation(const std::string &flagName,
                                          const std::string &defaultValue) {
  return getFlag(flagName).jsonVariation(defaultValue);
}

// ==================== Variation Details ====================

VariationResult<bool>
FeaturesClient::boolVariationDetails(const std::string &flagName,
                                     bool defaultValue) {
  return getFlag(flagName).boolVariationDetails(defaultValue);
}

VariationResult<std::string>
FeaturesClient::stringVariationDetails(const std::string &flagName,
                                       const std::string &defaultValue) {
  return getFlag(flagName).stringVariationDetails(defaultValue);
}

VariationResult<double>
FeaturesClient::numberVariationDetails(const std::string &flagName,
                                       double defaultValue) {
  return getFlag(flagName).numberVariationDetails(defaultValue);
}

// ==================== OrThrow ====================

bool FeaturesClient::boolVariationOrThrow(const std::string &flagName) {
  return getFlag(flagName).boolVariationOrThrow();
}

std::string
FeaturesClient::stringVariationOrThrow(const std::string &flagName) {
  return getFlag(flagName).stringVariationOrThrow();
}

double FeaturesClient::numberVariationOrThrow(const std::string &flagName) {
  return getFlag(flagName).numberVariationOrThrow();
}

std::string FeaturesClient::jsonVariationOrThrow(const std::string &flagName) {
  return getFlag(flagName).jsonVariationOrThrow();
}

// ==================== Explicit Sync Mode ====================

bool FeaturesClient::isExplicitSync() const { return _config.explicitSyncMode; }

bool FeaturesClient::canSyncFlags() const {
  return _config.explicitSyncMode && _hasPendingChanges;
}

void FeaturesClient::syncFlags(bool fetchNow) {
  if (!_config.explicitSyncMode)
    return;

  _synchronizedFlags = _realtimeFlags;
  _hasPendingChanges = false;
  _stats.syncFlagsCount++;
  _emitter.emit(EVENTS::FLAGS_SYNC);
  _emitter.emit(EVENTS::FLAGS_CHANGE);

  if (fetchNow) {
    fetchFlags();
  }
}

// ==================== Watch Pattern ====================

std::function<void()> FeaturesClient::watchFlag(const std::string &flagName,
                                                WatchCallback callback,
                                                const std::string &name) {
  std::string eventName = EVENTS::flagChange(flagName);
  auto wrappedCb = [this, flagName,
                    callback](const std::vector<std::string> &) {
    callback(getFlag(flagName));
  };
  _emitter.on(eventName, wrappedCb, name.empty() ? "watch_" + flagName : name);

  return [this, eventName]() { _emitter.off(eventName); };
}

std::function<void()>
FeaturesClient::watchFlagWithInitialState(const std::string &flagName,
                                          WatchCallback callback,
                                          const std::string &name) {
  // Fire immediately with current state
  callback(getFlag(flagName));
  // Then watch for changes
  return watchFlag(flagName, callback, name);
}

WatchFlagGroup *FeaturesClient::createWatchFlagGroup(const std::string &name) {
  auto *group = new WatchFlagGroup(*this, name);
  _watchGroups.push_back(group);
  _stats.activeWatchGroups.push_back(name);
  return group;
}

// ==================== Network ====================

void FeaturesClient::fetchFlags() {
  _emitter.emit(EVENTS::FLAGS_FETCH_START, {_etag});
  _stats.fetchFlagsCount++;

  auto request = new HttpRequest();
  request->setUrl((_config.apiUrl + "/evaluate-all").c_str());
  request->setRequestType(HttpRequest::Type::POST);

  // Headers
  std::vector<std::string> headers;
  headers.push_back("Content-Type: application/json");
  headers.push_back("Authorization: Bearer " + _config.apiToken);
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
  if (!_context.deviceId.empty())
    ctxObj.AddMember("deviceId",
                     rapidjson::Value(_context.deviceId.c_str(), alloc), alloc);

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
    } else if (statusCode == 304) {
      _stats.notModifiedCount++;
      _emitter.emit(EVENTS::FLAGS_FETCH_END);
    } else {
      auto *data = response->getResponseData();
      std::string errBody =
          data ? std::string(data->begin(), data->end()) : "unknown error";
      onFetchError(statusCode, errBody);
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
      if (vj.HasMember("payload")) {
        if (vj["payload"].IsString()) {
          flag.variant.payload = vj["payload"].GetString();
        } else if (vj["payload"].IsNumber()) {
          flag.variant.payload = std::to_string(vj["payload"].GetDouble());
        } else if (vj["payload"].IsObject() || vj["payload"].IsArray()) {
          rapidjson::StringBuffer sb;
          rapidjson::Writer<rapidjson::StringBuffer> w(sb);
          vj["payload"].Accept(w);
          flag.variant.payload = sb.GetString();
        }
      }
    }

    if (fj.HasMember("variantType") && fj["variantType"].IsString()) {
      std::string vt = fj["variantType"].GetString();
      if (vt == "string")
        flag.variantType = VariantType::STRING;
      else if (vt == "number")
        flag.variantType = VariantType::NUMBER;
      else if (vt == "json")
        flag.variantType = VariantType::JSON;
    }

    newFlags[flag.name] = flag;

    // Per-flag change detection
    auto oldIt = _realtimeFlags.find(flag.name);
    if (oldIt == _realtimeFlags.end() ||
        oldIt->second.version != flag.version) {
      changed = true;
      _stats.flagLastChangedTimes[flag.name] = "now"; // simplified
      _emitter.emit(EVENTS::flagChange(flag.name));
    }
  }

  if (changed || _realtimeFlags.size() != newFlags.size()) {
    _realtimeFlags = newFlags;
    _stats.updateCount++;
    _stats.lastUpdateTime = "now"; // simplified
    _stats.totalFlagCount = static_cast<int>(_realtimeFlags.size());

    if (!_config.explicitSyncMode) {
      _synchronizedFlags = _realtimeFlags;
      _emitter.emit(EVENTS::FLAGS_CHANGE);
    } else {
      _hasPendingChanges = true;
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
                                 const std::string &variantName) {
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

void FeaturesClient::trackImpression(const EvaluatedFlag &flag) {
  if (_config.disableMetrics)
    return;
  _stats.impressionCount++;
  _emitter.emit(
      EVENTS::FLAGS_IMPRESSION,
      {flag.name, flag.enabled ? "true" : "false", flag.variant.name});
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
    if (!flag.variant.payload.empty()) {
      varObj.AddMember("payload",
                       rapidjson::Value(flag.variant.payload.c_str(), alloc),
                       alloc);
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

void FeaturesClient::schedulePolling() {
  Director::getInstance()->getScheduler()->schedule(
      [this](float) { this->fetchFlags(); }, this,
      static_cast<float>(_config.refreshInterval), CC_REPEAT_FOREVER, 0, false,
      "GatrixPolling");
}

void FeaturesClient::unschedulePolling() {
  if (Director::getInstance()) {
    Director::getInstance()->getScheduler()->unschedule("GatrixPolling", this);
  }
}

GatrixSdkStats FeaturesClient::getStats() const {
  auto stats = _stats;
  stats.sdkState = _sdkState;
  stats.offlineMode = _config.offlineMode;
  stats.eventHandlerStats = _emitter.getHandlerStats();
  return stats;
}

// ==================== WatchFlagGroup ====================

WatchFlagGroup::WatchFlagGroup(FeaturesClient &client, const std::string &name)
    : _client(client), _name(name) {}

WatchFlagGroup::~WatchFlagGroup() { unwatchAll(); }

WatchFlagGroup &
WatchFlagGroup::watchFlag(const std::string &flagName,
                          FeaturesClient::WatchCallback callback) {
  auto unwatcher =
      _client.watchFlag(flagName, callback, _name + "_" + flagName);
  _unwatchers.push_back(unwatcher);
  return *this;
}

WatchFlagGroup &WatchFlagGroup::watchFlagWithInitialState(
    const std::string &flagName, FeaturesClient::WatchCallback callback) {
  auto unwatcher = _client.watchFlagWithInitialState(flagName, callback,
                                                     _name + "_" + flagName);
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

} // namespace gatrix
