$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$packagePath = Join-Path $projectRoot 'package.json'
$releaseDirectory = Join-Path $projectRoot 'release'
$stagingDirectory = $null

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
    Invoke-ProjectCommand -Name 'Build dla Chrome / Edge i Opery' -Command { pnpm build }

    $buildTargets = @(
        @{
            Name = 'Chrome / Edge'
            BuildDirectory = Join-Path $projectRoot '.output\chrome-mv3'
            ArchiveName = "dopakuj-extension-chrome-edge-v$version.zip"
            ExtensionDirectoryName = 'DopakujExtension-ChromeEdge'
        },
        @{
            Name = 'Opera'
            BuildDirectory = Join-Path $projectRoot '.output\opera-mv3'
            ArchiveName = "dopakuj-extension-opera-v$version.zip"
            ExtensionDirectoryName = 'DopakujExtension-Opera'
        }
    )

    foreach ($target in $buildTargets) {
        if (-not (Test-Path -LiteralPath (Join-Path $target.BuildDirectory 'manifest.json'))) {
            throw "Build dla $($target.Name) nie zawiera pliku manifest.json: $($target.BuildDirectory)"
        }
    }

    New-Item -ItemType Directory -Path $releaseDirectory -Force | Out-Null
    $stagingDirectory = Join-Path $releaseDirectory ".staging-$version"

    if (Test-Path -LiteralPath $stagingDirectory) {
        Remove-Item -LiteralPath $stagingDirectory -Recurse -Force
    }

    foreach ($target in $buildTargets) {
        $archivePath = Join-Path $releaseDirectory $target.ArchiveName
        $extensionDirectory = Join-Path $stagingDirectory $target.ExtensionDirectoryName

        if (Test-Path -LiteralPath $archivePath) {
            Remove-Item -LiteralPath $archivePath -Force
        }

        Write-Host ''
        Write-Host "==> Pakowanie ZIP dla $($target.Name)" -ForegroundColor Cyan
        New-Item -ItemType Directory -Path $extensionDirectory -Force | Out-Null
        Copy-Item -Path (Join-Path $target.BuildDirectory '*') -Destination $extensionDirectory -Recurse -Force
        Compress-Archive -Path $extensionDirectory -DestinationPath $archivePath -CompressionLevel Optimal
    }

    Write-Host ''
    Write-Host 'Gotowe:' -ForegroundColor Green
    foreach ($target in $buildTargets) {
        Write-Host (Join-Path $releaseDirectory $target.ArchiveName)
    }
    Write-Host ''
    Write-Host 'Te pliki dodaj do Assets w GitHub Release.'
}
finally {
    if ($stagingDirectory -and (Test-Path -LiteralPath $stagingDirectory)) {
        Remove-Item -LiteralPath $stagingDirectory -Recurse -Force
    }
    Pop-Location
}
