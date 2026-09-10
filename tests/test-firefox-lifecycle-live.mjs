import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const firefoxBinary = process.env.FIREFOX_BINARY;
if (!firefoxBinary)
  throw new Error(
    "Set FIREFOX_BINARY to a Firefox or Zen executable. This test uses a disposable headless profile.",
  );
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "firefox-lifecycle-test-"));
fs.copyFileSync(
  path.join(root, "extension/firefox-compat.js"),
  path.join(dir, "firefox-compat.js"),
);
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
const server = http.createServer((req, res) => {
  if (req.url === "/result") {
    let body = "";
    req.on("data", (x) => (body += x));
    req.on("end", () => {
      res.end("ok");
      finish(JSON.parse(body));
    });
  } else {
    res.setHeader("content-type", "text/html");
    res.end(
      "<!doctype html><title>Lifecycle fixture</title><p>isolated lifecycle test</p>",
    );
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}`;
fs.writeFileSync(
  path.join(dir, "test.js"),
  `(async()=>{try{
const target=await browser.tabs.create({url:${JSON.stringify(url)},active:false});
const foreground=await browser.tabs.create({url:${JSON.stringify(url + "/foreground")},active:true});
for(let i=0;i<100&&(await browser.tabs.get(target.id)).status!=='complete';i++)await new Promise(r=>setTimeout(r,100));
if((await browser.tabs.get(target.id)).status!=='complete')throw Error('Initial fixture did not load');
const activations=[];browser.tabs.onActivated.addListener(info=>activations.push(info.tabId));
const debuggee={tabId:target.id};const events=[];
chrome.debugger.onEvent.addListener((source,method,params)=>{if(source.tabId===target.id)events.push({method,params});});
await chrome.debugger.attach(debuggee);
await chrome.debugger.sendCommand(debuggee,'Page.enable',{});
await chrome.debugger.sendCommand(debuggee,'Page.setLifecycleEventsEnabled',{enabled:true});
await browser.tabs.update(target.id,{url:${JSON.stringify(url + "/next")}});
for(let i=0;i<100&&!events.some(e=>e.method==='Page.lifecycleEvent'&&e.params.name==='load');i++)await new Promise(r=>setTimeout(r,100));
const lifecycle=events.filter(e=>e.method==='Page.lifecycleEvent');
const active=(await browser.tabs.query({active:true,currentWindow:true}))[0];
if(active.id!==foreground.id||activations.includes(target.id))throw Error('Foreground tab changed');
for(const name of ['init','DOMContentLoaded','load'])if(!lifecycle.some(e=>e.params.name===name))throw Error('Missing '+name);
const lastLoad=lifecycle.findLast(e=>e.params.name==='load');
if(new Set(lifecycle.map(e=>e.params.loaderId)).size!==1)throw Error('Mixed navigation events');
const tree=await chrome.debugger.sendCommand(debuggee,'Page.getFrameTree',{});
if(tree.frameTree.frame.loaderId!==lastLoad.params.loaderId)throw Error('Loader mismatch');
await fetch(${JSON.stringify(url + "/result")},{method:'POST',body:JSON.stringify({ok:true,backgroundTabPreserved:true,lifecycle:lifecycle.map(e=>e.params.name),loaderId:lastLoad.params.loaderId})});
}catch(e){await fetch(${JSON.stringify(url + "/result")},{method:'POST',body:JSON.stringify({ok:false,error:String(e)+' '+e.stack})});}})();`,
);
const child = spawn(
  "npx",
  [
    "--yes",
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
clearTimeout(timeout);
try {
  if (process.platform === "win32") child.kill("SIGTERM");
  else process.kill(-child.pid, "SIGTERM");
} catch (error) {
  if (error.code !== "ESRCH") throw error;
}
fs.rmSync(dir, { recursive: true, force: true });
server.close();
console.log(JSON.stringify(outcome, null, 2));
process.exitCode = outcome.ok ? 0 : 1;
