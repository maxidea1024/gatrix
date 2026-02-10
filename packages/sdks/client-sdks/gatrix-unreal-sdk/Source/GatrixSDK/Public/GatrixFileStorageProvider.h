// Copyright Gatrix. All Rights Reserved.
// File-based storage provider for Gatrix Unreal SDK

#pragma once

#include "CoreMinimal.h"
#include "GatrixStorageProvider.h"
#include "HAL/PlatformFileManager.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"


/**
 * File-based storage provider.
 * Persists data as JSON files in the project's Saved directory.
 * Thread-safe via FCriticalSection.
 */
class GATRIXSDK_API FGatrixFileStorageProvider : public IGatrixStorageProvider {
public:
  FGatrixFileStorageProvider(const FString &Prefix = TEXT("gatrix_cache")) {
    // Use Saved/Gatrix/ directory for storage
    StorageDir = FPaths::Combine(FPaths::ProjectSavedDir(), TEXT("Gatrix"));

    // Ensure directory exists
    IPlatformFile &PlatformFile = FPlatformFileManager::Get().GetPlatformFile();
    if (!PlatformFile.DirectoryExists(*StorageDir)) {
      PlatformFile.CreateDirectoryTree(*StorageDir);
    }

    CachePrefix = Prefix;
  }

  virtual void Save(const FString &Key, const FString &Value) override {
    FScopeLock Lock(&CriticalSection);
    FString FilePath = GetFilePath(Key);
    FFileHelper::SaveStringToFile(Value, *FilePath,
                                  FFileHelper::EEncodingOptions::ForceUTF8);
  }

  virtual FString Load(const FString &Key) override {
    FScopeLock Lock(&CriticalSection);
    FString FilePath = GetFilePath(Key);
    FString Content;
    if (FFileHelper::LoadFileToString(Content, *FilePath)) {
      return Content;
    }
    return FString();
  }

  virtual void Delete(const FString &Key) override {
    FScopeLock Lock(&CriticalSection);
    FString FilePath = GetFilePath(Key);
    IPlatformFile &PlatformFile = FPlatformFileManager::Get().GetPlatformFile();
    PlatformFile.DeleteFile(*FilePath);
  }

private:
  FString GetFilePath(const FString &Key) const {
    // Sanitize key for safe filename usage
    FString SafeKey = Key;
    SafeKey.ReplaceInline(TEXT("/"), TEXT("_"));
    SafeKey.ReplaceInline(TEXT("\\"), TEXT("_"));
    SafeKey.ReplaceInline(TEXT(":"), TEXT("_"));
    return FPaths::Combine(StorageDir, FString::Printf(TEXT("%s_%s.json"),
                                                       *CachePrefix, *SafeKey));
  }

  FString StorageDir;
  FString CachePrefix;
  mutable FCriticalSection CriticalSection;
};
