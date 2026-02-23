// Copyright Gatrix. All Rights Reserved.
// Storage provider interface for Gatrix Unreal SDK

#pragma once

#include "CoreMinimal.h"

/**
 * Interface for persistent flag storage.
 * Implement this to provide custom storage (e.g., file-based, cloud saves).
 */
class GATRIXSDK_API IGatrixStorageProvider {
public:
  virtual ~IGatrixStorageProvider() {}

  /** Save a value by key */
  virtual void Save(const FString& Key, const FString& Value) = 0;

  /** Load a value by key. Returns empty string if not found. */
  virtual FString Load(const FString& Key) = 0;

  /** Delete a value by key */
  virtual void Delete(const FString& Key) = 0;
};

/**
 * Default in-memory storage provider.
 * Data is lost when the process exits.
 */
class GATRIXSDK_API FGatrixInMemoryStorageProvider : public IGatrixStorageProvider {
public:
  virtual void Save(const FString& Key, const FString& Value) override {
    FScopeLock Lock(&CriticalSection);
    Storage.Add(Key, Value);
  }

  virtual FString Load(const FString& Key) override {
    FScopeLock Lock(&CriticalSection);
    const FString* Found = Storage.Find(Key);
    return Found ? *Found : FString();
  }

  virtual void Delete(const FString& Key) override {
    FScopeLock Lock(&CriticalSection);
    Storage.Remove(Key);
  }

private:
  TMap<FString, FString> Storage;
  mutable FCriticalSection CriticalSection;
};
