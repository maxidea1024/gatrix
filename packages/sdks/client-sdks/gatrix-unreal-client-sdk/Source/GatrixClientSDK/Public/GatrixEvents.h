// Copyright Gatrix. All Rights Reserved.
// Event constants for Gatrix Unreal SDK
// All events use the 'flags.' prefix for namespacing

#pragma once

#include "CoreMinimal.h"

namespace GatrixEvents {
/** SDK initialized (from storage/bootstrap) */
static const FString FlagsInit = TEXT("flags.init");
/** First successful fetch completed */
static const FString FlagsReady = TEXT("flags.ready");
/** Started fetching flags from server */
static const FString FlagsFetch = TEXT("flags.fetch");
/** Started fetching flags from server */
static const FString FlagsFetchStart = TEXT("flags.fetch_start");
/** Successfully fetched flags from server */
static const FString FlagsFetchSuccess = TEXT("flags.fetch_success");
/** Error occurred during fetching */
static const FString FlagsFetchError = TEXT("flags.fetch_error");
/** Completed fetching flags (success or error) */
static const FString FlagsFetchEnd = TEXT("flags.fetch_end");
/** Flags changed from server */
static const FString FlagsChange = TEXT("flags.change");
/** General SDK error occurred */
static const FString SdkError = TEXT("flags.error");
/** Flag accessed (if impressionData enabled) */
static const FString FlagsImpression = TEXT("flags.impression");
/** Flags synchronized (explicitSyncMode) */
static const FString FlagsSync = TEXT("flags.sync");
/** Pending sync flags available (explicitSyncMode) */
static const FString FlagsPendingSync = TEXT("flags.pending_sync");
/** One or more flags removed from server. Payload: comma-separated removed flag
 * names */
static const FString FlagsRemoved = TEXT("flags.removed");
/** SDK recovered from error state */
static const FString FlagsRecovered = TEXT("flags.recovered");
/** Metrics sent to server */
static const FString FlagsMetricsSent = TEXT("flags.metrics_sent");
/** Error sending metrics */
static const FString FlagsMetricsError = TEXT("flags.metrics_error");
/** Streaming connected to server */
static const FString FlagsStreamingConnected = TEXT("flags.streaming_connected");
/** Streaming disconnected from server */
static const FString FlagsStreamingDisconnected = TEXT("flags.streaming_disconnected");
/** Streaming error occurred */
static const FString FlagsStreamingError = TEXT("flags.streaming_error");
/** Streaming reconnecting */
static const FString FlagsStreamingReconnecting = TEXT("flags.streaming_reconnecting");
/** Flags invalidated by streaming (triggers re-fetch) */
static const FString FlagsInvalidated = TEXT("flags.invalidated");

/** Get the per-flag change event name */
inline FString FlagChange(const FString& FlagName) {
  return FString::Printf(TEXT("flags.change:%s"), *FlagName);
}
} // namespace GatrixEvents
