#define AppVersion GetEnv("CODEX_FIREFOX_BRIDGE_VERSION")
#define BridgeBinary GetEnv("CODEX_FIREFOX_BRIDGE_BINARY")

[Setup]
AppId={{E862CE25-32C2-4F35-9475-84611ACCCB70}
AppName=Codex Firefox Bridge
AppVersion={#AppVersion}
DefaultDirName={localappdata}\Codex Firefox Bridge
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
DisableProgramGroupPage=yes
OutputBaseFilename=codex-firefox-bridge-{#AppVersion}-windows-x64-setup
Compression=lzma2
SolidCompression=yes
UninstallDisplayName=Codex Firefox Bridge

[Files]
Source: "{#BridgeBinary}"; DestDir: "{app}"; DestName: "codex-firefox-bridge.exe"; Flags: ignoreversion

[Registry]
Root: HKCU; Subkey: "Software\Mozilla\NativeMessagingHosts\com.openai.codexextension"; ValueType: string; ValueName: ""; ValueData: "{app}\com.openai.codexextension.json"; Flags: uninsdeletekey

[Code]
function JsonEscapePath(Value: String): String;
begin
  Result := Value;
  StringChangeEx(Result, '\', '\\', True);
end;

procedure WriteNativeHostManifest;
var
  Manifest: String;
begin
  Manifest :=
    '{' + #13#10 +
    '  "name": "com.openai.codexextension",' + #13#10 +
    '  "description": "Codex Firefox native-messaging bridge",' + #13#10 +
    '  "path": "' + JsonEscapePath(ExpandConstant('{app}\codex-firefox-bridge.exe')) + '",' + #13#10 +
    '  "type": "stdio",' + #13#10 +
    '  "allowed_extensions": ["codex-computer-use-firefox-zen@sunkenintime"]' + #13#10 +
    '}' + #13#10;
  SaveStringToFile(ExpandConstant('{app}\com.openai.codexextension.json'), Manifest, False);
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
    WriteNativeHostManifest;
end;
