// Copyright Gatrix. All Rights Reserved.
// Reserved variant source names for the Gatrix Unreal SDK.

#pragma once

#include "CoreMinimal.h"

/**
 * Well-known variant source names shared across all Gatrix SDKs.
 */
namespace GatrixVariantSource {
/** Flag not found in SDK cache */
static const TCHAR *Missing = TEXT("$missing");

/** SDK detected a type mismatch between requested and actual value type */
static const TCHAR *TypeMismatch = TEXT("$type-mismatch");

/** Value from environment-level enabledValue */
static const TCHAR *EnvDefaultEnabled = TEXT("$env-default-enabled");

/** Value from flag-level (global) enabledValue */
static const TCHAR *FlagDefaultEnabled = TEXT("$flag-default-enabled");

/** Value from environment-level disabledValue */
static const TCHAR *EnvDefaultDisabled = TEXT("$env-default-disabled");

/** Value from flag-level (global) disabledValue */
static const TCHAR *FlagDefaultDisabled = TEXT("$flag-default-disabled");
} // namespace GatrixVariantSource
