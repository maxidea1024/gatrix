// Stub json/stringbuffer.h for compilation testing
#ifndef RAPIDJSON_STRINGBUFFER_H_
#define RAPIDJSON_STRINGBUFFER_H_

#include <string>

namespace rapidjson {

class StringBuffer {
public:
  const char *GetString() const { return _str.c_str(); }
  size_t GetSize() const { return _str.size(); }
  void Put(char c) { _str += c; }

private:
  std::string _str;
};

} // namespace rapidjson

#endif
