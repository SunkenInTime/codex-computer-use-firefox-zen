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
  } else if (req.url === "/ax-fixture.js") {
    res.setHeader("content-type", "text/javascript");
    res.end(`const host = document.querySelector("#ax-shadow");
      host.attachShadow({ mode: "open" }).innerHTML = '<button><slot>AX_SLOT_FALLBACK</slot></button>';
      const fallback = document.querySelector("#ax-empty-slot");
      fallback.attachShadow({ mode: "open" }).innerHTML = '<button><slot>Empty selection</slot></button>';`);
  } else if (req.url === "/fixture.css") {
    res.setHeader("content-type", "text/css");
    res.end(".ax-block {display:block}.ax-inline-block {display:inline-block}.ax-contents {display:contents}.ax-hidden {display:none}.ax-invisible {visibility:hidden}.ax-visible {visibility:visible}.editor {position:relative;margin-top:200vh}.overlay {position:absolute;inset:0;background:white}");
  } else {
    res.setHeader("content-type", "text/html");
    res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; object-src 'none'");
    res.end(
      "<!doctype html><title>Lifecycle fixture</title><link rel='stylesheet' href='/fixture.css'><script>/* AX_SCRIPT_NOISE " + "x".repeat(8192) + " */</script><style>/* AX_STYLE_NOISE */</style><section aria-hidden='true'><p>AX_HIDDEN_TEXT</p></section><p hidden>AX_HIDDEN_ATTRIBUTE</p><p class='ax-hidden'>AX_DISPLAY_NONE</p><input type='password' aria-label='Password' value='AX_PASSWORD_SECRET'><p>isolated lifecycle test</p><div class='ax-invisible'>AX_INVISIBLE_TEXT<button class='ax-visible'>Restored visibility</button></div><button>Git<span>Hub</span></button><button>Read<br>more</button><button>Block<span class='ax-block'>boundary</span>end</button><button><span class='ax-block'>Read</span><span class='ax-block'>blocks</span></button><button>Inline<span class='ax-inline-block'>block</span>separation</button><button><span class='ax-contents'>Git<span>Lab</span></span></button><button>Tea<span hidden>AX_HIDDEN_WORD</span>Pot</button><button>In<br hidden>line</button><span id='hidden-line-label' hidden>Hidden<br>label</span><button aria-labelledby='hidden-line-label'>Referenced button</button><div id='ax-shadow'>Selected item</div><div id='ax-empty-slot'></div><script src='/ax-fixture.js'></script><label id='shared-label'>Shared accessible label</label><button aria-labelledby='shared-label'>Labeled button</button><input aria-label='Repository search'><button>Search</button><a id='charger' href='/charger'><h2 aria-label='UGREEN Nexode 65W'>UGREEN Nexode 65W charger</h2></a><h6>Other charger</h6><h2 aria-hidden='true'>Hidden charger</h2><textarea aria-label='Read-only editor' readonly>do not change</textarea><div class='editor'><textarea aria-label='Code editor'>old blueprint</textarea><div class='overlay'>Editor overlay</div></div>",
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
const ax=await chrome.debugger.sendCommand(debuggee,'Accessibility.getFullAXTree',{});
const axJson=JSON.stringify(ax);
for(const marker of ['AX_SCRIPT_NOISE','AX_STYLE_NOISE','AX_HIDDEN_TEXT','AX_HIDDEN_ATTRIBUTE','AX_DISPLAY_NONE','AX_PASSWORD_SECRET','AX_INVISIBLE_TEXT','AX_SLOT_FALLBACK','AX_HIDDEN_WORD'])if(axJson.includes(marker))throw Error('AX leaked hidden content: '+marker+' ('+axJson.length+' bytes)');
if(axJson.length>25000)throw Error('AX snapshot repeats container text: '+axJson.length);
if(ax.nodes.filter(n=>n.role?.value==='StaticText'&&n.name?.value==='isolated lifecycle test').length!==1)throw Error('AX lost or duplicated visible text');
if(!ax.nodes.some(n=>n.role?.value==='heading'&&n.name?.value==='Other charger'))throw Error('AX H6 role missing');
if(!ax.nodes.some(n=>n.role?.value==='button'&&n.name?.value==='Shared accessible label'))throw Error('AX labelledby missing');
if(!ax.nodes.some(n=>n.role.value==='button'&&n.name.value==='Restored visibility'))throw Error('Visibility-restored control missing');
if(ax.nodes.filter(n=>n.role.value==='StaticText'&&n.name.value==='Selected item').length!==1)throw Error('Assigned slot content must be visited exactly once');
if(!ax.nodes.some(n=>n.role.value==='button'&&n.name.value==='Selected item'))throw Error('Slot control has wrong name');
if(!ax.nodes.some(n=>n.role.value==='button'&&n.name.value==='Empty selection'))throw Error('Empty slot fallback missing');
const github=await chrome.debugger.sendCommand(debuggee,'Accessibility.queryAXTree',{role:'button',accessibleName:'GitHub'});
if(github.nodes.length!==1)throw Error('Adjacent inline text broke role/name lookup: '+JSON.stringify(github));
for(const accessibleName of ['Read more','Block boundary end','Read blocks','Inline block separation','GitLab','TeaPot','Inline','Hidden label']){
 const result=await chrome.debugger.sendCommand(debuggee,'Accessibility.queryAXTree',{role:'button',accessibleName});
 if(result.nodes.filter(node=>node.name?.value===accessibleName).length!==1)throw Error('Rendered word boundary/name lookup failed for '+accessibleName+': '+JSON.stringify(result));
}

for(const node of ax.nodes)for(const child of node.childIds??[])if(ax.nodes.find(n=>n.nodeId===child)?.parentId!==node.nodeId)throw Error('AX parent/child links inconsistent');
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
await fetch(${JSON.stringify(url + "/result")},{method:'POST',body:JSON.stringify({ok:true,compactAccessibleTree:true,axSnapshotBytes:axJson.length,backgroundTabPreserved:true,strictCspAxClickTypeAndClear:true,objectCleanupAndExceptionContract:true,strictCspScreenshotAndEditor:true,lifecycle:lifecycle.map(e=>e.params.name),loaderId:lastLoad.params.loaderId})});
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
