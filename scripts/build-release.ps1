$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$packagePath = Join-Path $projectRoot 'package.json'
$buildDirectory = Join-Path $projectRoot '.output\chrome-mv3'
$releaseDirectory = Join-Path $projectRoot 'release'

function Invoke-ProjectCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,

        [Parameter(Mandatory = $true)]
        [scriptblock]$Command
    )

    Write-Host ''
    Write-Host "==> $Name" -ForegroundColor Cyan
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "Krok '$Name' zakonczyl sie bledem (kod $LASTEXITCODE)."
    }
}

Push-Location $projectRoot
try {
    $package = Get-Content -LiteralPath $packagePath -Raw | ConvertFrom-Json
    $version = [string]$package.version
    if ($version -notmatch '^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$') {
        throw "Nieprawidlowa wersja w package.json: '$version'."
    }

    Invoke-ProjectCommand -Name 'Testy' -Command { pnpm test }
    Invoke-ProjectCommand -Name 'Sprawdzanie typow' -Command { pnpm typecheck }
    Invoke-ProjectCommand -Name 'Build rozszerzenia' -Command { pnpm build }

    if (-not (Test-Path -LiteralPath (Join-Path $buildDirectory 'manifest.json'))) {
        throw "Build nie zawiera pliku manifest.json: $buildDirectory"
    }

    New-Item -ItemType Directory -Path $releaseDirectory -Force | Out-Null
    $archiveName = "dopakuj-extension-$version.zip"
    $archivePath = Join-Path $releaseDirectory $archiveName

    if (Test-Path -LiteralPath $archivePath) {
        Remove-Item -LiteralPath $archivePath -Force
    }

    Write-Host ''
    Write-Host '==> Pakowanie ZIP' -ForegroundColor Cyan
    Compress-Archive -Path (Join-Path $buildDirectory '*') -DestinationPath $archivePath -CompressionLevel Optimal

    Write-Host ''
    Write-Host 'Gotowe:' -ForegroundColor Green
    Write-Host $archivePath
    Write-Host ''
    Write-Host 'Ten plik dodaj do Assets w GitHub Release.'
}
finally {
    Pop-Location
}
