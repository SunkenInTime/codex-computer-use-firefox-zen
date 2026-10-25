#!/usr/bin/env node
// Reapply the intentional patches to the pinned, already-extracted Chrome
// sidebar assets. Fail closed if an upstream update changes either call site.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
function patch(file,from,to){const filename=path.join(root,'extension/codex-sidepanel/assets',file);let source=fs.readFileSync(filename,'utf8');if(source.includes(to))return;if(source.split(from).length!==2)throw Error(`Upstream patch no longer matches exactly once: ${file}`);fs.writeFileSync(filename,source.replace(from,to));}
patch('at-mention-list-CGKnmx1K.js','if(e.source===`extension`&&!n)return[];','if(e.source===`extension`&&!(globalThis.__codexFirefoxTabMentionProviderAvailable===!0||n))return[];');
console.log('Pinned upstream patches applied.');
