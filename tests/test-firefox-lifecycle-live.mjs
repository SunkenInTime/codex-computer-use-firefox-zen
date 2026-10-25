import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const firefoxBinary = process.env.FIREFOX_BINARY;
if (!firefoxBinary)
  throw new Error(
    "Set FIREFOX_BINARY to a Firefox or Zen executable. This test uses a disposable headless profile.",
  );
if (!process.env.npm_execpath)
  throw new Error("Run this test with npm run test:live.");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "firefox-lifecycle-test-"));
fs.copyFileSync(
  process.env.FIREFOX_COMPAT_SOURCE || path.join(root, "extension/firefox-compat.js"),
  path.join(dir, "firefox-compat.js"),
);
const axFunctions = JSON.parse(fs.readFileSync(path.join(root, "tests/fixtures/cua-ax-functions.json"), "utf8"));
const original = JSON.parse(
  fs.readFileSync(path.join(root, "extension/manifest.json")),
);
const manifest = {
  manifest_version: 3,
  name: "Lifecycle isolated test",
  version: "1.0",
  browser_specific_settings: { gecko: { id: "lifecycle-test@localhost" } },
  permissions: original.permissions,
  host_permissions: ["<all_urls>"],
  background: { scripts: ["firefox-compat.js", "test.js"] },
  action: {},
  content_security_policy: original.content_security_policy,
};
fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest));
let finish;
const result = new Promise((r) => (finish = r));
const sidebarRoot = path.join(root, "extension/codex-sidepanel");
const assetsRoot = path.join(sidebarRoot, "assets");
const footerStyle = fs.readdirSync(assetsRoot).find(name => /^composer-footer-.*\.css$/u.test(name));
if (!footerStyle) throw new Error("The shipped footer stylesheet is missing.");
const requests = [];
const server = http.createServer((req, res) => {
  requests.push(req.url);
  if (req.url === "/result") {
    let body = "";
    req.on("data", (x) => (body += x));
    req.on("end", () => {
      res.end("ok");
      finish(JSON.parse(body));
    });
  } else if (req.url === "/footer-layout") {
    res.setHeader("content-type", "text/html");
    res.end(`<html data-codex-window-type="chrome-extension"><head>
      <link rel="stylesheet" href="/assets/${footerStyle}">
      <link rel="stylesheet" href="/sidebar-layout.css">
      <script type="module" src="/footer-fixture.js"></script></head><body>
      ${[280, 320, 400].map(width => `<div data-host-width="${width}" style="display:flex;width:${width}px"><div class="mount" style="flex:1;min-width:0"></div></div>`).join("")}
      </body></html>`);
  } else if (req.url === "/footer-fixture.js") {
    res.setHeader("content-type", "text/javascript");
    res.end(`import { r as react } from "/assets/jsx-runtime-CNO-vQvX.js";
      import { t as client } from "/assets/client-DpueprnI.js";
      import { t as Footer } from "/assets/composer-footer-Cw2FUQYZ.js";
      const React = react();
      for (const mount of document.querySelectorAll(".mount")) {
        client().createRoot(mount).render(React.createElement(Footer, null,
          React.createElement("div", { "data-composer-utility-bar-scroll-area": "", style: { overflowX: "auto" } }, "Composer actions")));
      }`);
  } else if (req.url === "/sidebar-layout.css") {
    res.setHeader("content-type", "text/css");
    res.end(fs.readFileSync(path.join(sidebarRoot, "firefox-sidebar-layout.css")));
  } else if (/^\/assets\/[^/]+\.(js|css)$/u.test(req.url)) {
    res.setHeader("content-type", req.url.endsWith(".css") ? "text/css" : "text/javascript");
    res.end(fs.readFileSync(path.join(assetsRoot, req.url.slice("/assets/".length))));
  } else if (req.url === "/fixture.css") {
    res.setHeader("content-type", "text/css");
    res.end(".editor {position:relative;margin-top:200vh}.overlay {position:absolute;inset:0;background:white}");
  } else {
    res.setHeader("content-type", "text/html");
    res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; object-src 'none'");
    res.end(
      "<!doctype html><title>Lifecycle fixture</title><link rel='stylesheet' href='/fixture.css'><p>isolated lifecycle test</p><iframe id='footer-layout' src='/footer-layout'></iframe><input aria-label='Repository search'><button>Search</button><textarea aria-label='Read-only editor' readonly>do not change</textarea><div class='editor'><textarea aria-label='Code editor'>old blueprint</textarea><div class='overlay'>Editor overlay</div></div>",
    );
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}`;
fs.writeFileSync(
  path.join(dir, "test.js"),
  `(async()=>{try{
const target=await browser.tabs.create({url:${JSON.stringify(url)},active:true});
let initialLoaded=false;
for(let i=0;i<300;i++){
 const tab=await browser.tabs.get(target.id);
 if(tab.status==='complete'&&tab.url===${JSON.stringify(url + "/")}){initialLoaded=true;break;}
 await new Promise(r=>setTimeout(r,100));
}
if(!initialLoaded)throw Error('Initial fixture did not load: '+JSON.stringify(await browser.tabs.get(target.id)));
const foreground=await browser.tabs.create({url:${JSON.stringify(url + "/foreground")},active:true});
const activations=[];browser.tabs.onActivated.addListener(info=>activations.push(info.tabId));
const debuggee={tabId:target.id};const events=[];
chrome.debugger.onEvent.addListener((source,method,params)=>{if(source.tabId===target.id)events.push({method,params});});
await chrome.debugger.attach(debuggee);
await chrome.debugger.sendCommand(debuggee,'Page.enable',{});
await chrome.debugger.sendCommand(debuggee,'Network.enable',{});
await chrome.debugger.sendCommand(debuggee,'Page.setLifecycleEventsEnabled',{enabled:true});
await browser.tabs.update(target.id,{url:${JSON.stringify(url + "/next")}});
const navigationLoader=()=>events.findLast(e=>e.method==='Page.frameNavigated'&&e.params.frame.url===${JSON.stringify(url + "/next")})?.params.frame.loaderId;
for(let i=0;i<300&&!events.some(e=>e.method==='Page.lifecycleEvent'&&e.params.name==='load'&&e.params.loaderId===navigationLoader());i++)await new Promise(r=>setTimeout(r,100));
if(!navigationLoader())throw Error('Fixture navigation did not commit');
const lifecycle=events.filter(e=>e.method==='Page.lifecycleEvent'&&e.params.loaderId===navigationLoader());
const active=(await browser.tabs.query({active:true,currentWindow:true}))[0];
if(active.id!==foreground.id||activations.includes(target.id))throw Error('Foreground tab changed');
for(const name of ['init','DOMContentLoaded','load'])if(!lifecycle.some(e=>e.params.name===name))throw Error('Missing '+name);
const lastLoad=lifecycle.findLast(e=>e.params.name==='load');
const tree=await chrome.debugger.sendCommand(debuggee,'Page.getFrameTree',{});
if(tree.frameTree.frame.loaderId!==lastLoad.params.loaderId)throw Error('Loader mismatch');
const documentEvents=events.filter(e=>['Network.requestWillBeSent','Network.responseReceived'].includes(e.method)&&e.params.type==='Document'&&(e.params.request?.url??e.params.response?.url)===${JSON.stringify(url + "/next")}&&e.params.requestId.startsWith('firefox-request-'));
if(!documentEvents.length||documentEvents.some(e=>e.params.loaderId!==lastLoad.params.loaderId))throw Error('Network loader mismatch: '+JSON.stringify({documentEvents, lifecycle}));
let footerChecks;
for(let attempt=0;attempt<100;attempt++){
 const results=await browser.scripting.executeScript({target:{tabId:target.id},func:()=>{
  const doc=document.querySelector('#footer-layout').contentDocument;
  return [...doc.querySelectorAll('[class*="_footer_"]')].map(footer=>({
    max:doc.defaultView.getComputedStyle(footer).maxWidth,
    min:doc.defaultView.getComputedStyle(footer).minWidth,
    width:footer.getBoundingClientRect().width,
    host:Number(footer.closest('[data-host-width]').dataset.hostWidth),
    scrollMax:doc.defaultView.getComputedStyle(footer.querySelector('[data-composer-utility-bar-scroll-area]')).maxWidth,
  }));
 }});
 footerChecks=results[0]?.result;
 if(footerChecks?.length===3)break;
 await new Promise(r=>setTimeout(r,50));
}
if(footerChecks?.length!==3||footerChecks.some(f=>f.max!=='100%'||f.min!=='0px'||f.scrollMax!=='100%'||f.width>f.host))throw Error('Shipped footer layout adapter did not apply: '+JSON.stringify(footerChecks));
const ax=await chrome.debugger.sendCommand(debuggee,'Accessibility.getFullAXTree',{});
const input=ax.nodes.find(n=>n.name?.value==='Repository search');
if(!input)throw Error('Search input missing from AX tree');
const resolved=await chrome.debugger.sendCommand(debuggee,'DOM.resolveNode',{backendNodeId:input.backendDOMNodeId});
const hit=await chrome.debugger.sendCommand(debuggee,'Runtime.callFunctionOn',{objectId:resolved.object.objectId,functionDeclaration:${JSON.stringify(axFunctions.hitTest)},arguments:[{}],returnByValue:true,userGesture:true});
if(!hit.result.value.hitsTarget)throw Error('AX hit test did not find input');
const point=hit.result.value.point;
for(const type of ['mouseMoved','mousePressed','mouseReleased'])await chrome.debugger.sendCommand(debuggee,'Input.dispatchMouseEvent',{type,...point,button:type==='mouseMoved'?'none':'left',clickCount:1});
await chrome.debugger.sendCommand(debuggee,'Input.insertText',{text:'icarus'});
const typed=await chrome.debugger.sendCommand(debuggee,'Accessibility.getFullAXTree',{});
if(typed.nodes.find(n=>n.name?.value==='Repository search')?.value?.value!=='icarus')throw Error('Click and type did not update input');
for(const modifiers of [4,2]){
  if(modifiers===2)await chrome.debugger.sendCommand(debuggee,'Input.insertText',{text:'icarus'});
  for(const type of ['keyDown','keyUp'])await chrome.debugger.sendCommand(debuggee,'Input.dispatchKeyEvent',{type,key:'a',code:'KeyA',modifiers,windowsVirtualKeyCode:65});
  for(const type of ['keyDown','keyUp'])await chrome.debugger.sendCommand(debuggee,'Input.dispatchKeyEvent',{type,key:'Backspace',code:'Backspace',modifiers:0,windowsVirtualKeyCode:8});
  const cleared=await chrome.debugger.sendCommand(debuggee,'Accessibility.getFullAXTree',{});
  if(cleared.nodes.find(n=>n.name?.value==='Repository search')?.value?.value!=='')throw Error('Select-all and Backspace did not clear input (modifiers='+modifiers+')');
}
const metrics=await chrome.debugger.sendCommand(debuggee,'Page.getLayoutMetrics',{});
if(!(metrics.cssVisualViewport.clientWidth>0&&metrics.cssContentSize.height>metrics.cssVisualViewport.clientHeight))throw Error('Strict-CSP layout metrics missing document dimensions');
const dpr=await chrome.debugger.sendCommand(debuggee,'Runtime.evaluate',{expression:'window.devicePixelRatio',returnByValue:true});
if(!(dpr.result.value>0))throw Error('Strict-CSP device pixel ratio missing');
const screenshot=await chrome.debugger.sendCommand(debuggee,'Page.captureScreenshot',{format:'png'});
if(!screenshot.data?.startsWith('iVBOR'))throw Error('Strict-CSP screenshot missing PNG data');
const editor=ax.nodes.find(n=>n.name?.value==='Code editor');
const editorHandle=await chrome.debugger.sendCommand(debuggee,'DOM.resolveNode',{backendNodeId:editor.backendDOMNodeId});
for(const functionDeclaration of [${JSON.stringify(axFunctions.scroll)},${JSON.stringify(axFunctions.activate)}]){
  const response=await chrome.debugger.sendCommand(debuggee,'Runtime.callFunctionOn',{objectId:editorHandle.object.objectId,functionDeclaration,arguments:[{value:{}}],returnByValue:true,userGesture:true});
  if(response.exceptionDetails||response.result.type!=='undefined')throw Error('AX editor fallback failed: '+JSON.stringify(response));
}
for(const type of ['keyDown','keyUp'])await chrome.debugger.sendCommand(debuggee,'Input.dispatchKeyEvent',{type,key:'a',code:'KeyA',modifiers:4});
await chrome.debugger.sendCommand(debuggee,'Input.insertText',{text:'maintenance: |\\n  npm install'});
const edited=await chrome.debugger.sendCommand(debuggee,'Accessibility.getFullAXTree',{});
if(edited.nodes.find(n=>n.name?.value==='Code editor')?.value?.value!=='maintenance: |\\n  npm install')throw Error('Covered editor replacement failed');
const readOnly=ax.nodes.find(n=>n.name?.value==='Read-only editor');
const readOnlyHandle=await chrome.debugger.sendCommand(debuggee,'DOM.resolveNode',{backendNodeId:readOnly.backendDOMNodeId});
const denied=await chrome.debugger.sendCommand(debuggee,'Runtime.callFunctionOn',{objectId:readOnlyHandle.object.objectId,functionDeclaration:${JSON.stringify(axFunctions.activate)},arguments:[{value:{}}],returnByValue:true});
if(!denied.exceptionDetails?.text.includes('read-only'))throw Error('Editor fallback must reject read-only controls');
await chrome.debugger.sendCommand(debuggee,'Runtime.releaseObject',{objectId:readOnlyHandle.object.objectId});
await chrome.debugger.sendCommand(debuggee,'Runtime.releaseObject',{objectId:editorHandle.object.objectId});
await chrome.debugger.sendCommand(debuggee,'Runtime.releaseObject',{objectId:resolved.object.objectId});
const released=await chrome.debugger.sendCommand(debuggee,'Runtime.callFunctionOn',{objectId:resolved.object.objectId,functionDeclaration:${JSON.stringify(axFunctions.hitTest)},arguments:[{}],returnByValue:true});
if(released.result?.type!=='undefined'||!released.exceptionDetails?.text)throw Error('Released handle must return CDP exceptionDetails');
const grouped=await chrome.debugger.sendCommand(debuggee,'DOM.resolveNode',{backendNodeId:input.backendDOMNodeId,objectGroup:'cleanup-test'});
await chrome.debugger.sendCommand(debuggee,'Runtime.releaseObjectGroup',{objectGroup:'cleanup-test'});
const releasedGroup=await chrome.debugger.sendCommand(debuggee,'Runtime.callFunctionOn',{objectId:grouped.object.objectId,functionDeclaration:${JSON.stringify(axFunctions.hitTest)},arguments:[{}],returnByValue:true});
if(!releasedGroup.exceptionDetails?.text)throw Error('Group cleanup retained the handle');
const activeAfter=(await browser.tabs.query({active:true,currentWindow:true}))[0];
if(activeAfter.id!==foreground.id||activations.includes(target.id))throw Error('CSP click activated background tab');
await fetch(${JSON.stringify(url + "/result")},{method:'POST',body:JSON.stringify({ok:true,shippedFooterLayout:true,backgroundTabPreserved:true,strictCspAxClickTypeAndClear:true,objectCleanupAndExceptionContract:true,strictCspScreenshotAndEditor:true,lifecycle:lifecycle.map(e=>e.params.name),loaderId:lastLoad.params.loaderId})});
}catch(e){await fetch(${JSON.stringify(url + "/result")},{method:'POST',body:JSON.stringify({ok:false,error:String(e)+' '+e.stack})});}})();`,
);
const child = spawn(
  process.execPath,
  [
    process.env.npm_execpath,
    "exec",
    "--yes",
    "--package=web-ext",
    "--",
    "web-ext",
    "run",
    "--source-dir",
    dir,
    "--firefox",
    firefoxBinary,
    "--no-reload",
    "--args=-headless",
  ],
  { stdio: ["ignore", "pipe", "pipe"], detached: process.platform !== "win32" },
);
child.on("error", (error) => finish({ ok: false, error: String(error) }));
child.on("exit", (code, signal) =>
  finish({
    ok: false,
    error: `web-ext exited before reporting: ${code ?? signal}`,
    logs,
  }),
);
let logs = "";
child.stdout.on("data", (x) => (logs += x));
child.stderr.on("data", (x) => (logs += x));
const timeout = setTimeout(
  () => finish({ ok: false, error: "Timed out", logs }),
  90000,
);
const outcome = await result;
if (!outcome.ok) Object.assign(outcome, { requests, logs });
clearTimeout(timeout);
try {
  if (process.platform === "win32")
    spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"]);
  else process.kill(-child.pid, "SIGTERM");
} catch (error) {
  if (error.code !== "ESRCH") throw error;
}
fs.rmSync(dir, { recursive: true, force: true });
server.close();
console.log(JSON.stringify(outcome, null, 2));
process.exitCode = outcome.ok ? 0 : 1;
