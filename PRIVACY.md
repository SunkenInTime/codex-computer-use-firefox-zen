# Privacy disclosure

Codex Computer use for Firefox & Zen is an independent compatibility port. The port does not add advertising, sell data, or add its own analytics service.

When you explicitly use computer-use features, the extension can access website content and website activity in the tabs you ask it to control. This access is necessary to inspect page structure, capture visible screenshots, navigate, enter text, click controls, upload files you select, and return results to the computer-use client. The extension also uses a machine-local native-messaging adapter to reach the officially installed OpenAI extension host.

The bundled OpenAI sidebar and host can communicate with OpenAI services to authenticate your account and perform the tasks you request. That communication is governed by OpenAI's policies and account terms. This compatibility port does not operate a separate server and does not independently retain browser content.

Browser permissions are used only to implement user-requested computer-use functions and the signed-in sidebar. Removing the extension and running `scripts/unregister-native-host.ps1` removes this port's browser component and native-host registration.

Questions or reports can be filed at <https://github.com/SunkenInTime/codex-computer-use-firefox-zen/issues>.
