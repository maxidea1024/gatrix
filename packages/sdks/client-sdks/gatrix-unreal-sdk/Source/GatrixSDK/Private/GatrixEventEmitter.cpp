// Copyright Gatrix. All Rights Reserved.

#include "GatrixEventEmitter.h"

int32 FGatrixEventEmitter::AddListener(
    const FString &EventName, TFunction<void(const TArray<FString> &)> Callback,
    bool bOnce, const FString &Name) {
  FScopeLock Lock(&CriticalSection);

  int32 Handle = NextHandle++;

  FListenerInfo Info;
  Info.Handle = Handle;
  Info.Name =
      Name.IsEmpty() ? FString::Printf(TEXT("listener_%d"), Handle) : Name;
  Info.Callback = MoveTemp(Callback);
  Info.bOnce = bOnce;
  Info.CallCount = 0;
  Info.RegisteredAt = FDateTime::UtcNow();

  Listeners.FindOrAdd(EventName).Add(MoveTemp(Info));
  HandleToEvent.Add(Handle, EventName);

  return Handle;
}

int32 FGatrixEventEmitter::On(const FString &EventName,
                              TFunction<void(const TArray<FString> &)> Callback,
                              const FString &Name) {
  return AddListener(EventName, MoveTemp(Callback), false, Name);
}

int32 FGatrixEventEmitter::Once(
    const FString &EventName, TFunction<void(const TArray<FString> &)> Callback,
    const FString &Name) {
  return AddListener(EventName, MoveTemp(Callback), true, Name);
}

void FGatrixEventEmitter::Off(int32 Handle) {
  FScopeLock Lock(&CriticalSection);

  const FString *EventName = HandleToEvent.Find(Handle);
  if (!EventName) {
    return;
  }

  TArray<FListenerInfo> *ListenerList = Listeners.Find(*EventName);
  if (ListenerList) {
    for (int32 i = ListenerList->Num() - 1; i >= 0; --i) {
      if ((*ListenerList)[i].Handle == Handle) {
        ListenerList->RemoveAt(i);
        break;
      }
    }
  }

  HandleToEvent.Remove(Handle);
}

void FGatrixEventEmitter::OffAll(const FString &EventName) {
  FScopeLock Lock(&CriticalSection);

  // Remove handle mappings for this event
  TArray<int32> HandlesToRemove;
  for (const auto &Pair : HandleToEvent) {
    if (Pair.Value == EventName) {
      HandlesToRemove.Add(Pair.Key);
    }
  }
  for (int32 Handle : HandlesToRemove) {
    HandleToEvent.Remove(Handle);
  }

  Listeners.Remove(EventName);
}

int32 FGatrixEventEmitter::OnAny(
    TFunction<void(const FString &, const TArray<FString> &)> Callback,
    const FString &Name) {
  FScopeLock Lock(&CriticalSection);

  int32 Handle = NextHandle++;

  FAnyListenerInfo Info;
  Info.Handle = Handle;
  Info.Name =
      Name.IsEmpty() ? FString::Printf(TEXT("any_listener_%d"), Handle) : Name;
  Info.Callback = MoveTemp(Callback);
  Info.RegisteredAt = FDateTime::UtcNow();

  AnyListeners.Add(MoveTemp(Info));

  return Handle;
}

void FGatrixEventEmitter::OffAny(int32 Handle) {
  FScopeLock Lock(&CriticalSection);

  for (int32 i = AnyListeners.Num() - 1; i >= 0; --i) {
    if (AnyListeners[i].Handle == Handle) {
      AnyListeners.RemoveAt(i);
      break;
    }
  }
}

void FGatrixEventEmitter::Emit(const FString &EventName,
                               const TArray<FString> &Args) {
  // Collect callbacks to invoke outside the lock to avoid deadlocks
  TArray<TFunction<void(const TArray<FString> &)>> CallbacksToInvoke;
  TArray<TFunction<void(const FString &, const TArray<FString> &)>>
      AnyCallbacksToInvoke;

  {
    FScopeLock Lock(&CriticalSection);

    // Fire specific listeners
    TArray<FListenerInfo> *ListenerList = Listeners.Find(EventName);
    if (ListenerList) {
      for (int32 i = ListenerList->Num() - 1; i >= 0; --i) {
        FListenerInfo &Info = (*ListenerList)[i];
        Info.CallCount++;
        CallbacksToInvoke.Add(Info.Callback);

        if (Info.bOnce) {
          HandleToEvent.Remove(Info.Handle);
          ListenerList->RemoveAt(i);
        }
      }
    }

    // Fire any-event listeners
    for (FAnyListenerInfo &AnyInfo : AnyListeners) {
      AnyCallbacksToInvoke.Add(AnyInfo.Callback);
    }
  }

  // Invoke callbacks outside the lock (reverse order to maintain original
  // registration order)
  for (int32 i = CallbacksToInvoke.Num() - 1; i >= 0; --i) {
    CallbacksToInvoke[i](Args);
  }
  for (auto &AnyCallback : AnyCallbacksToInvoke) {
    AnyCallback(EventName, Args);
  }
}

void FGatrixEventEmitter::Emit(const FString &EventName, const FString &Arg) {
  TArray<FString> Args;
  Args.Add(Arg);
  Emit(EventName, Args);
}

void FGatrixEventEmitter::RemoveAll() {
  FScopeLock Lock(&CriticalSection);
  Listeners.Empty();
  AnyListeners.Empty();
  HandleToEvent.Empty();
}

TMap<FString, TArray<FGatrixEventEmitter::FListenerInfo>>
FGatrixEventEmitter::GetHandlerStats() const {
  FScopeLock Lock(&CriticalSection);
  return Listeners;
}
