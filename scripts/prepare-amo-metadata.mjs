import fs from "node:fs";
const { version } = JSON.parse(fs.readFileSync("version.json", "utf8"));
const changelog = fs.readFileSync("CHANGELOG.md", "utf8");
const heading = `## ${version} -`;
const start = changelog.indexOf(heading);
if (start < 0) throw new Error(`Missing changelog for ${version}.`);
const bodyStart = changelog.indexOf("\n", start);
const end = changelog.indexOf("\n## ", bodyStart);
const notes = changelog.slice(bodyStart, end < 0 ? undefined : end).trim();
fs.mkdirSync("dist", { recursive: true });
fs.writeFileSync(
  "dist/amo-metadata.json",
  JSON.stringify(
    {
      version: {
        release_notes: { "en-US": notes },
        approval_notes: fs.readFileSync("AMO_LISTING.md", "utf8"),
      },
    },
    null,
    2,
  ) + "\n",
);
console.log(`Prepared AMO release notes and reviewer metadata for ${version}.`);
