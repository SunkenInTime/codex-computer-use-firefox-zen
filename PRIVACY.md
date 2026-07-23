# Privacy disclosure

Codex Computer Use for Zen is an independent compatibility port. The port does not add advertising, sell data, or add its own analytics service.

When you explicitly use computer-use features, the extension can access website content and website activity in the tabs you ask it to control. This access is necessary to inspect page structure, capture visible screenshots, navigate, enter text, click controls, upload files you select, and return results to the computer-use client. The extension also uses a machine-local native-messaging adapter to reach the officially installed OpenAI extension host.

The bundled OpenAI sidebar and host can communicate with OpenAI services to authenticate your account and perform the tasks you request. That communication is governed by OpenAI's policies and account terms. This compatibility port does not operate a separate server and does not independently retain browser content.

Browser permissions are used only to implement user-requested computer-use functions and the signed-in sidebar. The companion is installed separately so Firefox can cross its local-process security boundary. It listens only on a dynamically allocated loopback port while the sidebar is connected, pins relayed WebSocket requests to the official OpenAI Chrome-extension origin, and does not expose a remote service. Remove it through Windows Apps settings, the macOS installer receipt/package-management flow, or the platform development unregister script.

Questions or reports can be filed at <https://github.com/SunkenInTime/codex-computer-use-firefox-zen/issues>.
