// Stub json/document.h - Minimal RapidJSON stubs for compilation testing
#ifndef RAPIDJSON_DOCUMENT_H_
#define RAPIDJSON_DOCUMENT_H_

#include <cstring>
#include <string>
#include <vector>


namespace rapidjson {

typedef unsigned int SizeType;

enum Type {
  kNullType = 0,
  kFalseType,
  kTrueType,
  kObjectType,
  kArrayType,
  kStringType,
  kNumberType
};

class CrtAllocator {
public:
  void *Malloc(size_t size) { return std::malloc(size); }
  void *Realloc(void *ptr, size_t, size_t newSize) {
    return std::realloc(ptr, newSize);
  }
  static void Free(void *ptr) { std::free(ptr); }
};

template <typename BaseAllocator = CrtAllocator> class MemoryPoolAllocator {
public:
  void *Malloc(size_t size) { return std::malloc(size); }
  void *Realloc(void *ptr, size_t, size_t newSize) {
    return std::realloc(ptr, newSize);
  }
  static void Free(void *ptr) { std::free(ptr); }
};

template <typename Encoding, typename Allocator> class GenericValue;

template <typename Encoding, typename Allocator> class GenericMember {
public:
  GenericValue<Encoding, Allocator> name;
  GenericValue<Encoding, Allocator> value;
};

template <typename CharType = char> struct UTF8 {
  typedef CharType Ch;
};

template <typename Encoding = UTF8<>,
          typename Allocator = MemoryPoolAllocator<>>
class GenericValue {
public:
  typedef Allocator AllocatorType;
  typedef GenericMember<Encoding, Allocator> Member;
  typedef GenericValue *MemberIterator;
  typedef const GenericValue *ConstMemberIterator;

  GenericValue() : _type(kNullType), _strVal(""), _numVal(0), _boolVal(false) {}
  GenericValue(Type type)
      : _type(type), _strVal(""), _numVal(0), _boolVal(false) {}
  GenericValue(const char *str, Allocator &)
      : _type(kStringType), _strVal(str), _numVal(0), _boolVal(false) {}

  GenericValue &SetNull() {
    _type = kNullType;
    return *this;
  }
  GenericValue &SetObject() {
    _type = kObjectType;
    return *this;
  }
  GenericValue &SetArray() {
    _type = kArrayType;
    return *this;
  }

  bool IsNull() const { return _type == kNullType; }
  bool IsObject() const { return _type == kObjectType; }
  bool IsArray() const { return _type == kArrayType; }
  bool IsString() const { return _type == kStringType; }
  bool IsNumber() const { return _type == kNumberType; }
  bool IsBool() const { return _type == kTrueType || _type == kFalseType; }
  bool IsInt() const { return _type == kNumberType; }
  bool IsDouble() const { return _type == kNumberType; }

  const char *GetString() const { return _strVal.c_str(); }
  int GetInt() const { return static_cast<int>(_numVal); }
  double GetDouble() const { return _numVal; }
  bool GetBool() const { return _boolVal; }
  SizeType Size() const { return static_cast<SizeType>(_children.size()); }

  bool HasMember(const char *name) const { return false; }

  GenericValue &operator[](const char *name) {
    static GenericValue dummy;
    return dummy;
  }
  const GenericValue &operator[](const char *name) const {
    static GenericValue dummy;
    return dummy;
  }
  const GenericValue &operator[](SizeType index) const {
    return _children[index];
  }

  bool HasParseError() const { return false; }

  GenericValue &AddMember(GenericValue &name, GenericValue &value,
                          Allocator &alloc) {
    return *this;
  }
  GenericValue &AddMember(const char *name, GenericValue &value,
                          Allocator &alloc) {
    return *this;
  }
  GenericValue &AddMember(GenericValue &name, bool value, Allocator &alloc) {
    return *this;
  }
  GenericValue &AddMember(const char *name, bool value, Allocator &alloc) {
    return *this;
  }
  GenericValue &AddMember(const char *name, int value, Allocator &alloc) {
    return *this;
  }

  GenericValue &Parse(const char *) { return *this; }

  template <typename Handler> bool Accept(Handler &handler) const {
    return true;
  }

  GenericValue &CopyFrom(const GenericValue &rhs, Allocator &alloc) {
    return *this;
  }

  MemberIterator MemberBegin() { return nullptr; }
  MemberIterator MemberEnd() { return nullptr; }

  Allocator &GetAllocator() {
    static Allocator alloc;
    return alloc;
  }

private:
  Type _type;
  std::string _strVal;
  double _numVal;
  bool _boolVal;
  std::vector<GenericValue> _children;
};

typedef GenericValue<UTF8<>> Value;

template <typename Encoding = UTF8<>,
          typename Allocator = MemoryPoolAllocator<>>
class GenericDocument : public GenericValue<Encoding, Allocator> {
public:
  typedef
      typename GenericValue<Encoding, Allocator>::AllocatorType AllocatorType;
  AllocatorType &GetAllocator() { return _allocator; }
  GenericDocument &Parse(const char *json) { return *this; }
  bool HasParseError() const { return false; }

private:
  AllocatorType _allocator;
};

typedef GenericDocument<UTF8<>> Document;

} // namespace rapidjson

#endif
