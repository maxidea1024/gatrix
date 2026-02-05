---
sidebar_position: 2
sidebar_label: Segments
---

# Segments

Target feature flags to specific user groups.

## Overview

Segments allow you to define user groups based on context properties.

## Creating a Segment

1. Navigate to **Feature Flags** > **Segments**
2. Click **Create Segment**
3. Define rules

## Rule Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `equals` | Exact match | `country equals "KR"` |
| `notEquals` | Does not match | `status notEquals "banned"` |
| `contains` | Contains substring | `email contains "@company.com"` |
| `startsWith` | Starts with | `userId startsWith "test_"` |
| `endsWith` | Ends with | `email endsWith ".kr"` |
| `greaterThan` | Greater than | `level greaterThan 10` |
| `lessThan` | Less than | `age lessThan 18` |
| `in` | In list | `country in ["KR", "JP"]` |

## Example: Beta Testers

```json
{
  "name": "Beta Testers",
  "rules": [
    { "field": "userType", "operator": "equals", "value": "beta" }
  ]
}
```

## Applying to Feature Flags

1. Edit a feature flag
2. Add an override rule
3. Select a segment
4. Set the value for that segment

Segments are evaluated in priority order.
