(() => {
  "use strict";

  const version = browser.runtime.getManifest().version;
  const releaseBase =
    `https://github.com/SunkenInTime/codex-computer-use-firefox-zen/releases/download/v${version}`;
  const windows = document.querySelector("#windows-download");
  const macos = document.querySelector("#macos-download");
  const linux = document.querySelector("#linux-download");
  const npmCommand = document.querySelector("#npm-command");
  const copyNpmCommand = document.querySelector("#copy-npm-command");
  const doctorCommand = document.querySelector("#doctor-command");
  const copyDoctorCommand = document.querySelector("#copy-doctor-command");
  const parameters = new URLSearchParams(location.search);
  const mismatch = parameters.get("reason") === "version-mismatch";
  const command = `npx --yes codex-firefox-bridge@${version} install`;
  const doctor = `npx --yes codex-firefox-bridge@${version} doctor`;

  if (mismatch) {
    const bridgeVersion = parameters.get("bridgeVersion") ?? "unknown";
    const extensionVersion = parameters.get("extensionVersion") ?? version;
    const extensionIsOlder = bridgeVersion !== "unknown" &&
      compareVersions(extensionVersion, bridgeVersion) < 0;
    document.querySelector("#eyebrow").textContent = "Version mismatch";
    document.querySelector("#page-title").textContent = "Bring both pieces back in sync";
    document.querySelector("#page-lede").textContent = extensionIsOlder
      ? "The native bridge is newer than this Firefox extension. Update the signed extension, or reinstall the matching bridge version below."
      : "The Firefox extension is newer than its native bridge. Update the bridge before using Codex computer use.";
    document.querySelector("#extension-version").textContent = `v${extensionVersion}`;
    document.querySelector("#bridge-version").textContent = bridgeVersion === "unknown"
      ? "Older version"
      : `v${bridgeVersion}`;
    document.querySelector("#version-status").hidden = false;
    document.querySelector("#extension-update-section").hidden = !extensionIsOlder;
    document.querySelector("#connection-explanation").hidden = true;
    document.querySelector("#chrome-prerequisite").hidden = true;
    document.querySelector("#setup-step-one").textContent = extensionIsOlder
      ? "Install the latest signed extension, or choose a matching bridge installer below."
      : "Choose a platform installer or run the exact npm command above.";
    document.querySelector("#setup-step-three").textContent =
      "Restart Firefox or Zen Browser, then reopen the Codex sidebar.";
  }

  windows.href =
    `${releaseBase}/codex-firefox-bridge-${version}-windows-x64-setup.exe`;
  macos.href =
    `${releaseBase}/codex-firefox-bridge-${version}-macos-universal.pkg`;
  linux.href =
    `${releaseBase}/codex-firefox-bridge-${version}-linux-x64`;
  npmCommand.textContent = command;
  doctorCommand.textContent = doctor;
  configureCopyButton(copyNpmCommand, npmCommand, command);
  configureCopyButton(copyDoctorCommand, doctorCommand, doctor);

  browser.runtime.getPlatformInfo().then(({ os }) => {
    if (os === "win") {
      windows.classList.add("recommended");
    } else if (os === "mac") {
      macos.classList.add("recommended");
    } else if (os === "linux") {
      linux.classList.add("recommended");
    }
  }).catch(() => {});

  function configureCopyButton(button, code, text) {
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(text);
        button.textContent = "Copied";
        setTimeout(() => {
          button.textContent = "Copy";
        }, 1600);
      } catch {
        window.getSelection()?.selectAllChildren(code);
        button.textContent = "Selected";
      }
    });
  }

  function compareVersions(left, right) {
    const leftParts = left.split(".").map(Number);
    const rightParts = right.split(".").map(Number);
    if ([...leftParts, ...rightParts].some((part) => !Number.isSafeInteger(part))) {
      return 0;
    }
    for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
      const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
      if (difference !== 0) {
        return difference;
      }
    }
    return 0;
  }
})();
