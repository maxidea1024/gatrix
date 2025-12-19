<#
.SYNOPSIS
    List images/tags in Docker Registry (Tencent Cloud CR)

.DESCRIPTION
    Queries the registry API to list all available tags for Gatrix services.
    Outputs full image URLs that can be used directly in docker-compose.yml.
#>

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$EnvFile = Join-Path $ScriptDir "registry.env"

# Load Config
if (Test-Path $EnvFile) {
    Get-Content $EnvFile | Where-Object { $_ -match "=" } | ForEach-Object {
        $parts = $_ -split "=", 2
        $key = $parts[0].Trim()
        $val = $parts[1].Trim()
        Set-Variable -Name $key -Value $val -Scope Script
    }
}
else {
    Write-Host "[ERROR] registry.env not found." -ForegroundColor Red
    exit 1
}

# Services to check
$Services = @("backend", "frontend", "edge", "chat-server", "event-lens")

Write-Host "Fetching image tags from $REGISTRY_HOST..." -ForegroundColor Cyan
Write-Host ""

# Get Bearer token for a specific repo
function Get-BearerToken($repo) {
    try {
        $ChallengeResponse = Invoke-WebRequest -Uri "https://$REGISTRY_HOST/v2/" -Method Get -ErrorAction SilentlyContinue
    }
    catch {
        $ChallengeResponse = $_.Exception.Response
    }

    $AuthHeader = $ChallengeResponse.Headers["Www-Authenticate"]
    if (-not $AuthHeader) { return $null }

    if ($AuthHeader -match 'Bearer realm="([^"]+)",service="([^"]+)"') {
        $Realm = "$($matches[1].Trim())"
        $Service = "$($matches[2].Trim())"
        $Scope = "repository:$repo`:pull"

        $EncodedService = [System.Net.WebUtility]::UrlEncode($Service)
        $EncodedScope = [System.Net.WebUtility]::UrlEncode($Scope)
        $TokenUrl = "{0}?service={1}&scope={2}" -f $Realm, $EncodedService, $EncodedScope
        $BasicAuth = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${REGISTRY_USER}:${REGISTRY_PASS}"))

        try {
            $TokenResponse = Invoke-RestMethod -Uri $TokenUrl -Headers @{ "Authorization" = "Basic $BasicAuth" }
            $BearerToken = $TokenResponse.token
            if (-not $BearerToken) { $BearerToken = $TokenResponse.access_token }
            return $BearerToken
        }
        catch {
            return $null
        }
    }
    return $null
}

foreach ($svc in $Services) {
    $repo = "$REGISTRY_NAMESPACE/gatrix-$svc"
    $url = "https://$REGISTRY_HOST/v2/$repo/tags/list"

    Write-Host "[$svc]" -ForegroundColor Yellow

    $token = Get-BearerToken $repo
    if (-not $token) {
        Write-Host "  (auth failed)" -ForegroundColor Red
        continue
    }

    try {
        $response = Invoke-RestMethod -Uri $url -Headers @{ "Authorization" = "Bearer $token" } -Method Get
        if ($response.tags -and $response.tags.Count -gt 0) {
            $sortedTags = $response.tags | Sort-Object -Descending
            foreach ($tag in $sortedTags) {
                $fullUrl = "$REGISTRY_HOST/$REGISTRY_NAMESPACE/gatrix-$svc`:$tag"
                Write-Host "  $fullUrl" -ForegroundColor Green
            }
        }
        else {
            Write-Host "  (no tags)" -ForegroundColor Gray
        }
    }
    catch {
        # Check for NAME_UNKNOWN
        $errBody = ""
        if ($_.Exception.Response) {
            try {
                $stream = $_.Exception.Response.GetResponseStream()
                $reader = New-Object System.IO.StreamReader($stream)
                $errBody = $reader.ReadToEnd()
            }
            catch {}
        }
        if ($errBody -match "NAME_UNKNOWN") {
            Write-Host "  (not found)" -ForegroundColor Gray
        }
        else {
            Write-Host "  (error)" -ForegroundColor Red
        }
    }
    Write-Host ""
}

Write-Host "Done." -ForegroundColor Cyan
