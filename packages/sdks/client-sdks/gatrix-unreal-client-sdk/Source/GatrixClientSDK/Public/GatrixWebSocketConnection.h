// Copyright Gatrix. All Rights Reserved.
// WebSocket streaming connection for real-time flag invalidation

#pragma once

#include "CoreMinimal.h"
#include "IWebSocket.h"

DECLARE_DELEGATE_TwoParams(FGatrixWsEventDelegate, const FString& /*EventType*/,
                           const FString& /*EventData*/);
DECLARE_DELEGATE(FGatrixWsConnectedDelegate);
DECLARE_DELEGATE_OneParam(FGatrixWsErrorDelegate, const FString& /*ErrorMessage*/);
DECLARE_DELEGATE(FGatrixWsDisconnectedDelegate);

/**
 * WebSocket connection manager for streaming.
 * Uses UE4 IWebSocket (FWebSocketsModule). JSON messages with a "type" field
 * are dispatched as events. Includes client-side ping/pong keep-alive.
 */
class GATRIXSDK_API FGatrixWebSocketConnection {
public:
  FGatrixWebSocketConnection();
  ~FGatrixWebSocketConnection();

  /**
   * Connect to the WebSocket endpoint.
   * @param Url Full WebSocket URL (ws:// or wss://)
   * @param Headers HTTP headers (X-API-Token, etc.)
   * @param PingIntervalSeconds Client-side ping interval
   */
  void Connect(const FString& Url, const TMap<FString, FString>& Headers,
               int32 PingIntervalSeconds = 30);

  /** Disconnect and close WebSocket */
  void Disconnect();

  /** Check if currently connected */
  bool IsConnected() const { return bConnected; }

  // Delegates
  FGatrixWsEventDelegate OnEvent;
  FGatrixWsConnectedDelegate OnConnected;
  FGatrixWsErrorDelegate OnError;
  FGatrixWsDisconnectedDelegate OnDisconnected;

private:
  /** Handle WebSocket connected */
  void HandleConnected();

  /** Handle WebSocket connection error */
  void HandleConnectionError(const FString& Error);

  /** Handle WebSocket closed */
  void HandleClosed(int32 StatusCode, const FString& Reason, bool bWasClean);

  /** Handle incoming WebSocket message */
  void HandleMessage(const FString& Message);

  /** Start ping timer */
  void StartPingTimer(int32 IntervalSeconds);

  /** Stop ping timer */
  void StopPingTimer();

  /** Send ping message */
  void SendPing();

  /** UE4 WebSocket instance */
  TSharedPtr<IWebSocket> WebSocket;

  /** Connection state */
  bool bConnected = false;
  bool bDisconnecting = false;

  /** Ping timer handle */
  FTimerHandle PingTimerHandle;
};
