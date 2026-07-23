import fs from "node:fs";

const version = process.argv[2];
if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u.test(version ?? "")) {
  throw new Error("Usage: npm run version:set -- MAJOR.MINOR.PATCH");
}

function updateJson(file, updater) {
  const value = JSON.parse(fs.readFileSync(file, "utf8"));
  updater(value);
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

updateJson("version.json", (value) => {
  value.version = version;
});
updateJson("extension/manifest.json", (value) => {
  value.version = version;
});
updateJson("package.json", (value) => {
  value.version = version;
});
updateJson("npm/package.json", (value) => {
  value.version = version;
});

for (const file of ["native-host/Cargo.toml", "native-host/Cargo.lock"]) {
  const source = fs.readFileSync(file, "utf8");
  const pattern = /(\bname\s*=\s*"codex-firefox-bridge"\s*\r?\nversion\s*=\s*")[^"]+/u;
  if (!pattern.test(source)) {
    throw new Error(`Could not update the companion version in ${file}`);
  }
  const updated = source.replace(pattern, `$1${version}`);
  fs.writeFileSync(file, updated);
}

console.log(`Set release version to ${version}. Tag the release as v${version}.`);
