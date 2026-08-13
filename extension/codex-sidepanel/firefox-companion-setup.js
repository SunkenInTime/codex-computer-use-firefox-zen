const NATIVE_TRANSPORT_ERRORS = Object.freeze([
  "Native host request codexRuntime/hello timed out",
  "Codex Chrome native host is incompatible",
  "Codex Chrome native host v2 manifest is missing",
  "No compatible Codex app-server entry was found",
  "No Codex app-server entry matches the required protocol version",
  "Native transport is disconnected; reconnect is pending",
  "Native transport disconnected",
]);

export function isFirefoxCompanionSetupError(text) {
  return typeof text === "string" &&
    NATIVE_TRANSPORT_ERRORS.some((message) => text.includes(message));
}

export function getFirefoxCompanionSetupDetails(version) {
  const releaseBase =
    `https://github.com/SunkenInTime/codex-computer-use-firefox-zen/releases/download/v${version}`;
  return {
    chromeSetupUrl: "https://learn.chatgpt.com/docs/chrome-extension#set-up-the-chrome-extension",
    command: `npx --yes codex-firefox-bridge@${version} install`,
    doctorCommand: `npx --yes codex-firefox-bridge@${version} doctor`,
    macosUrl: `${releaseBase}/codex-firefox-bridge-${version}-macos-universal.pkg`,
    windowsUrl: `${releaseBase}/codex-firefox-bridge-${version}-windows-x64-setup.exe`,
  };
}

function appendElement(document, parent, tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text != null) element.textContent = text;
  parent.append(element);
  return element;
}

// The same Codex blossom mark the upstream onboarding surface renders.
export const CODEX_LOGO_PATH = "codex-sidepanel/assets/app-D0g8sCle.png";

function appendCodexLogo(document, parent, extension) {
  const logo = appendElement(document, parent, "img", "firefox-companion-setup__logo");
  logo.src = extension.runtime.getURL(CODEX_LOGO_PATH);
  logo.alt = "";
  logo.draggable = false;
  logo.setAttribute("aria-hidden", "true");
}

function appendDownload(document, parent, { description, href, label, platform }) {
  const link = appendElement(document, parent, "a", "firefox-companion-setup__download");
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.dataset.platform = platform;
  const text = appendElement(document, link, "div", "firefox-companion-setup__download-text");
  appendElement(document, text, "strong", "", label);
  appendElement(document, text, "span", "", description);
  return link;
}

function appendStep(document, parent, title, detail) {
  const item = appendElement(document, parent, "li", "firefox-companion-setup__step");
  appendElement(document, item, "strong", "", title);
  appendElement(document, item, "span", "", detail);
}

function appendCopyCommand(document, parent, { command, statusText }) {
  const commandRow = appendElement(document, parent, "div", "firefox-companion-setup__command-row");
  const code = appendElement(document, commandRow, "code", "", command);
  const copyButton = appendElement(document, commandRow, "button", "firefox-companion-setup__copy", "Copy");
  copyButton.type = "button";
  const copyStatus = appendElement(document, parent, "span", "firefox-companion-setup__sr-only", "");
  copyStatus.setAttribute("role", "status");
  copyStatus.setAttribute("aria-live", "polite");
  copyButton.addEventListener("click", async () => {
    try {
      if (globalThis.navigator.clipboard?.writeText == null) throw new Error("Clipboard unavailable");
      await globalThis.navigator.clipboard.writeText(command);
      copyButton.textContent = "Copied";
      copyStatus.textContent = statusText;
      globalThis.setTimeout(() => {
        copyButton.textContent = "Copy";
      }, 1600);
    } catch {
      const range = document.createRange();
      range.selectNodeContents(code);
      document.getSelection()?.removeAllRanges();
      document.getSelection()?.addRange(range);
      copyButton.textContent = "Selected";
      copyStatus.textContent = `${statusText} selected`;
    }
  });
}

function appendConnectionNode(document, parent, title, detail) {
  const node = appendElement(document, parent, "div", "firefox-companion-setup__connection-node");
  node.setAttribute("role", "listitem");
  appendElement(document, node, "strong", "", title);
  appendElement(document, node, "span", "", detail);
}

function appendConnectionArrow(document, parent) {
  const arrow = appendElement(document, parent, "span", "firefox-companion-setup__connection-arrow", "→");
  arrow.setAttribute("aria-hidden", "true");
}

export function renderFirefoxCompanionSetup({
  extension,
  root,
  reload = () => globalThis.location.reload(),
}) {
  const document = root.ownerDocument;
  const version = extension.runtime.getManifest().version;
  const details = getFirefoxCompanionSetupDetails(version);
  root.replaceChildren();
  root.dataset.firefoxCompanionSetup = "true";

  const main = appendElement(document, root, "main", "firefox-companion-setup");
  const panel = appendElement(document, main, "section", "firefox-companion-setup__panel");
  panel.setAttribute("aria-labelledby", "firefox-companion-setup-title");
  appendCodexLogo(document, panel, extension);
  appendElement(document, panel, "p", "firefox-companion-setup__eyebrow", "One-time Firefox setup");
  const title = appendElement(document, panel, "h1", "firefox-companion-setup__title", "Enable the Codex connection");
  title.id = "firefox-companion-setup-title";
  appendElement(
    document,
    panel,
    "p",
    "firefox-companion-setup__lede",
    "The sidebar could not reach the local Codex transport. Complete the two-part setup below: register OpenAI's native host through the official Chrome integration, then install the Firefox companion.",
  );

  const connection = appendElement(document, panel, "section", "firefox-companion-setup__connection");
  appendElement(document, connection, "p", "firefox-companion-setup__option-label", "How the connection works");
  const flow = appendElement(document, connection, "div", "firefox-companion-setup__connection-flow");
  flow.setAttribute("role", "list");
  flow.setAttribute("aria-label", "Firefox to Codex connection path");
  appendConnectionNode(document, flow, "Firefox", "extension");
  appendConnectionArrow(document, flow);
  appendConnectionNode(document, flow, "Firefox", "companion");
  appendConnectionArrow(document, flow);
  appendConnectionNode(document, flow, "OpenAI", "native host");
  appendConnectionArrow(document, flow);
  appendConnectionNode(document, flow, "ChatGPT", "or Codex");

  const prerequisite = appendElement(document, panel, "section", "firefox-companion-setup__prerequisite");
  appendElement(document, prerequisite, "p", "firefox-companion-setup__option-label", "Required first");
  appendElement(document, prerequisite, "h2", "", "Set up the official Chrome integration");
  appendElement(
    document,
    prerequisite,
    "p",
    "firefox-companion-setup__muted",
    "The Firefox companion depends on the OpenAI native host registered by the desktop app's Chrome plugin setup.",
  );
  const chromeSteps = appendElement(document, prerequisite, "ol", "firefox-companion-setup__compact-steps");
  appendElement(document, chromeSteps, "li", "", "Install Google Chrome temporarily if it is not already installed.");
  appendElement(document, chromeSteps, "li", "", "In the ChatGPT or Codex desktop app, open Plugins → Chrome and complete setup.");
  appendElement(document, chromeSteps, "li", "", "Open Chrome once and confirm the ChatGPT side chat loads.");
  const chromeGuide = appendElement(document, prerequisite, "a", "firefox-companion-setup__text-link", "Open the official Chrome setup guide ↗");
  chromeGuide.href = details.chromeSetupUrl;
  chromeGuide.target = "_blank";
  chromeGuide.rel = "noopener noreferrer";
  appendElement(
    document,
    prerequisite,
    "p",
    "firefox-companion-setup__note",
    "Chrome does not need to become your default browser or remain open, but the official Chrome integration must remain installed.",
  );

  appendElement(document, panel, "h2", "firefox-companion-setup__section-title", "Install the Firefox companion");
  appendElement(
    document,
    panel,
    "p",
    "firefox-companion-setup__section-copy",
    "This local bridge connects Firefox to the native host you registered above. It runs only while Codex is connected and does not operate a remote service.",
  );

  const downloads = appendElement(document, panel, "div", "firefox-companion-setup__downloads");
  downloads.setAttribute("aria-label", "Companion downloads");
  const windows = appendDownload(document, downloads, {
    description: "Per-user setup · Windows x64",
    href: details.windowsUrl,
    label: "Install for Windows",
    platform: "win",
  });
  const macos = appendDownload(document, downloads, {
    description: "Universal package · Apple Silicon and Intel",
    href: details.macosUrl,
    label: "Install for macOS",
    platform: "mac",
  });

  const developer = appendElement(document, panel, "section", "firefox-companion-setup__developer");
  appendElement(document, developer, "p", "firefox-companion-setup__option-label", "Developer path");
  appendElement(document, developer, "h2", "", "Install with npm");
  appendElement(
    document,
    developer,
    "p",
    "firefox-companion-setup__muted",
    "This installs and registers the same bridge for your user account.",
  );
  appendCopyCommand(document, developer, {
    command: details.command,
    statusText: "npm install command copied",
  });

  const steps = appendElement(document, panel, "ol", "firefox-companion-setup__steps");
  appendStep(document, steps, "Restart the desktop app", "Open or restart ChatGPT or Codex after both local pieces are installed.");
  appendStep(document, steps, "Reopen the sidebar", "Close this Firefox sidebar, open it again, and choose Try again below.");

  const diagnostics = appendElement(document, panel, "section", "firefox-companion-setup__diagnostics");
  appendElement(document, diagnostics, "p", "firefox-companion-setup__option-label", "Still disconnected?");
  appendElement(document, diagnostics, "h2", "", "Check both local pieces");
  appendElement(
    document,
    diagnostics,
    "p",
    "firefox-companion-setup__muted",
    "The doctor command reports whether the Firefox companion and its required OpenAI native host are both available.",
  );
  appendCopyCommand(document, diagnostics, {
    command: details.doctorCommand,
    statusText: "doctor command copied",
  });

  const help = appendElement(document, panel, "details", "firefox-companion-setup__help");
  appendElement(document, help, "summary", "", "Why is this needed?");
  appendElement(
    document,
    help,
    "p",
    "",
    "The Chrome plugin setup registers the local com.openai.codexextension host. Firefox extensions cannot reuse a host registered only for a Chrome extension, so the companion crosses that browser and operating-system boundary and relays Firefox to the official local Codex host.",
  );

  const actions = appendElement(document, panel, "div", "firefox-companion-setup__actions");
  const retry = appendElement(document, actions, "button", "firefox-companion-setup__retry", "Try again");
  retry.type = "button";
  retry.addEventListener("click", reload);
  const guide = appendElement(document, actions, "a", "firefox-companion-setup__guide", "Open full setup guide");
  guide.href = extension.runtime.getURL("companion-required.html");
  guide.target = "_blank";
  guide.rel = "noopener noreferrer";

  extension.runtime.getPlatformInfo().then(({ os }) => {
    const recommended = os === "win" ? windows : os === "mac" ? macos : null;
    if (recommended != null) {
      recommended.classList.add("firefox-companion-setup__download--recommended");
      const label = recommended.querySelector("strong")?.textContent ?? "Platform installer";
      recommended.setAttribute("aria-label", `${label} — recommended for this device`);
    }
  }).catch(() => {});

  return main;
}

export function installFirefoxCompanionSetup({
  extension,
  root = globalThis.document?.querySelector("#root"),
  reload,
}) {
  if (root == null) {
    throw new Error("Codex side panel root not found while installing companion setup guidance.");
  }

  const renderIfNeeded = () => {
    if (root.dataset.firefoxCompanionSetup === "true") return true;
    if (!isFirefoxCompanionSetupError(root.textContent)) return false;
    const setupRoot = root.ownerDocument.createElement("div");
    setupRoot.className = "firefox-companion-setup-root";
    root.hidden = true;
    root.dataset.firefoxCompanionSetup = "true";
    root.after(setupRoot);
    renderFirefoxCompanionSetup({ extension, root: setupRoot, reload });
    return true;
  };

  if (renderIfNeeded()) return () => {};
  const observer = new MutationObserver(() => {
    if (renderIfNeeded()) observer.disconnect();
  });
  observer.observe(root, { childList: true, characterData: true, subtree: true });
  return () => observer.disconnect();
}
