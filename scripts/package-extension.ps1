[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$extensionDirectory = Join-Path $root 'extension'
$distDirectory = Join-Path $root 'dist'
$manifest = Get-Content -LiteralPath (Join-Path $extensionDirectory 'manifest.json') -Raw | ConvertFrom-Json
$archive = Join-Path $distDirectory "codex-computer-use-firefox-zen-$($manifest.version).zip"
$checksumFile = Join-Path $distDirectory "codex-computer-use-firefox-zen-$($manifest.version).sha256"
$sourceArchive = Join-Path $distDirectory "codex-computer-use-firefox-zen-$($manifest.version)-source.zip"
$sourceChecksumFile = Join-Path $distDirectory "codex-computer-use-firefox-zen-$($manifest.version)-source.sha256"

function Get-Sha256 {
  param([Parameter(Mandatory)][string]$Path)

  $stream = [IO.File]::OpenRead($Path)
  $algorithm = [Security.Cryptography.SHA256]::Create()
  try {
    return [BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace('-', '').ToLowerInvariant()
  }
  finally {
    $algorithm.Dispose()
    $stream.Dispose()
  }
}

& node (Join-Path $PSScriptRoot 'verify-extension.mjs')
if ($LASTEXITCODE -ne 0) {
  throw 'Extension verification failed; package was not created.'
}

New-Item -ItemType Directory -Path $distDirectory -Force | Out-Null
$resolvedDist = (Resolve-Path -LiteralPath $distDirectory).Path
$resolvedRoot = (Resolve-Path -LiteralPath $root).Path
if (-not $resolvedDist.StartsWith($resolvedRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
  throw 'Refusing to replace an archive outside the workspace.'
}
if (Test-Path -LiteralPath $archive) {
  Remove-Item -LiteralPath $archive -Force
}
if (Test-Path -LiteralPath $checksumFile) {
  Remove-Item -LiteralPath $checksumFile -Force
}
if (Test-Path -LiteralPath $sourceArchive) {
  Remove-Item -LiteralPath $sourceArchive -Force
}
if (Test-Path -LiteralPath $sourceChecksumFile) {
  Remove-Item -LiteralPath $sourceChecksumFile -Force
}
# Compress-Archive writes Windows path separators into ZIP entry names. Firefox
# tolerates those entries locally, but AMO rejects them during validation. Build
# the archive directly so every entry uses the ZIP-standard forward slash.
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$extensionPrefix = $extensionDirectory.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
$archiveStream = [IO.File]::Open($archive, [IO.FileMode]::CreateNew)
$zipArchive = [IO.Compression.ZipArchive]::new(
  $archiveStream,
  [IO.Compression.ZipArchiveMode]::Create,
  $false
)
try {
  Get-ChildItem -LiteralPath $extensionDirectory -Recurse -File |
    Sort-Object FullName |
    ForEach-Object {
      $entryName = $_.FullName.Substring($extensionPrefix.Length).Replace('\', '/')
      [IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
        $zipArchive,
        $_.FullName,
        $entryName,
        [IO.Compression.CompressionLevel]::Optimal
      ) | Out-Null
    }
}
finally {
  $zipArchive.Dispose()
  $archiveStream.Dispose()
}
$hash = Get-Sha256 -Path $archive
"$hash  $([IO.Path]::GetFileName($archive))" | Set-Content -LiteralPath $checksumFile -Encoding ascii

& git -C $root archive --format=zip "--output=$sourceArchive" HEAD
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $sourceArchive)) {
  throw 'The review-source archive could not be generated from the current commit.'
}
$sourceHash = Get-Sha256 -Path $sourceArchive
"$sourceHash  $([IO.Path]::GetFileName($sourceArchive))" | Set-Content -LiteralPath $sourceChecksumFile -Encoding ascii

Get-Item -LiteralPath $archive, $checksumFile, $sourceArchive, $sourceChecksumFile | Select-Object FullName, Length, LastWriteTime
