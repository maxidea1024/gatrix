// Stub cocos2d.h for compilation testing only
#ifndef COCOS2D_H__
#define COCOS2D_H__

#include <functional>
#include <string>

#define CCLOG(...)
#define CC_REPEAT_FOREVER (unsigned int)(-1)

namespace cocos2d {

class Scheduler {
public:
  template <typename T>
  void schedule(T callback, void *target, float interval, unsigned int repeat,
                float delay, bool paused, const std::string &key) {}
  void unschedule(const std::string &key, void *target) {}
};

class Director {
public:
  static Director *getInstance() {
    static Director instance;
    return &instance;
  }
  Scheduler *getScheduler() { return &_scheduler; }

private:
  Scheduler _scheduler;
};

} // namespace cocos2d

#endif
