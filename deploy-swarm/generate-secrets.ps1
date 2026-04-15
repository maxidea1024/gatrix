#!/usr/bin/env pwsh
#
# Gatrix Secret Key Generator
# Generates cryptographically secure random keys for JWT, session, and API tokens.
#
# Usage:
#   ./generate-secrets.ps1 [options]
#
# Options:
#   -l, --length <n>          Key length in bytes (default: 32)
#   -e, --encoding <type>     Output encoding: base64, hex, alphanumeric (default: base64)
#   -c, --count <n>           Number of keys to generate (default: 1)
#   --env                     Generate all .env security keys at once
#   -h, --help                Show help

$ErrorActionPreference = "Stop"

$Length = 32
$Encoding = "base64"
$Count = 1
$GenEnv = $false

function Show-Help {
    Write-Host "Gatrix Secret Key Generator"
    Write-Host ""
    Write-Host "Usage: ./generate-secrets.ps1 [options]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -l, --length <n>          Key length in bytes (default: 32)"
    Write-Host "  -e, --encoding <type>     Encoding: base64, hex, alphanumeric (default: base64)"
    Write-Host "  -c, --count <n>           Number of keys to generate (default: 1)"
    Write-Host "  --env                     Generate all .env security keys at once"
    Write-Host "  -h, --help                Show help"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  ./generate-secrets.ps1                          # Single 32-byte base64 key"
    Write-Host "  ./generate-secrets.ps1 -l 64 -e hex             # 64-byte hex key"
    Write-Host "  ./generate-secrets.ps1 -c 5                     # 5 random keys"
    Write-Host "  ./generate-secrets.ps1 --env                    # Generate all .env secrets"
    Write-Host "  ./generate-secrets.ps1 -l 48 -e alphanumeric    # 48-char alphanumeric key"
    exit 0
}

$i = 0
while ($i -lt $args.Count) {
    switch ($args[$i]) {
        { $_ -eq "-l" -or $_ -eq "--length" } { $Length = [int]$args[$i + 1]; $i += 2 }
        { $_ -eq "-e" -or $_ -eq "--encoding" } { $Encoding = $args[$i + 1]; $i += 2 }
        { $_ -eq "-c" -or $_ -eq "--count" } { $Count = [int]$args[$i + 1]; $i += 2 }
        "--env" { $GenEnv = $true; $i += 1 }
        { $_ -eq "-h" -or $_ -eq "--help" } { Show-Help }
        default { Write-Host "Unknown option: $($args[$i])" -ForegroundColor Red; exit 1 }
    }
}

function Generate-Key {
    param([int]$KeyLength, [string]$KeyEncoding)

    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $bytes = New-Object byte[] $KeyLength
    $rng.GetBytes($bytes)

    switch ($KeyEncoding) {
        "base64" {
            return [Convert]::ToBase64String($bytes)
        }
        "hex" {
            return ($bytes | ForEach-Object { $_.ToString("x2") }) -join ''
        }
        "alphanumeric" {
            $chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
            $result = ""
            foreach ($b in $bytes) {
                $result += $chars[$b % $chars.Length]
            }
            return $result
        }
        default {
            Write-Host "Unknown encoding: $KeyEncoding (use base64, hex, or alphanumeric)" -ForegroundColor Red
            exit 1
        }
    }
}

if ($GenEnv) {
    Write-Host "========================================" -ForegroundColor Blue
    Write-Host "   Gatrix Secret Key Generator" -ForegroundColor Blue
    Write-Host "========================================" -ForegroundColor Blue
    Write-Host ""
    Write-Host "Copy these values to your .env file:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "# Security Secrets (auto-generated)"
    Write-Host "JWT_SECRET=$(Generate-Key -KeyLength 32 -KeyEncoding 'base64')"
    Write-Host "JWT_REFRESH_SECRET=$(Generate-Key -KeyLength 32 -KeyEncoding 'base64')"
    Write-Host "SESSION_SECRET=$(Generate-Key -KeyLength 32 -KeyEncoding 'base64')"
    Write-Host "GRAFANA_ADMIN_PASSWORD=$(Generate-Key -KeyLength 16 -KeyEncoding 'alphanumeric')"
    Write-Host ""
    Write-Host "[INFO] Keys generated using .NET System.Security.Cryptography" -ForegroundColor Green
}
else {
    for ($j = 1; $j -le $Count; $j++) {
        $key = Generate-Key -KeyLength $Length -KeyEncoding $Encoding
        if ($Count -gt 1) {
            Write-Host "[$j] $key"
        }
        else {
            Write-Host $key
        }
    }
}
