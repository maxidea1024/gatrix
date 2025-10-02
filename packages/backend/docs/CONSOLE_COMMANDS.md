# System Console Commands

The Gatrix system console provides a powerful set of commands for system administration, debugging, and utility operations.

## Table of Contents

- [Basic Commands](#basic-commands)
- [Date & Time](#date--time)
- [ID Generation](#id-generation)
- [Security & Cryptography](#security--cryptography)
- [API Token Management](#api-token-management)
- [Database Operations](#database-operations)
- [Cache Management](#cache-management)
- [User Management](#user-management)
- [System Information](#system-information)
- [Utilities](#utilities)
- [Special Features](#special-features)

---

## Basic Commands

### help
Show all available commands with descriptions.

```bash
help
```

### echo
Echo back arguments with optional color formatting.

```bash
echo Hello World
echo --red Error message
echo --green Success!
echo --yellow Warning
echo --blue Information
```

**Options:**
- `--red`, `--green`, `--yellow`, `--blue`, `--magenta`, `--cyan`, `--white`

### clear
Clear the console screen.

```bash
clear
```

---

## ID Generation

### uuid
Generate a random UUID v4.

```bash
uuid
```

**Example output:**
```
550e8400-e29b-41d4-a716-446655440000
```

### ulid
Generate a ULID (Universally Unique Lexicographically Sortable Identifier).

```bash
ulid          # Generate 1 ULID
ulid 5        # Generate 5 ULIDs
```

**Features:**
- Lexicographically sortable
- 26 characters (vs UUID's 36)
- Timestamp-based prefix
- Case-insensitive

**Example output:**
```
01HQZX3Y4K9M2N5P6Q7R8S9T0V
```

---

## Security & Cryptography

### jwt-secret
Generate a secure JWT secret key.

```bash
jwt-secret                # Default: 64 bytes
jwt-secret --length 128   # Custom length
```

**Example output:**
```
JWT Secret Generated:

xK9mP2nQ5rS8tU1vW4yZ7aC0dE3fG6hJ9kL2mN5pQ8rS1tU4vW7yZ0aC3dE6fG9h

Add this to your .env file:
JWT_SECRET=xK9mP2nQ5rS8tU1vW4yZ7aC0dE3fG6hJ9kL2mN5pQ8rS1tU4vW7yZ0aC3dE6fG9h
```

### hash
Hash text using bcrypt (for password hashing).

```bash
hash mypassword123
hash --rounds 14 mypassword123
```

**Options:**
- `--rounds <number>` - Salt rounds (4-20, default: 12)

**Example output:**
```
Bcrypt Hash:

$2a$12$KIXxKj8N9mP2nQ5rS8tU1eO3fG6hJ9kL2mN5pQ8rS1tU4vW7yZ0aC

Rounds: 12
```

### encrypt
Encrypt text using AES-256-GCM.

```bash
encrypt "Secret message"
encrypt --key 0123456789abcdef... "Secret message"
```

**Options:**
- `--key <hex>` - 64-character hex key (if not provided, generates new key)

**Example output:**
```
Encrypted:

Encrypted: a1b2c3d4e5f6...
IV: 1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d
Auth Tag: 9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c
Key: 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

To decrypt, use:
decrypt --key 0123456789abcdef... a1b2c3d4e5f6...:1a2b3c4d...:9f8e7d6c...
```

### decrypt
Decrypt text using AES-256-GCM.

```bash
decrypt --key <hex-key> <encrypted>:<iv>:<authTag>
```

**Required:**
- `--key <hex>` - 64-character hex encryption key

**Example:**
```bash
decrypt --key 0123456789abcdef... a1b2c3d4:1a2b3c4d:9f8e7d6c
```

### random
Generate random strings in various formats.

```bash
random                      # 32 bytes hex (default)
random --length 64          # 64 bytes hex
random --base64             # Base64 encoded
random --alphanumeric       # Alphanumeric only
```

**Options:**
- `--length <number>` - Length in bytes (1-256, default: 32)
- `--hex` - Output as hexadecimal (default)
- `--base64` - Output as base64
- `--alphanumeric` - Output as alphanumeric characters

---

## API Token Management

### api-key
Generate API access tokens for client or server applications.

```bash
api-key --name "My App" --type client
api-key --name "Backend Service" --type server --description "Production API" --expires 365
```

**Required Options:**
- `--name <string>` - Token name
- `--type <client|server>` - Token type

**Optional Options:**
- `--description <string>` - Token description
- `--expires <days>` - Expiration in days (omit for no expiration)

**Example output:**
```
API Token Created:

ID: 123
Name: My App
Type: client
Token: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
Description: Production API
Expires: 2025-10-02T12:00:00.000Z

⚠️  Save this token securely. It cannot be retrieved again!

Usage:
Authorization: Bearer a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
or
X-API-Token: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2
```

**Token Types:**
- `client` - For client applications (mobile apps, web apps)
- `server` - For server-to-server communication

---

## Database Operations

### db-stats
Show database table statistics.

```bash
db-stats
```

**Example output:**
```
Database Statistics:

  g_users                        1,234
  g_api_access_tokens              56
  g_message_templates              12
  g_tags                           45
  g_tag_assignments               234
  g_jobs                           89
  g_client_versions                23
  g_game_worlds                     8

Total tables: 8
```

---

## System Information

### whoami
Display current user information.

```bash
whoami
```

**Example output:**
```
ID: 1
Name: Admin User
Email: admin@gatrix.com
Role: admin
```

### date
Print server date with various formats.

```bash
date                           # Default format
date --iso                     # ISO 8601 format
date --rfc                     # RFC format
date +"%Y-%m-%d %H:%M:%S"     # Custom format
```

**Format tokens:**
- `%Y` - Year (4 digits)
- `%m` - Month (01-12)
- `%d` - Day (01-31)
- `%H` - Hour (00-23)
- `%M` - Minute (00-59)
- `%S` - Second (00-59)
- `%Z` - Timezone name
- `%z` - Timezone offset
- `%T` - Time (HH:MM:SS)

### time
Print server time.

```bash
time                    # Default format (HH:MM:SS)
time +"%H:%M"          # Custom format
```

### timezone
Print server timezone information.

```bash
timezone
```

**Example output:**
```
Time zone: Asia/Seoul (KST, +09:00)
```

### uptime
Show server uptime.

```bash
uptime
```

**Example output:**
```
up 5 days, 12:34, 56s
```

### sysinfo
Show Node.js and system information.

```bash
sysinfo
```

**Example output:**
```
Node: v20.10.0
Platform: win32
Arch: x64
PID: 12345
Memory: rss=150MB heapUsed=80MB heapTotal=120MB
Uptime: 432000s
```

### env
Show whitelisted environment variables.

```bash
env
```

**Example output:**
```
NODE_ENV=production
PORT=3000
API_VERSION=v1
```

### health
Server health check.

```bash
health
```

**Example output:**
```
✓ Server is healthy
```

### base64
Encode or decode base64 text.

```bash
base64 --encode "Hello World"
base64 --decode SGVsbG8gV29ybGQ=
```

**Options:**
- `--encode` - Encode text to base64
- `--decode` - Decode base64 to text

---

## Usage Tips

1. **Command History**: Use arrow keys to navigate command history
2. **Tab Completion**: Some terminals support tab completion
3. **Copy Output**: Select and copy command output directly
4. **Secure Tokens**: Always store generated tokens securely
5. **Encryption Keys**: Keep encryption keys in secure environment variables

## Security Notes

- All cryptographic operations use industry-standard algorithms
- API tokens are stored as plain text in the database (ensure database security)
- Encryption uses AES-256-GCM (authenticated encryption)
- Password hashing uses bcrypt with configurable rounds
- JWT secrets should be at least 64 bytes for production use

## Examples

### Generate a complete API setup

```bash
# 1. Generate JWT secret
jwt-secret --length 64

# 2. Create client API token
api-key --name "Mobile App" --type client --expires 365

# 3. Create server API token
api-key --name "Backend Service" --type server

# 4. Check database stats
db-stats
```

### Encrypt sensitive data

```bash
# 1. Encrypt data (generates new key)
encrypt "Sensitive information"

# 2. Save the key securely
# 3. Use decrypt with the same key
decrypt --key <your-key> <encrypted>:<iv>:<authTag>
```

### Generate various IDs

```bash
# UUID for general use
uuid

# ULID for sortable IDs
ulid 10

# Random tokens
random --length 32 --hex
random --alphanumeric
```

---

## Cache Management

### cache-clear
Clear Redis cache by pattern.

```bash
# Clear all cache
cache-clear

# Clear specific pattern
cache-clear --pattern "user:*"
```

**Options:**
- `--pattern` - Cache key pattern (default: all)

**Note:** Requires Redis client integration.

### cache-stats
Show Redis cache statistics.

```bash
cache-stats
```

**Note:** Requires Redis client integration.

---

## User Management

### user-info
Get detailed user information by ID or email.

```bash
# By user ID
user-info 123

# By email
user-info user@example.com
```

**Output:**
- User ID
- Name
- Email
- Role
- Status
- Email verification status
- Created date
- Last login date

---

## Utilities

### timestamp
Convert timestamp or get current timestamp.

```bash
# Get current timestamp (all formats)
timestamp

# Get current timestamp in milliseconds
timestamp --ms

# Get current timestamp in ISO format
timestamp --iso

# Convert Unix timestamp (seconds)
timestamp 1609459200

# Convert Unix timestamp (milliseconds)
timestamp 1609459200000

# Convert ISO date
timestamp "2021-01-01T00:00:00Z"
```

**Options:**
- `--ms` - Output in milliseconds
- `--iso` - Output in ISO format

### md5
Generate MD5 hash of text.

```bash
md5 Hello World
```

**Output:** Hexadecimal MD5 hash

### sha256
Generate SHA256 hash of text.

```bash
sha256 Hello World
```

**Output:** Hexadecimal SHA256 hash

### token-list
List API tokens with filtering options.

```bash
# List all tokens (default: 10)
token-list

# List only client tokens
token-list --type client

# List only server tokens
token-list --type server

# Limit results
token-list --limit 20
```

**Options:**
- `--type` - Filter by type (client|server)
- `--limit` - Limit results (default: 10)

**Output:**
- Token ID
- Name
- Type
- Created by
- Expiration date

---

## Special Features

### Clipboard Copy
Copy command output to clipboard by appending `|clip` to any command.

```bash
# Copy UUID to clipboard
uuid |clip

# Copy encrypted data to clipboard
encrypt "secret" |clip

# Copy user info to clipboard
user-info 123 |clip

# Copy database stats to clipboard
db-stats |clip
```

**Note:** ANSI color codes are automatically removed when copying to clipboard.

### Korean/CJK Input Support
The console supports Korean, Chinese, and Japanese input through IME (Input Method Editor) composition.

**Features:**
- Full IME composition support
- Proper character rendering with CJK-friendly fonts
- No character breaking during composition

### Text Selection
Use Shift+Arrow keys to select text in the console.

**Keyboard Shortcuts:**
- `Shift+Left/Right` - Select text character by character
- `Shift+Up/Down` - Select text line by line
- `Ctrl/Cmd+C` - Copy selected text
- `Ctrl/Cmd+V` - Paste text
- `Ctrl/Cmd+X` - Cut selected text (copy only)

