[CmdletBinding(SupportsShouldProcess)]
param()

$registryPath = 'HKCU:\Software\Mozilla\NativeMessagingHosts\com.openai.codexextension'
if (Test-Path -LiteralPath $registryPath) {
  if ($PSCmdlet.ShouldProcess($registryPath, 'Remove the ChatGPT Firefox native-host registration')) {
    Remove-Item -LiteralPath $registryPath -Force
  }
}
