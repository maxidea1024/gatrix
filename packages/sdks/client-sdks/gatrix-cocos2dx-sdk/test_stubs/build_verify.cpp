// Build verification test - tests that all SDK headers are properly structured
// and all APIs are accessible
#include "GatrixClient.h"
#include "GatrixEventEmitter.h"
#include "GatrixEvents.h"
#include "GatrixFeaturesClient.h"
#include "GatrixFlagProxy.h"
#include "GatrixTypes.h"


#include <cassert>
#include <iostream>


int main() {
  using namespace gatrix;

  // 1. Config
  GatrixClientConfig config;
  config.apiUrl = "https://edge.test.com/api/v1";
  config.apiToken = "test-token";
  config.appName = "test-app";
  config.environment = "production";
  config.refreshInterval = 30;
  config.disableRefresh = false;
  config.explicitSyncMode = false;
  config.offlineMode = true;
  config.disableMetrics = false;
  config.disableStats = false;
  config.impressionDataAll = false;
  config.customHeaders["X-Custom"] = "value";

  // 2. Bootstrap
  EvaluatedFlag bootstrapFlag;
  bootstrapFlag.name = "test-flag";
  bootstrapFlag.enabled = true;
  bootstrapFlag.variant.name = "variant-a";
  bootstrapFlag.variant.enabled = true;
  bootstrapFlag.variant.payload = "hello";
  bootstrapFlag.variantType = VariantType::STRING;
  bootstrapFlag.version = 1;
  bootstrapFlag.impressionData = true;
  bootstrapFlag.reason = "targeting_match";
  config.bootstrap.push_back(bootstrapFlag);

  // 3. GatrixClient singleton
  auto *client = GatrixClient::getInstance();
  client->init(config);

  // 4. Version
  std::string version = GatrixClient::version();

  // 5. Event subscription (on, once, onAny, offAny, off)
  client->on(
      EVENTS::FLAGS_READY,
      [](const std::vector<std::string> &) {
        std::cout << "Ready!" << std::endl;
      },
      "ready_listener");

  client->once(
      EVENTS::FLAGS_CHANGE,
      [](const std::vector<std::string> &) {
        std::cout << "Changed!" << std::endl;
      },
      "change_once");

  client->onAny(
      [](const std::string &event, const std::vector<std::string> &) {
        std::cout << "Event: " << event << std::endl;
      },
      "debug_any");

  client->offAny();
  client->off(EVENTS::FLAGS_READY);

  // 6. Start (offline mode, so no real network)
  client->start();

  // 7. FeaturesClient access
  auto *features = client->features();

  // 8. Context
  GatrixContext ctx;
  ctx.userId = "user-1";
  ctx.sessionId = "session-1";
  ctx.deviceId = "device-1";
  ctx.properties["plan"] = "premium";
  features->updateContext(ctx);
  GatrixContext current = features->getContext();

  // 9. Basic flag access
  bool enabled = features->isEnabled("test-flag");
  Variant variant = features->getVariant("test-flag");
  std::vector<EvaluatedFlag> allFlags = features->getAllFlags();

  // 10. Typed variations (default required)
  std::string varName = features->variation("test-flag", "disabled");
  bool boolVal = features->boolVariation("test-flag", false);
  std::string strVal = features->stringVariation("test-flag", "default");
  double numVal = features->numberVariation("test-flag", 0.0);
  std::string jsonVal = features->jsonVariation("test-flag", "{}");

  // 11. Variation details
  auto boolDetails = features->boolVariationDetails("test-flag", false);
  auto strDetails = features->stringVariationDetails("test-flag", "default");
  auto numDetails = features->numberVariationDetails("test-flag", 0.0);

  // Check VariationResult fields
  bool detailValue = boolDetails.value;
  std::string detailReason = boolDetails.reason;
  bool detailExists = boolDetails.flagExists;
  bool detailEnabled = boolDetails.enabled;

  // 12. OrThrow
  try {
    bool strict = features->boolVariationOrThrow("test-flag");
    std::string strictStr = features->stringVariationOrThrow("test-flag");
    double strictNum = features->numberVariationOrThrow("test-flag");
    std::string strictJson = features->jsonVariationOrThrow("test-flag");
    (void)strict;
    (void)strictNum;
  } catch (const GatrixFeatureError &e) {
    std::cout << "Error: " << e.what() << " code: " << e.code() << std::endl;
  }

  // 13. FlagProxy
  FlagProxy proxy = features->getFlag("test-flag");
  bool proxyExists = proxy.exists();
  bool proxyEnabled = proxy.enabled();
  std::string proxyName = proxy.name();
  Variant proxyVariant = proxy.variant();
  VariantType proxyVarType = proxy.variantType();
  int proxyVersion = proxy.version();
  std::string proxyReason = proxy.reason();
  bool proxyImpression = proxy.impressionData();
  const EvaluatedFlag *proxyRaw = proxy.raw();

  // FlagProxy variations
  std::string proxyVar = proxy.variation("disabled");
  bool proxyBool = proxy.boolVariation(false);
  std::string proxyStr = proxy.stringVariation("default");
  double proxyNum = proxy.numberVariation(0.0);
  std::string proxyJson = proxy.jsonVariation("{}");

  // FlagProxy variation details
  auto proxyBoolDetails = proxy.boolVariationDetails(false);
  auto proxyStrDetails = proxy.stringVariationDetails("default");
  auto proxyNumDetails = proxy.numberVariationDetails(0.0);

  // FlagProxy OrThrow
  try {
    bool pBool = proxy.boolVariationOrThrow();
    (void)pBool;
  } catch (const GatrixFeatureError &) {
  }

  // 14. Explicit sync mode
  bool isSyncMode = features->isExplicitSync();
  bool canSync = features->canSyncFlags();
  features->syncFlags(false);

  // 15. Watch pattern
  auto unwatch = features->watchFlag(
      "test-flag",
      [](FlagProxy flag) {
        std::cout << "Flag changed: " << flag.enabled() << std::endl;
      },
      "watch_test");
  unwatch(); // unsubscribe

  auto unwatchInit = features->watchFlagWithInitialState(
      "test-flag",
      [](FlagProxy flag) {
        std::cout << "Flag state: " << flag.enabled() << std::endl;
      },
      "watch_init");
  unwatchInit();

  // 16. WatchFlagGroup
  auto *group = features->createWatchFlagGroup("my-group");
  group->watchFlag("test-flag", [](FlagProxy f) {})
      .watchFlagWithInitialState("test-flag", [](FlagProxy f) {});
  int groupSize = group->size();
  std::string groupName = group->getName();
  group->unwatchAll();
  group->destroy();

  // 17. Stats
  GatrixSdkStats stats = features->getStats();
  int totalFlags = stats.totalFlagCount;
  int fetchCount = stats.fetchFlagsCount;
  SdkState state = stats.sdkState;
  std::string etag = stats.etag;
  bool offline = stats.offlineMode;

  // 18. Events constants check
  const char *ev1 = EVENTS::FLAGS_INIT;
  const char *ev2 = EVENTS::FLAGS_READY;
  const char *ev3 = EVENTS::FLAGS_FETCH;
  const char *ev4 = EVENTS::FLAGS_FETCH_START;
  const char *ev5 = EVENTS::FLAGS_FETCH_SUCCESS;
  const char *ev6 = EVENTS::FLAGS_FETCH_ERROR;
  const char *ev7 = EVENTS::FLAGS_FETCH_END;
  const char *ev8 = EVENTS::FLAGS_CHANGE;
  const char *ev9 = EVENTS::SDK_ERROR;
  const char *ev10 = EVENTS::FLAGS_RECOVERED;
  const char *ev11 = EVENTS::FLAGS_SYNC;
  const char *ev12 = EVENTS::FLAGS_IMPRESSION;
  const char *ev13 = EVENTS::FLAGS_METRICS_SENT;
  std::string ev14 = EVENTS::flagChange("test-flag");

  // 19. Storage provider
  InMemoryStorageProvider storage;
  storage.save("key", "value");
  std::string val = storage.get("key");
  storage.remove("key");

  // 20. Error type
  GatrixFeatureError err("Not found", "FLAG_NOT_FOUND");
  std::string errMsg = err.what();
  std::string errCode = err.code();

  // 21. isReady, getError
  bool ready = client->isReady();
  std::string error = client->getError();

  // 22. Stop
  client->stop();

  std::cout << "ALL API CHECKS PASSED!" << std::endl;

  // Suppress unused variable warnings
  (void)enabled;
  (void)varName;
  (void)boolVal;
  (void)strVal;
  (void)numVal;
  (void)jsonVal;
  (void)detailValue;
  (void)detailReason;
  (void)detailExists;
  (void)detailEnabled;
  (void)proxyExists;
  (void)proxyEnabled;
  (void)proxyName;
  (void)proxyVarType;
  (void)proxyVersion;
  (void)proxyReason;
  (void)proxyImpression;
  (void)proxyRaw;
  (void)proxyVar;
  (void)proxyBool;
  (void)proxyStr;
  (void)proxyNum;
  (void)proxyJson;
  (void)isSyncMode;
  (void)canSync;
  (void)groupSize;
  (void)groupName;
  (void)totalFlags;
  (void)fetchCount;
  (void)state;
  (void)etag;
  (void)offline;
  (void)ev1;
  (void)ev2;
  (void)ev3;
  (void)ev4;
  (void)ev5;
  (void)ev6;
  (void)ev7;
  (void)ev8;
  (void)ev9;
  (void)ev10;
  (void)ev11;
  (void)ev12;
  (void)ev13;
  (void)ev14;
  (void)val;
  (void)errMsg;
  (void)errCode;
  (void)ready;
  (void)error;
  (void)version;
  (void)variant;
  (void)proxyVariant;
  (void)current;

  return 0;
}
