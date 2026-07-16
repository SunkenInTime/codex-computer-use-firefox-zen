[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$source = Join-Path $root 'native-host\NativeHostProxy.cs'
$outputDirectory = Join-Path $root 'native-host\bin'
$output = Join-Path $outputDirectory 'chatgpt-firefox-native-host.exe'
$pathFile = Join-Path $outputDirectory 'native-host-proxy.path'
$manifestPath = Join-Path $outputDirectory 'com.openai.codexextension.json'
$chromeRegistryPath = 'Registry::HKEY_CURRENT_USER\Software\Google\Chrome\NativeMessagingHosts\com.openai.codexextension'
$firefoxRegistryPath = 'HKCU:\Software\Mozilla\NativeMessagingHosts\com.openai.codexextension'

$chromeManifestPath = (Get-ItemProperty -LiteralPath $chromeRegistryPath).'(default)'
if ([string]::IsNullOrWhiteSpace($chromeManifestPath) -or -not (Test-Path -LiteralPath $chromeManifestPath)) {
  throw 'The installed OpenAI Chrome native-host manifest could not be found.'
}

$chromeManifest = Get-Content -LiteralPath $chromeManifestPath -Raw | ConvertFrom-Json
$originalHost = [string]$chromeManifest.path
if (-not (Test-Path -LiteralPath $originalHost -PathType Leaf)) {
  throw "The OpenAI extension host does not exist at '$originalHost'."
}

New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
$compiler = "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if (-not (Test-Path -LiteralPath $compiler)) {
  $compiler = "$env:WINDIR\Microsoft.NET\Framework\v4.0.30319\csc.exe"
}
if (-not (Test-Path -LiteralPath $compiler)) {
  throw 'The .NET Framework C# compiler was not found.'
}

& $compiler /nologo /target:exe /optimize+ "/out:$output" /reference:System.Web.Extensions.dll $source
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $output)) {
  throw 'The Firefox native-host adapter failed to compile.'
}

$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
[IO.File]::WriteAllText($pathFile, $originalHost + [Environment]::NewLine, $utf8NoBom)
$firefoxManifest = [ordered]@{
  name = 'com.openai.codexextension'
  description = 'Codex computer use Firefox native-messaging adapter'
  path = $output
  type = 'stdio'
  allowed_extensions = @('codex-computer-use-firefox-zen@sunkenintime')
}
$firefoxManifestJson = $firefoxManifest | ConvertTo-Json -Depth 5
[IO.File]::WriteAllText($manifestPath, $firefoxManifestJson + [Environment]::NewLine, $utf8NoBom)

New-Item -Path $firefoxRegistryPath -Force | Out-Null
Set-Item -LiteralPath $firefoxRegistryPath -Value $manifestPath

[pscustomobject]@{
  Adapter = $output
  OriginalHost = $originalHost
  FirefoxManifest = $manifestPath
  ExtensionId = 'codex-computer-use-firefox-zen@sunkenintime'
}
