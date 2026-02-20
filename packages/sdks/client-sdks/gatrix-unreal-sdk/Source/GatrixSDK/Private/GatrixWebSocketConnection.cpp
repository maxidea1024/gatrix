// Copyright Gatrix. All Rights Reserved.
// WebSocket streaming connection implementation

#include "GatrixWebSocketConnection.h"

#include "GatrixSDKModule.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
#include "WebSocketsModule.h"

FGatrixWebSocketConnection::FGatrixWebSocketConnection() {}

FGatrixWebSocketConnection::~FGatrixWebSocketConnection() {
  Disconnect();
}

void FGatrixWebSocketConnection::Connect(const FString& Url, const TMap<FString, FString>& Headers,
                                         int32 PingIntervalSeconds) {
  // Disconnect any existing connection
  Disconnect();

  bDisconnecting = false;

  // Ensure WebSockets module is loaded
  if (!FModuleManager::Get().IsModuleLoaded(TEXT("WebSockets"))) {
    FModuleManager::Get().LoadModule(TEXT("WebSockets"));
  }

  // Build protocol and header strings for IWebSocket
  const FString Protocol = TEXT("wss");
  TMap<FString, FString> UpgradeHeaders = Headers;

  WebSocket = FWebSocketsModule::Get().CreateWebSocket(Url, Protocol, UpgradeHeaders);

  // Bind delegates
  WebSocket->OnConnected().AddRaw(this, &FGatrixWebSocketConnection::HandleConnected);
  WebSocket->OnConnectionError().AddRaw(this, &FGatrixWebSocketConnection::HandleConnectionError);
  WebSocket->OnClosed().AddRaw(this, &FGatrixWebSocketConnection::HandleClosed);
  WebSocket->OnMessage().AddRaw(this, &FGatrixWebSocketConnection::HandleMessage);

  UE_LOG(LogGatrix, Log, TEXT("WebSocket: Connecting to %s"), *Url);
  WebSocket->Connect();

  // Start ping timer after connection
  StartPingTimer(PingIntervalSeconds);
}

void FGatrixWebSocketConnection::Disconnect() {
  bDisconnecting = true;
  bConnected = false;

  StopPingTimer();

  if (WebSocket.IsValid()) {
    if (WebSocket->IsConnected()) {
      WebSocket->Close();
    }
    WebSocket.Reset();
  }
}

void FGatrixWebSocketConnection::HandleConnected() {
  if (bDisconnecting) {
    return;
  }

  bConnected = true;
  UE_LOG(LogGatrix, Log, TEXT("WebSocket: Connected"));
  OnConnected.ExecuteIfBound();
}

void FGatrixWebSocketConnection::HandleConnectionError(const FString& Error) {
  if (bDisconnecting) {
    return;
  }

  bConnected = false;
  UE_LOG(LogGatrix, Warning, TEXT("WebSocket: Connection error: %s"), *Error);
  OnError.ExecuteIfBound(Error);
  OnDisconnected.ExecuteIfBound();
}

void FGatrixWebSocketConnection::HandleClosed(int32 StatusCode, const FString& Reason,
                                              bool bWasClean) {
  if (bDisconnecting) {
    return;
  }

  bConnected = false;
  UE_LOG(LogGatrix, Log, TEXT("WebSocket: Closed (code=%d, reason=%s, clean=%s)"), StatusCode,
         *Reason, bWasClean ? TEXT("true") : TEXT("false"));
  OnDisconnected.ExecuteIfBound();
}

void FGatrixWebSocketConnection::HandleMessage(const FString& Message) {
  if (bDisconnecting) {
    return;
  }

  // Parse JSON message: { "type": "<eventType>", "data": { ... } }
  TSharedPtr<FJsonObject> JsonObject;
  TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Message);

  if (!FJsonSerializer::Deserialize(Reader, JsonObject) || !JsonObject.IsValid()) {
    UE_LOG(LogGatrix, Warning, TEXT("WebSocket: Failed to parse message: %s"), *Message);
    return;
  }

  FString EventType;
  if (!JsonObject->TryGetStringField(TEXT("type"), EventType)) {
    UE_LOG(LogGatrix, Warning, TEXT("WebSocket: Message missing 'type' field: %s"), *Message);
    return;
  }

  // Handle pong locally
  if (EventType == TEXT("pong")) {
    return;
  }

  // Extract data as JSON string
  FString EventData;
  const TSharedPtr<FJsonObject>* DataObject;
  if (JsonObject->TryGetObjectField(TEXT("data"), DataObject)) {
    TSharedRef<TJsonWriter<>> Writer = TJsonWriterFactory<>::Create(&EventData);
    FJsonSerializer::Serialize(DataObject->ToSharedRef(), Writer);
    Writer->Close();
  }

  OnEvent.ExecuteIfBound(EventType, EventData);
}

void FGatrixWebSocketConnection::StartPingTimer(int32 IntervalSeconds) {
  StopPingTimer();

  if (IntervalSeconds <= 0) {
    return;
  }

  UWorld* World = nullptr;
  if (GEngine && GEngine->GetWorldContexts().Num() > 0) {
    World = GEngine->GetWorldContexts()[0].World();
  }

  if (World) {
    World->GetTimerManager().SetTimer(
        PingTimerHandle, FTimerDelegate::CreateRaw(this, &FGatrixWebSocketConnection::SendPing),
        static_cast<float>(IntervalSeconds),
        true // looping
    );
  }
}

void FGatrixWebSocketConnection::StopPingTimer() {
  UWorld* World = nullptr;
  if (GEngine && GEngine->GetWorldContexts().Num() > 0) {
    World = GEngine->GetWorldContexts()[0].World();
  }

  if (World) {
    World->GetTimerManager().ClearTimer(PingTimerHandle);
  }
}

void FGatrixWebSocketConnection::SendPing() {
  if (WebSocket.IsValid() && WebSocket->IsConnected()) {
    WebSocket->Send(TEXT("{\"type\":\"ping\"}"));
  }
}
