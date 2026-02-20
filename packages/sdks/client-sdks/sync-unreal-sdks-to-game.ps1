# sync-unreal-sdks-to-game.ps1
# Syncs Gatrix Unreal SDK plugins from this repository to the game project's
# Plugins folder. Clears each target directory before copying.
#
# Source: <repo>/packages/sdks/client-sdks/gatrix-unreal-*
# Target: <repo>/../../../game/Unreal/Plugins/gatrix-unreal-*

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

$SourceBase = $ScriptDir
$TargetBase = Join-Path $ScriptDir "..\..\..\..\game\Unreal\Plugins"

$Plugins = @(
    "gatrix-unreal-sdk",
    "gatrix-unreal-lua-sdk"
)

foreach ($Plugin in $Plugins) {
    $Source = Join-Path $SourceBase $Plugin
    $Target = Join-Path $TargetBase $Plugin

    if (-not (Test-Path $Source)) {
        Write-Warning "Source not found, skipping: $Source"
        continue
    }

    # Clear target directory if it exists
    if (Test-Path $Target) {
        Write-Host "Clearing: $Target" -ForegroundColor Yellow
        Remove-Item -Path $Target -Recurse -Force
    }

    # Copy source to target
    Write-Host "Copying: $Plugin" -ForegroundColor Cyan
    Copy-Item -Path $Source -Destination $Target -Recurse -Force

    Write-Host "Done: $Plugin" -ForegroundColor Green
}

Write-Host ""
Write-Host "All Unreal SDK plugins synced to game project." -ForegroundColor Green
