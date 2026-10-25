import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const extensionRoot = path.join(root, "extension");
const read = (relativePath) => fs.readFileSync(path.join(extensionRoot, relativePath), "utf8");

const manifest = JSON.parse(read("manifest.json"));
const background = read("background.js");
const chatgptWebsite = read("content-scripts/chatgpt-website.js");
const sidebarAssetDirectory = path.join(extensionRoot, "codex-sidepanel", "assets");
const sidebarSources = fs.readdirSync(sidebarAssetDirectory)
  .filter((name) => name.endsWith(".js"))
  .map((name) => fs.readFileSync(path.join(sidebarAssetDirectory, name), "utf8"));
const sidebarIncludes = (needle) => sidebarSources.some((source) => source.includes(needle));

for (const permission of ["contextMenus", "history", "scripting", "sessions", "storage", "tabs"]) {
  assert.ok(manifest.permissions.includes(permission), `New ChatGPT browser features require the ${permission} permission.`);
}

const websiteRegistration = manifest.content_scripts?.find((entry) =>
  entry.matches?.includes("https://chatgpt.com/*")
  && entry.js?.includes("content-scripts/chatgpt-website.js")
);
assert.ok(websiteRegistration, "The ChatGPT website bridge must be registered so open tabs can be mentioned from chatgpt.com.");
assert.ok(chatgptWebsite.includes("search_browser_tab_mentions"), "The ChatGPT website bridge is missing tab-mention search.");
assert.ok(chatgptWebsite.includes("chatgpt-extension-request-browser-tabs"), "The ChatGPT website bridge is missing the tab-mention request event.");
assert.ok(background.includes("browserTabMentionsOnly"), "The background bundle is missing the filtered open-tab provider.");
assert.ok(
  sidebarIncludes("__codexFirefoxTabMentionProviderAvailable===!0||"),
  "The sidebar must recognize Firefox's native tab-mention provider without a Chrome plugin-discovery result.",
);

assert.ok(background.includes('title:"Ask ChatGPT"'), "The inherited page and selection context menu is missing.");
assert.ok(background.includes('contexts:["page","frame","selection","link","editable","image","video","audio"]'), "Ask ChatGPT must be available for pages and selections.");
assert.ok(background.includes('selectedText:e.selectionText??""'), "Ask ChatGPT must forward highlighted text.");
assert.ok(background.includes('kind:"selection"'), "Selection context must be passed into the ChatGPT sidebar invocation.");

assert.ok(sidebarIncludes("<browser__youtube_transcript>"), "The sidebar runtime is missing timestamped YouTube transcript context.");
assert.ok(sidebarIncludes("/api/timedtext"), "The sidebar runtime is missing the YouTube caption retrieval path.");
assert.ok(background.includes("seek_youtube_timestamp"), "The background bundle is missing timestamp seeking for YouTube answers.");

assert.ok(background.includes("getUserHistory"), "The browser client is missing history retrieval.");
assert.ok(background.includes("chrome.history.search"), "The browser client is not wired to Firefox browser history.");

assert.ok(sidebarIncludes("header.openInApp"), "The sidebar is missing the continue-in-desktop action.");
assert.ok(sidebarIncludes("codex://threads/"), "The continue-in-desktop action is missing its shared-thread deep link.");
assert.ok(sidebarIncludes("chrome-extension-sidepanel-thread-page"), "The shared thread route needed to continue desktop chats in the browser is missing.");

console.log(JSON.stringify({
  ok: true,
  openTabMentions: true,
  highlightedText: true,
  askChatGPTContextMenu: true,
  youtubeTimestampedCaptions: true,
  browserHistory: true,
  desktopBrowserHandoff: true,
}, null, 2));

// File-reference actions must use the run host and cwd.
import { absoluteFilePath } from "../extension/codex-sidepanel/firefox-file-path.js";

for (const [path, cwd, expected] of [
  ["outputs/file.txt", "/Users/test/project", "/Users/test/project/outputs/file.txt"],
  ["./outputs/../file.txt", "/Users/test/project/", "/Users/test/project/./outputs/../file.txt"],
  ["../file.txt", "/tmp/work", "/tmp/work/../file.txt"],
  ["/tmp/a/../file.txt", undefined, "/tmp/a/../file.txt"],
  ["outputs/file.txt", undefined, null],
  ["outputs/file.txt", "relative/project", null],
  ["https://example.test/file.txt", "/tmp", null],
  ["file:///tmp/a%20b.txt", undefined, "/tmp/a b.txt"],
  ["outputs/file.txt", "C:\\Users\\test", "C:\\Users\\test\\outputs\\file.txt"],
  ["C:\\work\\..\\file.txt", "/tmp", "C:\\work\\..\\file.txt"],
  ["\\file.txt", "C:\\work", "C:\\file.txt"],
  ["file:///C:/work/a%20b.txt", null, "C:\\work\\a b.txt"],
  ["outputs/file.txt", "\\\\server\\share\\work", "\\\\server\\share\\work\\outputs\\file.txt"],
  ["../../../../file.txt", "\\\\server\\share\\work", "\\\\server\\share\\work\\..\\..\\..\\..\\file.txt"],
  ["/C:/work/file.txt", "C:\\work", "C:\\work\\file.txt"],
  ["/C:/work/file.txt", undefined, "C:\\work\\file.txt"],
  ["file.txt", "/C:/work", "C:\\work\\file.txt"],
  ["file:///tmp/link/../report.txt", undefined, "/tmp/link/../report.txt"],
]) assert.equal(absoluteFilePath(path, cwd), expected);

// A lexical parent collapse reads the wrong file when an intermediate
// directory is a symlink. Resolve only the cwd and leave traversal to the host.
const { default: os } = await import("node:os");
const { default: nodePath } = await import("node:path");
// Windows resolves parent segments differently; this fixture targets POSIX
// symlink traversal, which must be delegated to the filesystem.
if (process.platform !== "win32") {
  const fixture = fs.mkdtempSync(nodePath.resolve(os.tmpdir(), "file-reference-path-"));
  try {
    fs.mkdirSync(nodePath.join(fixture, "work"));
    fs.mkdirSync(nodePath.join(fixture, "target", "child"), { recursive: true });
    fs.writeFileSync(nodePath.join(fixture, "work", "report.txt"), "wrong file");
    fs.writeFileSync(nodePath.join(fixture, "target", "report.txt"), "symlink parent file");
    fs.symlinkSync(nodePath.join(fixture, "target", "child"), nodePath.join(fixture, "work", "link"), "junction");
    const resolved = absoluteFilePath("link/../report.txt", nodePath.join(fixture, "work"));
    assert.equal(fs.readFileSync(resolved, "utf8"), "symlink parent file");
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
}

const menu = fs.readFileSync("extension/codex-sidepanel/assets/workspace-file-tab-context-menu-BqXeq-x9.js", "utf8");
assert.ok(menu.includes("absoluteFilePath(O,l??getFileTabCwd(r))"), "Copy path must resolve against the run, not the browser.");
assert.ok(menu.includes("Copy relative path"), "An unknown working directory must not be mislabeled as an absolute path.");
assert.ok(menu.includes("path:P??O"), "Copy contents must read the same resolved file as Copy path.");
console.log(JSON.stringify({ ok: true, absoluteFilePaths: true, unknownCwdIsExplicit: true }));

// Exercise the actual packaged menu callback with a small host/thread scope,
// not just the path utility or a minified-string assertion.
const {default:vm}=await import('node:vm');
const factory=menu.slice(menu.indexOf('function C('),menu.indexOf('function w('));
for(const [cwd,threadCwd,expected,label,inputPath="outputs/file.txt"] of [
  ['/Users/test/project',null,'/Users/test/project/outputs/file.txt','Copy path'],
  [null,'/Users/test/project','/Users/test/project/outputs/file.txt','Copy path'],
  [null,null,'outputs/file.txt','Copy relative path'],
  ['/work',null,'/work/link/../report.txt','Copy path','link/../report.txt'],
  ['C:\\work',null,'C:\\work\\file.txt','Copy path','/C:/work/file.txt'],
]){
  const copied=[],read=[];
  const context=vm.createContext({absoluteFilePath,getFileTabCwd:()=>threadCwd,
    d:{},f:{},p:{},b:()=>({primaryTarget:null,visibleTargets:[]}),n:()=>true,
    y:{copyPath:{defaultMessage:'Copy path'}},o:x=>x,
    t:{clipboard:{async writeText(value){copied.push(value)}}},g:()=>{},
    v:(_client,options)=>read.push(options.path),s:()=>{throw Error('Old relative resolver used')},
  });
  const create=vm.runInContext(factory+';C',context);
  const scope={get:()=>({isCapable:false}),query:{getData:()=>undefined},queryClient:{}};
  const items=create(scope,{cwd,path:inputPath});
  const copy=items.find(x=>x.id==='workspace-file-copy-path');
  assert.equal(copy.message.defaultMessage,label);copy.onSelect();
  assert.deepEqual(copied,[expected]);
  items.find(x=>x.id==='workspace-file-copy-contents').onSelect();
  assert.deepEqual(read,[expected]);
}
console.log(JSON.stringify({ok:true,packagedCopyPathMenu:true,resolvedCopyContents:true}));
