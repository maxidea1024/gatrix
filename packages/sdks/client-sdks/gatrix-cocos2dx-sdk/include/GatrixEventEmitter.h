#ifndef GATRIX_EVENT_EMITTER_H
#define GATRIX_EVENT_EMITTER_H

#include "GatrixTypes.h"
#include <algorithm>
#include <functional>
#include <map>
#include <string>
#include <vector>


namespace gatrix {

using GatrixEventCallback =
    std::function<void(const std::vector<std::string> &)>;
using GatrixAnyCallback =
    std::function<void(const std::string &, const std::vector<std::string> &)>;

class GatrixEventEmitter {
public:
  void on(const std::string &event, GatrixEventCallback callback,
          const std::string &name = "") {
    _listeners[event].push_back(
        {callback, resolveName(name), nowISO(), false, 0});
  }

  void once(const std::string &event, GatrixEventCallback callback,
            const std::string &name = "") {
    _listeners[event].push_back(
        {callback, resolveName(name), nowISO(), true, 0});
  }

  void off(const std::string &event, GatrixEventCallback callback = nullptr) {
    if (!callback) {
      _listeners.erase(event);
    }
    // Note: comparing std::function is not trivial in C++.
    // In practice, users would use off(event) to remove all listeners for that
    // event.
  }

  void onAny(GatrixAnyCallback callback, const std::string &name = "") {
    _anyListeners.push_back({callback, resolveName(name)});
  }

  void offAny() { _anyListeners.clear(); }

  void emit(const std::string &event,
            const std::vector<std::string> &args = {}) {
    // Fire specific listeners
    if (_listeners.count(event)) {
      auto &list = _listeners[event];
      for (auto &l : list) {
        l.callCount++;
        l.callback(args);
      }
      // Remove once listeners
      list.erase(std::remove_if(list.begin(), list.end(),
                                [](const Listener &l) { return l.isOnce; }),
                 list.end());
    }

    // Fire any listeners
    for (auto &al : _anyListeners) {
      al.callback(event, args);
    }
  }

  std::map<std::string, std::vector<EventHandlerStats>>
  getHandlerStats() const {
    std::map<std::string, std::vector<EventHandlerStats>> stats;
    for (const auto &[event, listeners] : _listeners) {
      for (const auto &l : listeners) {
        stats[event].push_back({l.name, l.callCount, l.isOnce, l.registeredAt});
      }
    }
    return stats;
  }

private:
  struct Listener {
    GatrixEventCallback callback;
    std::string name;
    std::string registeredAt;
    bool isOnce = false;
    int callCount = 0;
  };

  struct AnyListener {
    GatrixAnyCallback callback;
    std::string name;
  };

  std::map<std::string, std::vector<Listener>> _listeners;
  std::vector<AnyListener> _anyListeners;
  int _autoNameCount = 0;

  std::string resolveName(const std::string &name) {
    if (!name.empty())
      return name;
    return "listener_" + std::to_string(++_autoNameCount);
  }

  static std::string nowISO() {
    auto now = std::chrono::system_clock::now();
    auto time_t = std::chrono::system_clock::to_time_t(now);
    char buf[64];
    struct tm timeinfo;
#ifdef _WIN32
    gmtime_s(&timeinfo, &time_t);
#else
    gmtime_r(&time_t, &timeinfo);
#endif
    strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
    return std::string(buf);
  }
};

} // namespace gatrix

#endif // GATRIX_EVENT_EMITTER_H
