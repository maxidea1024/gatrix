// Copyright Gatrix. All Rights Reserved.
// Shared image scaling configuration for Gatrix widgets.

#pragma once

#include "CoreMinimal.h"
#include "GatrixImageScaleMode.generated.h"

/**
 * How the image should be scaled relative to the widget bounds.
 */
UENUM(BlueprintType)
enum class EGatrixImageScaleMode : uint8 {
  /** Stretch to fill the entire widget area (ignores aspect ratio) */
  Stretch UMETA(DisplayName = "Stretch"),

  /** Scale to fit inside the widget while preserving aspect ratio (may leave empty space) */
  Fit UMETA(DisplayName = "Fit"),

  /** Scale to fill the widget while preserving aspect ratio (may crop edges) */
  Fill UMETA(DisplayName = "Fill"),

  /** Resize the widget to exactly match the image dimensions */
  MatchImage UMETA(DisplayName = "Match Image"),
};

/**
 * How to handle the empty space when the image doesn't fill the widget.
 * Only relevant when ScaleMode is Fit.
 */
UENUM(BlueprintType)
enum class EGatrixImageBackground : uint8 {
  /** Leave empty space transparent */
  Transparent UMETA(DisplayName = "Transparent"),

  /** Fill empty space with a solid color */
  SolidColor UMETA(DisplayName = "Solid Color"),
};
