// Copyright Gatrix. All Rights Reserved.
// SSE (Server-Sent Events) streaming connection for real-time flag invalidation

#pragma once

#include "CoreMinimal.h"
#include "Http.h"

DECLARE_DELEGATE_TwoParams(FGatrixSseEventDelegate, const FString& /*EventType*/,
                           const FString& /*EventData*/);
DECLARE_DELEGATE(FGatrixSseConnectedDelegate);
DECLARE_DELEGATE_OneParam(FGatrixSseErrorDelegate, const FString& /*ErrorMessage*/);
DECLARE_DELEGATE(FGatrixSseDisconnectedDelegate);

/**
 * SSE connection manager.
 * Uses FHttpModule OnRequestProgress delegate for real-time chunk reception.
 * All callbacks are invoked on the game thread.
 */
class GATRIXSDK_API FGatrixSseConnection {
public:
  FGatrixSseConnection();
  ~FGatrixSseConnection();

  /**
   * Connect to the SSE endpoint.
   * @param Url Full SSE endpoint URL
   * @param Headers HTTP headers to send (X-API-Token, etc.)
   */
  void Connect(const FString& Url, const TMap<FString, FString>& Headers);

  /** Disconnect and cancel pending request */
  void Disconnect();

  /** Check if currently connected */
  bool IsConnected() const { return bConnected; }

  // Delegates
  FGatrixSseEventDelegate OnEvent;
  FGatrixSseConnectedDelegate OnConnected;
  FGatrixSseErrorDelegate OnError;
  FGatrixSseDisconnectedDelegate OnDisconnected;

private:
  /** Handle partial data received from HTTP streaming */
  void HandleRequestProgress(FHttpRequestPtr Request, int32 BytesSent, int32 BytesReceived);

  /** Handle request completion (connection closed or error) */
  void HandleRequestComplete(FHttpRequestPtr Request, FHttpResponsePtr Response,
                             bool bWasSuccessful);

  /** Parse SSE data from buffer and dispatch events */
  void ParseSseBuffer();

  /** Active HTTP request */
  TSharedPtr<IHttpRequest, ESPMode::ThreadSafe> ActiveRequest;

  /** Buffer for accumulating received SSE data */
  FString ReceiveBuffer;

  /** Bytes already processed from previous progress callbacks */
  int32 ProcessedBytes = 0;

  /** Current SSE event type being parsed */
  FString CurrentEventType;

  /** Current SSE data being parsed */
  FString CurrentEventData;

  /** Connection state */
  bool bConnected = false;
  bool bDisconnecting = false;
};
