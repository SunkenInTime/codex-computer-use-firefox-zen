#!/usr/bin/env node
// Reapply the intentional patches to the pinned, already-extracted Chrome
// sidebar assets. Fail closed if an upstream update changes either call site.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
function patch(file,from,to){const filename=path.join(root,'extension/codex-sidepanel/assets',file);let source=fs.readFileSync(filename,'utf8');if(source.includes(to))return;if(source.split(from).length!==2)throw Error(`Upstream patch no longer matches exactly once: ${file}`);fs.writeFileSync(filename,source.replace(from,to));}
patch('at-mention-list-CGKnmx1K.js','if(e.source===`extension`&&!n)return[];','if(e.source===`extension`&&!(globalThis.__codexFirefoxTabMentionProviderAvailable===!0||n))return[];');
const menuFile=path.join(root,'extension/codex-sidepanel/assets/workspace-file-tab-context-menu-BqXeq-x9.js');
const imports='import{absoluteFilePath}from"../firefox-file-path.js";import{t as getFileTabCwd}from"./review-file-source-tab-sync-Bk5sIHjz.js";';
let menu=fs.readFileSync(menuFile,'utf8');if(!menu.startsWith(imports))fs.writeFileSync(menuFile,imports+menu);
patch('workspace-file-tab-context-menu-BqXeq-x9.js','P=l==null?O:s(l,O)','P=absoluteFilePath(O,l??getFileTabCwd(r))');
patch('workspace-file-tab-context-menu-BqXeq-x9.js','message:y.copyPath,onSelect:()=>{t.clipboard.writeText(P).catch(()=>g(P))}','message:P==null?{id:`firefox.fileReference.copyRelativePath`,defaultMessage:`Copy relative path`,description:`Working directory unavailable; this copies the explicit relative reference`}:y.copyPath,onSelect:()=>{t.clipboard.writeText(P??O).catch(()=>g(P??O))}');
patch('workspace-file-tab-context-menu-BqXeq-x9.js','v(r.queryClient,{hostId:x,path:O})','v(r.queryClient,{hostId:x,path:P??O})');

console.log('Pinned upstream patches applied.');
