# Flutter Installation Helper Script for Windows

$installationPath = "C:\work\flutter"
$downloadUrl = "https://storage.googleapis.com/flutter_infra_release/releases/stable/windows/flutter_windows_3.16.9-stable.zip" # Example stable version

Write-Host "Checking if Git is installed..."
if (!(Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Error "Git is required for Flutter. Please install Git first."
    exit
}

if (Test-Path $installationPath) {
    Write-Host "Flutter already exists at $installationPath. Updating instead..."
    Set-Location $installationPath
    git pull
}
else {
    Write-Host "Cloning Flutter SDK to $installationPath..."
    git clone https://github.com/flutter/flutter.git -b stable $installationPath
}

Write-Host "Adding Flutter to User PATH..."
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$installationPath\bin*") {
    [Environment]::SetEnvironmentVariable("Path", "$userPath;$installationPath\bin", "User")
    $env:Path += ";$installationPath\bin"
}

Write-Host "Running Flutter Doctor..."
flutter doctor

Write-Host "=========================================================="
Write-Host "Flutter installation complete!"
Write-Host "Please RESTART your terminal/IDE to recognize 'flutter' command."
Write-Host "=========================================================="
