#ifndef GATRIX_EVENTS_H
#define GATRIX_EVENTS_H

#include <string>

namespace gatrix {

// Namespaced event constants (from CLIENT_SDK_SPEC.md)
struct EVENTS {
  static constexpr const char *FLAGS_INIT = "flags.init";
  static constexpr const char *FLAGS_READY = "flags.ready";
  static constexpr const char *FLAGS_FETCH = "flags.fetch";
  static constexpr const char *FLAGS_FETCH_START = "flags.fetch_start";
  static constexpr const char *FLAGS_FETCH_SUCCESS = "flags.fetch_success";
  static constexpr const char *FLAGS_FETCH_ERROR = "flags.fetch_error";
  static constexpr const char *FLAGS_FETCH_END = "flags.fetch_end";
  static constexpr const char *FLAGS_CHANGE = "flags.change";
  static constexpr const char *SDK_ERROR = "flags.error";
  static constexpr const char *FLAGS_RECOVERED = "flags.recovered";
  static constexpr const char *FLAGS_SYNC = "flags.sync";
  static constexpr const char *FLAGS_REMOVED = "flags.removed";
  static constexpr const char *FLAGS_IMPRESSION = "flags.impression";
  static constexpr const char *FLAGS_METRICS_SENT = "flags.metrics.sent";
  static constexpr const char *FLAGS_METRICS_ERROR = "flags.metrics.error";

  // Per-flag change event helper
  static std::string flagChange(const std::string &flagName) {
    return "flags." + flagName + ".change";
  }
};

} // namespace gatrix

#endif // GATRIX_EVENTS_H
