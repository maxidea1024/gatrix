---
sidebar_position: 5
sidebar_label: Users
---

# User Management

## Overview

Manage admin users and their permissions.

**Navigation:** System Management → Users

## Features

- Create admin accounts
- Assign roles and permissions
- Enable/disable accounts
- View audit logs

## User Roles

| Role            | Description                    |
| --------------- | ------------------------------ |
| **Super Admin** | Full access to all features    |
| **Admin**       | Access to most features        |
| **Operator**    | Limited to operations features |
| **Viewer**      | Read-only access               |

## Creating a User

1. Navigate to **System Management** > **Users**
2. Click **Add User** button
3. Configure:

| Field    | Type     | Required | Description      |
| -------- | -------- | -------- | ---------------- |
| Email    | Email    | Required | Login email      |
| Name     | Text     | Required | Display name     |
| Password | Password | Required | Initial password |
| Role     | Select   | Required | User role        |
| Enabled  | Switch   | -        | Account status   |

4. Click **Create**

## Password Policy

- Minimum 8 characters
- At least one uppercase letter
- At least one number
- At least one special character

## Two-Factor Authentication

Users can enable 2FA in their profile settings for additional security.
