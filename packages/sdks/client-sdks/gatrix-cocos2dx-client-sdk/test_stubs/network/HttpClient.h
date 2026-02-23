// Stub network/HttpClient.h for compilation testing only
#ifndef CC_HTTP_CLIENT_H
#define CC_HTTP_CLIENT_H

#include <functional>
#include <string>
#include <vector>


namespace cocos2d {
namespace network {

class HttpResponse;

class HttpRequest {
public:
  enum class Type { GET, POST, PUT, DELETE };
  void setUrl(const char *) {}
  void setRequestType(Type) {}
  void setHeaders(const std::vector<std::string> &) {}
  void setRequestData(const char *, size_t) {}
  void setResponseCallback(std::function<void(void *, HttpResponse *)>) {}
  void release() {}
};

class HttpResponse {
public:
  bool isSucceed() const { return true; }
  long getResponseCode() const { return 200; }
  std::vector<char> *getResponseData() { return &_data; }
  std::vector<char> *getResponseHeader() { return &_header; }

private:
  std::vector<char> _data;
  std::vector<char> _header;
};

class HttpClient {
public:
  static HttpClient *getInstance() {
    static HttpClient instance;
    return &instance;
  }
  void send(HttpRequest *) {}
};

} // namespace network
} // namespace cocos2d

#endif
