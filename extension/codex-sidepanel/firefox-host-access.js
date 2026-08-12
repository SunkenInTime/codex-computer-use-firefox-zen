export const REQUIRED_HOST_ACCESS = Object.freeze({ origins: ["<all_urls>"] });

export async function hasFirefoxHostAccess(extension) {
  if (typeof extension.permissions?.contains !== "function") {
    return true;
  }
  return extension.permissions.contains(REQUIRED_HOST_ACCESS);
}

function appendTextElement(document, parent, tagName, className, text) {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text;
  parent.append(element);
  return element;
}

export function renderFirefoxHostAccessPrompt({ extension, root, reload }) {
  const document = root.ownerDocument;
  root.replaceChildren();

  const main = document.createElement("main");
  main.className = "firefox-host-access";
  const card = document.createElement("section");
  card.className = "firefox-host-access__card";
  appendTextElement(document, card, "div", "firefox-host-access__icon", "🦊");
  appendTextElement(document, card, "h1", "firefox-host-access__title", "Allow website access");
  appendTextElement(
    document,
    card,
    "p",
    "firefox-host-access__copy",
    "Codex needs Firefox permission to read and interact with pages after navigation or when a new tab opens.",
  );
  appendTextElement(
    document,
    card,
    "p",
    "firefox-host-access__copy firefox-host-access__copy--muted",
    "Firefox lets you revoke this at any time from Add-ons and themes → Permissions and data.",
  );

  const button = appendTextElement(
    document,
    card,
    "button",
    "firefox-host-access__button",
    "Allow all websites",
  );
  button.type = "button";
  const status = appendTextElement(document, card, "p", "firefox-host-access__status", "");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");

  button.addEventListener("click", async () => {
    button.disabled = true;
    status.textContent = "Waiting for Firefox…";
    try {
      // Keep this request as the first asynchronous action in the click handler:
      // Firefox requires permissions.request() to be triggered by a user action.
      const accepted = await extension.permissions.request(REQUIRED_HOST_ACCESS);
      const granted = accepted && await hasFirefoxHostAccess(extension);
      if (granted) {
        status.textContent = "Access granted. Reloading Codex…";
        reload();
        return;
      }
      status.textContent = "Access was not granted. Choose Allow all websites to try again.";
    } catch (error) {
      status.textContent = `Firefox could not grant access: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      button.disabled = false;
    }
  });

  main.append(card);
  root.append(main);
}

export async function ensureFirefoxHostAccess({
  extension,
  root = globalThis.document?.querySelector("#root"),
  reload = () => globalThis.location.reload(),
}) {
  if (await hasFirefoxHostAccess(extension)) {
    return true;
  }
  if (root == null) {
    throw new Error("Codex side panel root not found while requesting Firefox website access.");
  }
  renderFirefoxHostAccessPrompt({ extension, root, reload });
  return false;
}
