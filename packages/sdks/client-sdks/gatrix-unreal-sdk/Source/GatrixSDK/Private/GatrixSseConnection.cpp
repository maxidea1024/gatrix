// Copyright Gatrix. All Rights Reserved.
// SSE (Server-Sent Events) streaming connection implementation

#include "GatrixSseConnection.h"

#include "GatrixSDKModule.h"

FGatrixSseConnection::FGatrixSseConnection() {}

FGatrixSseConnection::~FGatrixSseConnection() { Disconnect(); }

void FGatrixSseConnection::Connect(const FString &Url,
                                   const TMap<FString, FString> &Headers) {
  // Disconnect any existing connection
  Disconnect();

  bDisconnecting = false;
  ProcessedBytes = 0;
  ReceiveBuffer.Empty();
  CurrentEventType.Empty();
  CurrentEventData.Empty();

  // Create HTTP request for SSE streaming
  ActiveRequest = FHttpModule::Get().CreateRequest();
  ActiveRequest->SetURL(Url);
  ActiveRequest->SetVerb(TEXT("GET"));
  ActiveRequest->SetHeader(TEXT("Accept"), TEXT("text/event-stream"));
  ActiveRequest->SetHeader(TEXT("Cache-Control"), TEXT("no-cache"));

  // Apply custom headers
  for (const auto &Header : Headers) {
    ActiveRequest->SetHeader(Header.Key, Header.Value);
  }

  // Bind progress callback for real-time data reception
  ActiveRequest->OnRequestProgress().BindRaw(
      this, &FGatrixSseConnection::HandleRequestProgress);

  // Bind completion callback
  ActiveRequest->OnProcessRequestComplete().BindRaw(
      this, &FGatrixSseConnection::HandleRequestComplete);

  UE_LOG(LogGatrix, Log, TEXT("SSE: Connecting to %s"), *Url);
  ActiveRequest->ProcessRequest();
}

void FGatrixSseConnection::Disconnect() {
  bDisconnecting = true;
  bConnected = false;

  if (ActiveRequest.IsValid()) {
    ActiveRequest->CancelRequest();
    ActiveRequest.Reset();
  }

  ReceiveBuffer.Empty();
  ProcessedBytes = 0;
  CurrentEventType.Empty();
  CurrentEventData.Empty();
}

void FGatrixSseConnection::HandleRequestProgress(FHttpRequestPtr Request,
                                                 int32 BytesSent,
                                                 int32 BytesReceived) {
  if (bDisconnecting || !Request.IsValid()) {
    return;
  }

  // Get the response content received so far
  const TArray<uint8> &Content = Request->GetResponse()->GetContent();
  if (Content.Num() <= ProcessedBytes) {
    return;
  }

  // Mark as connected on first data reception
  if (!bConnected) {
    bConnected = true;
    OnConnected.ExecuteIfBound();
  }

  // Extract only the new bytes since last progress callback
  const int32 NewBytes = Content.Num() - ProcessedBytes;
  FString NewData;
  // Convert UTF-8 bytes to FString
  FUTF8ToTCHAR Converter(
      reinterpret_cast<const ANSICHAR *>(Content.GetData() + ProcessedBytes),
      NewBytes);
  NewData = FString(Converter.Length(), Converter.Get());
  ProcessedBytes = Content.Num();

  // Append to buffer and parse SSE events
  ReceiveBuffer += NewData;
  ParseSseBuffer();
}

void FGatrixSseConnection::HandleRequestComplete(FHttpRequestPtr Request,
                                                 FHttpResponsePtr Response,
                                                 bool bWasSuccessful) {
  if (bDisconnecting) {
    return;
  }

  bConnected = false;

  if (!bWasSuccessful) {
    const FString ErrorMsg =
        Response.IsValid()
            ? FString::Printf(TEXT("SSE connection failed: %d %s"),
                              Response->GetResponseCode(),
                              *Response->GetContentAsString())
            : TEXT("SSE connection failed: no response");
    UE_LOG(LogGatrix, Warning, TEXT("%s"), *ErrorMsg);
    OnError.ExecuteIfBound(ErrorMsg);
  }

  // Stream ended (server closed or network error)
  OnDisconnected.ExecuteIfBound();
}

void FGatrixSseConnection::ParseSseBuffer() {
  // SSE protocol: events are separated by empty lines (\n\n)
  // Each event can have:
  //   event: <type>
  //   data: <payload>
  //   id: <id> (ignored)
  //   retry: <ms> (ignored)
  //   : <comment> (ignored)

  int32 LineStart = 0;
  while (LineStart < ReceiveBuffer.Len()) {
    // Find next newline
    int32 NewlinePos =
        ReceiveBuffer.Find(TEXT("\n"), ESearchCase::CaseSensitive,
                           ESearchDir::FromStart, LineStart);
    if (NewlinePos == INDEX_NONE) {
      // No complete line yet, keep remaining in buffer
      break;
    }

    // Extract the line (strip \r if present)
    FString Line =
        ReceiveBuffer.Mid(LineStart, NewlinePos - LineStart).TrimEnd();
    LineStart = NewlinePos + 1;

    if (Line.IsEmpty()) {
      // Empty line = dispatch event
      if (!CurrentEventType.IsEmpty() || !CurrentEventData.IsEmpty()) {
        FString EventType =
            CurrentEventType.IsEmpty() ? TEXT("message") : CurrentEventType;
        OnEvent.ExecuteIfBound(EventType, CurrentEventData);
        CurrentEventType.Empty();
        CurrentEventData.Empty();
      }
      continue;
    }

    // Parse SSE field
    if (Line.StartsWith(TEXT("event:"))) {
      CurrentEventType = Line.Mid(6).TrimStart();
    } else if (Line.StartsWith(TEXT("data:"))) {
      if (!CurrentEventData.IsEmpty()) {
        CurrentEventData += TEXT("\n");
      }
      CurrentEventData += Line.Mid(5).TrimStart();
    }
    // Ignore 'id:', 'retry:', and comment lines starting with ':'
  }

  // Remove processed data from buffer
  if (LineStart > 0) {
    ReceiveBuffer = ReceiveBuffer.Mid(LineStart);
  }
}
