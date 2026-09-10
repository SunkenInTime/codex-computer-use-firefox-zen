# Computer-use protocol fixtures

`cua-ax-functions.json` records the node-bound hit-test, scrolling, and activation callbacks sent by the
installed Browser Use runtime (26.903.71938) during `tab.click(elementIndex)`.
They are passed unchanged to Runtime.callFunctionOn in the real Firefox test.
The static equivalent in firefox-compat.js preserves its hit-test semantics
without compiling JavaScript inside the website's CSP realm.

The test sends an actual CSP response header, resolves the input through the AX
and DOM protocol, runs this callback, dispatches mouse events, inserts text, and
checks the input value and foreground-tab preservation. To demonstrate the
regression against a prior adapter, set FIREFOX_COMPAT_SOURCE to that adapter's
path when running npm run test:live.

The live test also covers CSP-safe layout metrics, device-pixel ratio, PNG capture,
and multiline replacement in a covered textarea below the viewport. The fixture
loads its CSS from the same origin so its overlay is enforced under strict CSP.
