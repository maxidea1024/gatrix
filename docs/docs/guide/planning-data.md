---
sidebar_position: 7
sidebar_label: Planning Data
---

# Planning Data

## Overview

Manage game balance and configuration data (game planning data).

**Navigation:** Game Operations → Planning Data

## Features

- Store JSON configuration data
- Version control for configs
- Environment-specific values
- Instant updates without deployment

## Use Cases

- Game balance parameters
- Level requirements
- Item drop rates
- Event configurations
- Seasonal settings

## Creating Planning Data

1. Navigate to **Game Operations** > **Planning Data**
2. Click **Add Data** button
3. Configure:

| Field       | Type        | Required | Description        |
| ----------- | ----------- | -------- | ------------------ |
| Key         | Text        | Required | Unique data key    |
| Name        | Text        | Required | Display name       |
| Description | Textarea    | -        | Admin notes        |
| Data        | JSON Editor | Required | Configuration data |
| Environment | Select      | -        | Target environment |

4. Click **Create** to save

## Example

```json
{
  "key": "level_requirements",
  "data": {
    "levels": [
      { "level": 1, "exp": 0 },
      { "level": 2, "exp": 100 },
      { "level": 3, "exp": 300 },
      { "level": 4, "exp": 600 },
      { "level": 5, "exp": 1000 }
    ]
  }
}
```

## API Access

```bash
GET /api/v1/planning-data/:key
```
