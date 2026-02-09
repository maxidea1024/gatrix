// Stub json/writer.h for compilation testing
#ifndef RAPIDJSON_WRITER_H_
#define RAPIDJSON_WRITER_H_

#include "stringbuffer.h"

namespace rapidjson {

template <typename OutputStream> class Writer {
public:
  Writer(OutputStream &) {}
  bool Null() { return true; }
  bool Bool(bool) { return true; }
  bool Int(int) { return true; }
  bool Uint(unsigned) { return true; }
  bool Int64(long long) { return true; }
  bool Uint64(unsigned long long) { return true; }
  bool Double(double) { return true; }
  bool String(const char *, size_t = 0, bool = false) { return true; }
  bool StartObject() { return true; }
  bool Key(const char *) { return true; }
  bool EndObject(size_t = 0) { return true; }
  bool StartArray() { return true; }
  bool EndArray(size_t = 0) { return true; }
};

} // namespace rapidjson

#endif
