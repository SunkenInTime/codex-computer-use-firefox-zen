(() => {
  "use strict";

  const version = browser.runtime.getManifest().version;
  const releaseBase =
    `https://github.com/SunkenInTime/codex-computer-use-firefox-zen/releases/download/v${version}`;
  const windows = document.querySelector("#windows-download");
  const macos = document.querySelector("#macos-download");

  windows.href =
    `${releaseBase}/codex-firefox-bridge-${version}-windows-x64-setup.exe`;
  macos.href =
    `${releaseBase}/codex-firefox-bridge-${version}-macos-universal.pkg`;

  browser.runtime.getPlatformInfo().then(({ os }) => {
    if (os === "win") {
      windows.classList.add("recommended");
    } else if (os === "mac") {
      macos.classList.add("recommended");
    }
  }).catch(() => {});
})();
