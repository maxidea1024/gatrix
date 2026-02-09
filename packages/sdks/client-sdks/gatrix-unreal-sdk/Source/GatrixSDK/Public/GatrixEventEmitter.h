// Copyright Gatrix. All Rights Reserved.
// Thread-safe event emitter for Gatrix Unreal SDK

#pragma once

#include "CoreMinimal.h"
#include "HAL/CriticalSection.h"

DECLARE_DELEGATE_OneParam(FGatrixEventDelegate, const TArray<FString> &);
DECLARE_DELEGATE_TwoParams(FGatrixAnyEventDelegate, const FString &,
                           const TArray<FString> &);

/**
 * Thread-safe event emitter.
 * Supports on/once/off, onAny/offAny, and handler statistics.
 * All emission is marshalled to the game thread.
 */
class GATRIXSDK_API FGatrixEventEmitter {
public:
  struct FListenerInfo {
    int32 Handle;
    FString Name;
    TFunction<void(const TArray<FString> &)> Callback;
    bool bOnce;
    int32 CallCount;
    FDateTime RegisteredAt;

    FListenerInfo()
        : Handle(0), bOnce(false), CallCount(0),
          RegisteredAt(FDateTime::UtcNow()) {}
  };

  struct FAnyListenerInfo {
    int32 Handle;
    FString Name;
    TFunction<void(const FString &, const TArray<FString> &)> Callback;
    FDateTime RegisteredAt;

    FAnyListenerInfo() : Handle(0), RegisteredAt(FDateTime::UtcNow()) {}
  };

  /** Subscribe to an event */
  int32 On(const FString &EventName,
           TFunction<void(const TArray<FString> &)> Callback,
           const FString &Name = TEXT(""));

  /** Subscribe to an event (fires once then auto-removes) */
  int32 Once(const FString &EventName,
             TFunction<void(const TArray<FString> &)> Callback,
             const FString &Name = TEXT(""));

  /** Unsubscribe a specific listener by handle */
  void Off(int32 Handle);

  /** Unsubscribe all listeners for an event */
  void OffAll(const FString &EventName);

  /** Subscribe to all events */
  int32
  OnAny(TFunction<void(const FString &, const TArray<FString> &)> Callback,
        const FString &Name = TEXT(""));

  /** Unsubscribe an any-event listener by handle */
  void OffAny(int32 Handle);

  /** Emit an event (thread-safe, fires callbacks on calling thread) */
  void Emit(const FString &EventName,
            const TArray<FString> &Args = TArray<FString>());

  /** Emit with single string arg convenience */
  void Emit(const FString &EventName, const FString &Arg);

  /** Remove all listeners */
  void RemoveAll();

  /** Get handler statistics for monitoring */
  TMap<FString, TArray<FListenerInfo>> GetHandlerStats() const;

private:
  int32 AddListener(const FString &EventName,
                    TFunction<void(const TArray<FString> &)> Callback,
                    bool bOnce, const FString &Name);

  mutable FCriticalSection CriticalSection;
  TMap<FString, TArray<FListenerInfo>> Listeners;
  TArray<FAnyListenerInfo> AnyListeners;
  int32 NextHandle = 1;

  // Map handle -> event name for O(1) removal
  TMap<int32, FString> HandleToEvent;
};
