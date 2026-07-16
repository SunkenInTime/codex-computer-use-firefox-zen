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
Compress-Archive -Path (Join-Path $extensionDirectory '*') -DestinationPath $archive -CompressionLevel Optimal
$hash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
"$hash  $([IO.Path]::GetFileName($archive))" | Set-Content -LiteralPath $checksumFile -Encoding ascii

& git -C $root archive --format=zip "--output=$sourceArchive" HEAD
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $sourceArchive)) {
  throw 'The review-source archive could not be generated from the current commit.'
}
$sourceHash = (Get-FileHash -LiteralPath $sourceArchive -Algorithm SHA256).Hash.ToLowerInvariant()
"$sourceHash  $([IO.Path]::GetFileName($sourceArchive))" | Set-Content -LiteralPath $sourceChecksumFile -Encoding ascii

Get-Item -LiteralPath $archive, $checksumFile, $sourceArchive, $sourceChecksumFile | Select-Object FullName, Length, LastWriteTime
